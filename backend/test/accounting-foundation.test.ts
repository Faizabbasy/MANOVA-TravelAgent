import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod,getBook,lockRehearsalPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent,type BusinessEvent } from '../src/modules/accounting/posting'
import { postManualTransaction,postTransfer,reverseTransaction } from '../src/modules/finance/postings'
import { postCashSource } from '../src/modules/accounting/cash-source'
import { trialBalance } from '../src/modules/accounting/reads'
import { migrateDown } from '../src/db/migrator'
import { seedDemo } from '../src/db/seed-demo'
import { seedFinanceDemo } from '../src/db/seed-finance-demo'
import { seedYearDemo } from '../src/db/seed-year-demo'

describe('accounting foundation (isolated books only)',() => {
  let t:TestApp,owner:string,finance:string,admin:string,bookId:string,periodId:string,firstJournal:string
  const actor = { userId:'USR-010',role:'super-admin' as const,name:'Test Owner',email:'test-only@example.invalid',sessionId:'TEST-ONLY',partyId:null,vendorId:null }
  const event = (id:string,amount='100'):BusinessEvent => ({ sourceType:'test_fulfillment',sourceId:id,sourceVersion:'1',kind:'delivered',effectiveDate:'2026-09-15',
    snapshot:{ amountMinor:amount,fixture:'TEST_ONLY' },policyKind:'fulfillment',description:'TEST_ONLY delivery',
    lines:[{ accountCode:'1180',debitMinor:amount,creditMinor:'0',partyId:'PTY-001' },{ accountCode:'4100',debitMinor:'0',creditMinor:amount }] })
  beforeAll(async () => {
    t = await makeTestApp()
    owner = await t.login(DEMO.superAdmin);finance = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
  },60000)
  afterAll(async () => { await t?.cleanup() })

  test('unconfigured amounts are unavailable and namespace rejects anonymous/Admin before body validation',async () => {
    for (const path of ['/setup','trial-balance?asOf=2026-09-30','/journals','/exceptions']) {
      const p = '/api/v1/accounting/'+path.replace(/^\//,'')
      expect((await t.call('GET',p)).status).toBe(401)
      expect((await t.call('GET',p,{ cookie:admin })).status).toBe(403)
    }
    expect((await t.call('POST','/api/v1/accounting/setup',{ cookie:admin,body:{} })).status).toBe(403)
    expect((await t.call('POST','/api/v1/accounting/setup',{ cookie:finance,body:{} })).status).toBe(403)
    const response = await t.call('GET','/api/v1/accounting/trial-balance?asOf=2026-09-30',{ cookie:finance })
    expect(response.status).toBe(200);expect(response.json.data.totalDebitMinor).toBeNull();expect(response.json.data.available).toBe(false)
  })
  test('setup uses real API, is idempotent, never activates, and rejects activation fields',async () => {
    const body = { name:'TEST_ONLY book',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' }
    const opts = { cookie:owner,body,headers:{ 'idempotency-key':'accounting-setup-fixture' } }
    await expect(t.db.transaction(tx => createBook(tx,actor,body,'req_production_guard','production'))).rejects.toThrow('lingkungan terisolasi')
    const response = await t.call('POST','/api/v1/accounting/setup',opts)
    expect(response.status).toBe(200);expect(response.json.data.mode).toBe('shadow')
    bookId = response.json.data.id
    expect((await t.call('POST','/api/v1/accounting/setup',opts)).json.data.id).toBe(bookId)
    expect((await t.db.query('select * from accounting_books')).length).toBe(1)
    expect((await t.call('POST','/api/v1/accounting/setup',{ ...opts,headers:{ 'idempotency-key':'accounting-extra-fields' },body:{ ...body,mode:'active',taxStatus:'validated' } })).status).toBe(409)
    expect((await getBook(t.db))!.mode).toBe('shadow')
    expect((await t.call('POST','/api/v1/accounting/setup',{ cookie:owner,body })).status).toBe(400)
    expect((await t.call('GET','/api/v1/accounting/journals/AJN-does-not-exist',{ cookie:finance })).status).toBe(404)
    expect((await t.call('POST','/api/v1/accounting/setup',{ ...opts,headers:{ ...opts.headers,origin:'https://evil.example' } })).status).toBe(403)
  })
  test('periods validate dates and overlap, policies are drafts with immutable versions',async () => {
    const result = await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-01',endsOn:'2026-09-30',reason:'TEST_ONLY period' },'req_test_period'))
    periodId = result.id
    await expect(t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-09-15',endsOn:'2026-10-05',reason:'Overlap fixture' },'req_test_period'))).rejects.toThrow('bertumpang')
    expect((await t.call('POST','/api/v1/accounting/periods',{ cookie:owner,headers:{ 'idempotency-key':'invalid-period-date' },body:{ startsOn:'2026-02-30',endsOn:'2026-03-01',reason:'TEST_ONLY' } })).status).toBe(400)
    const body = { sourceKind:'tax',effectiveFrom:'2026-09-01',principalAgent:'unknown',recognition:'unknown',taxTreatment:'unknown',rationale:'Belum diputuskan, tidak menjadi kebijakan aktif' }
    for (let i=1;i<=2;i++) {
      const res = await t.call('POST','/api/v1/accounting/policies',{ cookie:owner,body,headers:{ 'idempotency-key':`draft-policy-version-${i}` } })
      expect(res.status).toBe(200);expect(res.json.data.version).toBe(i);expect(res.json.data.validationStatus).toBe('draft')
    }
    await expect(t.db.query("update accounting_policies set validation_status='validated' where source_kind='tax'")).rejects.toThrow('immutable')
    for (const kind of ['fulfillment','manual_cash','transfer']) {
      await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY fixture, not a real company policy',$5)`,
        [`APL-test-${kind}`,bookId,kind,JSON.stringify({ classifications:{ office:'office-expense',other_income:'other-revenue' } }),actor.userId])
    }
  })
  test('balanced events post once by source identity; partial events retain separate identity; replay does not use revised amount',async () => {
    const e = event('DELIVERY-1')
    const a = await t.db.transaction(tx => postBusinessEvent(tx,actor,e,'req_first_post'))
    const b = await t.db.transaction(tx => postBusinessEvent(tx,actor,e,'req_other_key'))
    expect(a.journalId).toBe(b.journalId);firstJournal = a.journalId!
    expect((await t.db.query('select id from accounting_journals')).length).toBe(1)
    await expect(t.db.transaction(tx => postBusinessEvent(tx,actor,event('DELIVERY-1','101'),'req_changed_fact'))).rejects.toThrow('Fakta sumber berbeda')
    await t.db.transaction(tx => postBusinessEvent(tx,actor,{ ...e,sourceVersion:'partial-2',snapshot:{ amountMinor:'60' },lines:event('x','60').lines },'req_partial_post'))
    const tb = await trialBalance(t.db,'2026-09-30')
    expect(tb.totalDebitMinor).toBe('160');expect(tb.totalCreditMinor).toBe('160');expect(tb.netProfitMinor).toBeNull()
    expect(tb.reasons.map(r => r.code)).toContain('REHEARSAL_ONLY')
    const detail = await t.call('GET',`/api/v1/accounting/journals/${firstJournal}`,{ cookie:finance })
    expect(detail.json.data.snapshot.amountMinor).toBe('100')
    const page = await t.call('GET','/api/v1/accounting/journals?limit=1',{ cookie:finance })
    expect(page.json.data.length).toBe(1);expect(page.json.meta.pagination.nextCursor).not.toBeNull()
    const next = await t.call('GET',`/api/v1/accounting/journals?limit=1&cursor=${page.json.meta.pagination.nextCursor}`,{ cookie:finance })
    expect(next.json.data[0].id).not.toBe(page.json.data[0].id)
  })
  test('SQL guards reject posted edits/deletes/truncate, unbalanced/empty/direct-posted journals and missing dimensions',async () => {
    await expect(t.db.query("update accounting_journals set description='changed' where id=$1",[firstJournal])).rejects.toThrow('immutable')
    await expect(t.db.query('delete from accounting_journals where id=$1',[firstJournal])).rejects.toThrow('immutable')
    await expect(t.db.query('update accounting_journal_lines set debit_minor=101 where journal_id=$1 and line_no=1',[firstJournal])).rejects.toThrow('immutable')
    await expect(t.db.exec('truncate accounting_journal_lines')).rejects.toThrow('immutable')
    await expect(t.db.query("update accounting_events set snapshot='{}'")).rejects.toThrow('immutable')
    const rawDraft = async (tx:Parameters<Parameters<TestApp['db']['transaction']>[0]>[0]) => {
      await tx.query(`insert into accounting_journals (id,book_id,event_id,purpose,policy_id,period_id,effective_date,description)
        select 'AJN-invalid',book_id,event_id,'invalid',policy_id,period_id,effective_date,'TEST_ONLY' from accounting_journals where id=$1`,[firstJournal])
    }
    await expect(t.db.transaction(async tx => { await rawDraft(tx);await tx.query("update accounting_journals set status='posted',posted_at=now() where id='AJN-invalid'") })).rejects.toThrow('balanced')
    await expect(t.db.transaction(async tx => {
      await rawDraft(tx)
      await tx.query(`insert into accounting_journal_lines (journal_id,book_id,line_no,account_code,debit_minor) values ('AJN-invalid',$1,1,'1100',100)`,[bookId])
    })).rejects.toThrow('dimension')
    await expect(t.db.transaction(async tx => {
      await rawDraft(tx)
      await tx.query(`insert into accounting_journal_lines (journal_id,book_id,line_no,account_code,debit_minor,credit_minor) values
        ('AJN-invalid',$1,1,'6100',100,0),('AJN-invalid',$1,2,'4100',0,99)`,[bookId])
      await tx.query("update accounting_journals set status='posted',posted_at=now() where id='AJN-invalid'")
    })).rejects.toThrow('balanced')
  })
  test('unknown policy produces a visible exception in shadow and atomic rollback in active rehearsal',async () => {
    const unknown = { ...event('UNKNOWN-1'),policyKind:'payroll' }
    expect((await t.db.transaction(tx => postBusinessEvent(tx,actor,unknown,'req_unknown_policy'))).status).toBe('pending')
    const res = await t.call('GET','/api/v1/accounting/exceptions',{ cookie:finance })
    expect(res.json.data[0].sourceId).toBe('UNKNOWN-1')
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
    await expect(t.db.transaction(tx => postBusinessEvent(tx,actor,{ ...unknown,sourceId:'UNKNOWN-ACTIVE' },'req_unknown_active'))).rejects.toThrow('kebijakan')
    expect((await t.db.query("select * from accounting_events where source_id='UNKNOWN-ACTIVE'")).length).toBe(0)
    await t.db.query("update accounting_books set mode='shadow'")
  })
  test('existing money command creates cash once, derives journal, reverses both and transfer clearing nets to zero',async () => {
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-acct-a','TESTA','Test','TEST_ONLY','12345','verified',10000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010'),
      ('BA-acct-b','TESTB','Test','TEST_ONLY','12346','verified',0,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    // Reversals use the current business date, so open the following dates in this isolated book too.
    await t.db.transaction(tx => createPeriod(tx,actor,{ startsOn:'2026-10-01',endsOn:'2027-12-31',reason:'TEST_ONLY reversal window' },'req_reversal_period'))
    const posted = await t.db.transaction(tx => postManualTransaction(tx,actor,{ bankAccountId:'BA-acct-a',kind:'expense',category:'office',amountMinor:'500',effectiveDate:'2026-09-20' },'req_existing_cash'))
    await t.db.transaction(tx => postCashSource(tx,actor,posted.transactionId,'req_cash_replay'))
    expect((await t.db.query('select id from financial_transactions where id=$1',[posted.transactionId])).length).toBe(1)
    const reversed = await t.db.transaction(tx => reverseTransaction(tx,actor,posted.transactionId,'TEST_ONLY correction','req_cash_reversal'))
    expect(reversed.reversalId).toBeTruthy()
    const transfer = await t.db.transaction(tx => postTransfer(tx,actor,{ fromAccountId:'BA-acct-a',toAccountId:'BA-acct-b',amountMinor:'1000',feeMinor:'10',effectiveDate:'2026-09-21' },'req_transfer_fixture'))
    expect(transfer.transactionIds.length).toBe(3)
    const [clearing] = await t.db.query<{ net:string }>("select sum(debit_minor-credit_minor) as net from accounting_journal_lines where account_code='1190'")
    expect(clearing!.net).toBe('0')
    const [cash] = await t.db.query<{ net:string }>("select sum(debit_minor-credit_minor) as net from accounting_journal_lines where account_code='1100'")
    const [source] = await t.db.query<{ net:string }>("select sum(case when direction='in' then amount_minor else -amount_minor end) as net from financial_transactions where bank_account_id in ('BA-acct-a','BA-acct-b')")
    expect(cash!.net).toBe(source!.net);expect(cash!.net).toBe('-10')
  })
  test('mandatory failure rolls back source/cash/audit; deferred SQL guard blocks an unhooked cash path',async () => {
    await t.db.query("update accounting_books set mode='active'")
    const [before] = await t.db.query<{ count:string }>('select count(*) as count from financial_transactions')
    await expect(t.db.transaction(tx => postManualTransaction(tx,actor,{ bankAccountId:'BA-acct-a',kind:'expense',category:'tax',amountMinor:'20',effectiveDate:'2026-09-25' },'req_no_tax_policy'))).rejects.toThrow('sifat biaya')
    expect((await t.db.query<{ count:string }>('select count(*) as count from financial_transactions'))[0]!.count).toBe(before!.count)
    expect((await t.db.query("select id from audit_events where request_id='req_no_tax_policy'")).length).toBe(0)
    await expect(t.db.transaction(tx => tx.query(`insert into financial_transactions (bank_account_id,direction,amount_minor,currency,kind,effective_date,created_by)
      values ('BA-acct-a','in',1,'IDR','other_income','2026-09-25','USR-010')`))).rejects.toThrow('Mandatory accounting')
    await t.db.query("update accounting_books set mode='shadow'")
  })
  test('period lock serializes with posting, rejects direct SQL and source writes to closed dates; down refuses posted evidence',async () => {
    const results = await Promise.allSettled([
      t.db.transaction(tx => postBusinessEvent(tx,actor,event('RACE-1'),'req_race_post')),
      t.db.transaction(tx => lockRehearsalPeriod(tx,actor,periodId,1,'TEST_ONLY lock','req_race_close'))
    ])
    expect(results[1]!.status).toBe('fulfilled')
    if (results[0]!.status === 'rejected') expect(results[0].reason.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    await expect(t.db.transaction(tx => postBusinessEvent(tx,actor,event('AFTER-LOCK'),'req_closed_post'))).rejects.toThrow('Periode accounting')
    await expect(t.db.transaction(tx => postManualTransaction(tx,actor,{ bankAccountId:'BA-acct-a',kind:'expense',category:'office',amountMinor:'20',effectiveDate:'2026-09-25' },'req_closed_cash'))).rejects.toThrow('Periode accounting')
    await expect(migrateDown(t.db,{ to:44 })).rejects.toThrow()
    expect((await getBook(t.db))!.mode).toBe('shadow')
  })
  test('rehearsal reopen requires owner capability, confirmation version and audit; stale requests are rejected',async () => {
    const body = { version:2,reason:'TEST_ONLY controlled reopen' }
    const path = `/api/v1/accounting/periods/${periodId}/reopen-rehearsal`
    expect((await t.call('POST',path,{ cookie:finance,body:{},headers:{ 'idempotency-key':'reopen-forbidden' } })).status).toBe(403)
    const opts = { cookie:owner,body,headers:{ 'idempotency-key':'reopen-owner-version' } }
    const res = await t.call('POST',path,opts)
    expect(res.status).toBe(200);expect(res.json.data).toEqual({ id:periodId,status:'open',version:3 })
    expect((await t.call('POST',path,opts)).json.data.version).toBe(3)
    expect((await t.call('POST',path,{ ...opts,headers:{ 'idempotency-key':'reopen-stale-version' } })).status).toBe(409)
    expect((await t.db.query("select id from audit_events where action='finance.accounting_rehearsal_period_reopened'")).length).toBe(1)
  })
  test('pending economic event can resolve after a policy version exists without replacing its snapshot or duplicating source',async () => {
    const [prior] = await t.db.query<{ id:string }>("select id from accounting_events where source_id='UNKNOWN-1'")
    await t.db.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,rationale,created_by)
      values ('APL-test-resolution',$1,'payroll',1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only','TEST_ONLY resolving fixture','USR-010')`,[bookId])
    const result = await t.db.transaction(tx => postBusinessEvent(tx,actor,{ ...event('UNKNOWN-1'),policyKind:'payroll' },'req_pending_resolved'))
    expect(result.status).toBe('posted')
    expect((await t.db.query<{ id:string }>("select id from accounting_events where source_id='UNKNOWN-1'"))[0]!.id).toBe(prior!.id)
    expect((await t.db.query<{ status:string }>('select status from accounting_posting_registry where event_id=$1',[prior!.id]))[0]!.status).toBe('posted')
  })
  test('concurrent workers posting the same source with different request keys converge on one journal',async () => {
    const both = await Promise.all([
      t.db.transaction(tx => postBusinessEvent(tx,actor,event('CONCURRENT-SOURCE'),'req_worker_one')),
      t.db.transaction(tx => postBusinessEvent(tx,actor,event('CONCURRENT-SOURCE'),'req_worker_two'))
    ])
    expect(both[0]!.journalId).toBe(both[1]!.journalId)
    const [row] = await t.db.query<{ count:string }>("select count(*) as count from accounting_events where source_id='CONCURRENT-SOURCE'")
    expect(row!.count).toBe('1')
  })
  test('existing accounting book protects user setup/evidence against every demo seed',async () => {
    const [before] = await t.db.query<{ journals:string;cash:string }>('select (select count(*) from accounting_journals) as journals,(select count(*) from financial_transactions) as cash')
    await expect(seedDemo(t.db,{ appEnv:'test' })).rejects.toThrow('non-demo data')
    await expect(seedFinanceDemo(t.db,{ appEnv:'test' })).rejects.toThrow('non-demo data')
    await expect(seedYearDemo(t.db,{ appEnv:'test' })).rejects.toThrow('non-demo data')
    const [after] = await t.db.query<{ journals:string;cash:string }>('select (select count(*) from accounting_journals) as journals,(select count(*) from financial_transactions) as cash')
    expect(after).toEqual(before)
  })
  test('direct Finance API rejects mismatched customer/project with validation and no cash instead of a SQL failure',async () => {
    const [pair] = await t.db.query<{ project_id:string;party_id:string }>(`select p.id as project_id,pa.id as party_id from projects p cross join parties pa
      where pa.id<>p.party_id and not exists (select 1 from sales_order_refs s where s.project_id=p.id and s.party_id=pa.id) order by p.id,pa.id limit 1`)
    const [before] = await t.db.query<{ count:string }>('select count(*) as count from financial_transactions')
    const result = await t.call('POST','/api/v1/finance/transactions',{ cookie:finance,headers:{ 'idempotency-key':'cross-project-source-validation' },body:{
      bankAccountId:'BA-acct-a',kind:'expense',category:'office',amountMinor:'10',effectiveDate:'2026-09-25',projectId:pair!.project_id,partyId:pair!.party_id
    } })
    expect(result.status).toBe(400);expect(result.json.error.fieldErrors.partyId).toBeDefined()
    expect((await t.db.query<{ count:string }>('select count(*) as count from financial_transactions'))[0]!.count).toBe(before!.count)
  })
})
