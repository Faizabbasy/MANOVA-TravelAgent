import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { createBook,createPeriod } from '../src/modules/accounting/setup'
import { postBusinessEvent } from '../src/modules/accounting/posting'
const M=(n:number)=>(BigInt(n)*1000000n).toString()
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
describe('recurring company expense -> accrual -> genuine invoice -> existing supplier payment',()=>{
  let t:TestApp,finance:string,admin:string,schedule:string,expense:string,invoice:string,period:string
  const call=(method:string,path:string,body?:unknown,key:string=crypto.randomUUID(),cookie=finance)=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,key?:string)=>{const r=await call('POST',path,body,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const bal=async(role:string)=>(await t.db.query<{n:string}>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code where a.control_role=$1`,[role]))[0]!.n
  beforeAll(async()=>{
    t=await makeTestApp();finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin)
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-OFFICE','OFFICE','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const b=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY recurring',purpose:'rehearsal',cutoverDate:'2026-08-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    period=(await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-08-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))).id
    for(const kind of ['company_expense','opening','vendor_payment','vendor_allocation']) await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      values ($1,$2,$3,1,'2026-08-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY no production policy','USR-010')`,[`APL-${kind}`,b.id,kind,JSON.stringify(kind==='company_expense'?{classifications:{office:'office-expense'}}:{})])
    await t.db.transaction(tx=>postBusinessEvent(tx,actor,{sourceType:'test_opening',sourceId:'TEST_ONLY',sourceVersion:'1',kind:'opening',effectiveDate:'2026-08-01',snapshot:{amount:M(100)},policyKind:'opening',description:'TEST_ONLY opening',
      lines:[{accountCode:'1100',bankAccountId:'BA-OFFICE',debitMinor:M(100),creditMinor:'0'},{accountCode:'3100',debitMinor:'0',creditMinor:M(100)}]},'req_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('contract plans create neither invoices, expense nor cash; source/month is unique',async()=>{
    const input={vendorId:'VND-001',description:'TEST_ONLY rent',contractRef:'TEST-CONTRACT-01',category:'office',amountMinor:M(10),startMonth:'2026-09',months:3,dueDay:28}
    schedule=(await post('/finance/company-expense-schedules',input,'contract-1')).id
    expect((await post('/finance/company-expense-schedules',input,'contract-1')).id).toBe(schedule)
    expect((await call('POST','/finance/company-expense-schedules',input)).status).toBe(409)
    expect(await bal('office-expense')).toBe('0');expect(await bal('cash')).toBe(M(100))
    expect((await t.db.query('select count(*) as n from vendor_invoices'))[0]!.n).toBe('0')
    const rows=await t.db.query<{amount_minor:string}>('select amount_minor from v_company_expense_forecast')
    expect(rows.map(r=>r.amount_minor)).toEqual([M(10),M(10),M(10)])
    const p=(await call('GET','/accounting/reports/profit-loss?from=2026-09-01&to=2026-09-30')).json.data
    expect(p.reasons.some((r:{code:string})=>r.code==='RECURRING_REVIEW_REQUIRED')).toBe(true)
    const inputExpense={scheduleId:schedule,period:'2026-09',incurredOn:'2026-09-30',evidenceRef:'TEST-SEPT-DELIVERY',basis:'estimate'}
    const workers=await Promise.all([call('POST','/finance/company-expenses',inputExpense),call('POST','/finance/company-expenses',inputExpense)])
    expect(workers.map(r=>r.status).sort()).toEqual([201,409]);expense=workers.find(r=>r.status===201)!.json.data.id
    expect(await bal('company-accrued')).toBe('-'+M(10));expect(await bal('office-expense')).toBe(M(10));expect(await bal('accrued-cost')).toBe('0')
    expect((await t.db.query('select count(*) as n from v_company_expense_forecast'))[0]!.n).toBe('3')
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
  })
  test('actual invoice 12 replaces estimate 10; payment 12 settles AP without a second expense or cash source',async()=>{
    invoice=(await post('/finance/vendor-invoices',{vendorId:'VND-001',vendorInvoiceNumber:'TEST-OFFICE-ACTUAL',invoiceDate:'2026-10-01',dueDate:'2026-10-28',totalMinor:M(12)})).id
    const match=await post(`/finance/company-expenses/${expense}/invoice`,{vendorInvoiceId:invoice},'match-001')
    expect((await post(`/finance/company-expenses/${expense}/invoice`,{vendorInvoiceId:invoice},'match-001')).vendorInvoiceId).toBe(match.vendorInvoiceId)
    expect(await bal('company-accrued')).toBe('0');expect(await bal('office-expense')).toBe(M(12));expect(await bal('payable')).toBe('-'+M(12));expect(await bal('prepaid-trip')).toBe('0')
    expect((await t.db.query('select count(*) as n from v_company_expense_forecast'))[0]!.n).toBe('2')
    const cf=(await call('GET','/finance/cash-flow?horizon=3m')).json.data
    expect(JSON.stringify(cf)).toContain('company_expense')
    await post('/finance/vendor-payments',{bankAccountId:'BA-OFFICE',vendorId:'VND-001',amountMinor:M(12),effectiveDate:'2026-10-02',allocations:[{vendorInvoiceId:invoice,amountMinor:M(12)}]})
    expect(await bal('payable')).toBe('0');expect(await bal('cash')).toBe(M(88));expect(await bal('office-expense')).toBe(M(12))
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('1')
    expect((await call('POST',`/finance/company-expenses/${expense}/void`,{reason:'TEST_ONLY cannot bypass invoice'})).status).toBe(400)
    expect((await call('GET','/accounting/reports/balance-sheet?asOf=2026-10-21')).json.data.balanced).toBe(true)
  })
  test('correction voids exact invoice first then expense; stop affects plans without touching posted obligations',async()=>{
    const e=await post('/finance/company-expenses',{vendorId:'VND-001',description:'TEST_ONLY utility',category:'office',amountMinor:M(5),incurredOn:'2026-09-30',dueDate:'2026-10-20',evidenceRef:'TEST-UTILITY',basis:'actual'})
    const i=(await post('/finance/vendor-invoices',{vendorId:'VND-001',vendorInvoiceNumber:'TEST-UTILITY-ACTUAL',invoiceDate:'2026-10-01',dueDate:'2026-10-28',totalMinor:M(4)})).id
    await post(`/finance/company-expenses/${e.id}/invoice`,{vendorInvoiceId:i})
    expect(await bal('office-expense')).toBe(M(16))
    await post(`/finance/vendor-invoices/${i}/void`,{reason:'TEST_ONLY wrong invoice'})
    expect(await bal('office-expense')).toBe(M(17));expect(await bal('company-accrued')).toBe('-'+M(5))
    await post(`/finance/company-expenses/${e.id}/void`,{reason:'TEST_ONLY wrong evidence'})
    expect(await bal('office-expense')).toBe(M(12));expect(await bal('company-accrued')).toBe('0')
    await post(`/finance/company-expense-schedules/${schedule}/stop`,{fromMonth:'2026-10',reason:'TEST_ONLY contract terminated'})
    expect((await t.db.query('select count(*) as n from v_company_expense_forecast'))[0]!.n).toBe('0')
    expect((await call('GET',`/accounting/periods/${period}/review`)).json.data.checks.find((c:{code:string})=>c.code==='RECURRING_REVIEW').status).toBe('ok')
    await expect(t.db.query('update company_expenses set amount_minor=1 where id=$1',[expense])).rejects.toThrow('immutable')
    await expect(t.db.transaction(tx=>tx.query(`insert into company_expenses(id,vendor_id,description,category,amount_minor,incurred_on,due_date,evidence_ref,basis,created_by)
      values ('COX-SQL','VND-001','TEST_ONLY bypass','office',1,'2026-10-01','2026-10-28','TEST-SQL','actual','USR-010')`))).rejects.toThrow('Mandatory company expense posting')
  })
  test('auth, scope, unknown policy and closed period reject safely without new facts',async()=>{
    expect((await t.call('POST','/api/v1/finance/company-expenses',{body:{}})).status).toBe(401)
    expect((await call('POST','/finance/company-expenses',{},'admin',admin)).status).toBe(403)
    expect((await call('GET','/finance/company-expenses',undefined,'adminread',admin)).status).toBe(403)
    expect((await call('POST','/finance/company-expenses/MISSING/void',{reason:'TEST_ONLY missing'})).status).toBe(404)
    const body={vendorId:'VND-001',description:'TEST_ONLY utility',category:'utilities',amountMinor:M(1),incurredOn:'2026-10-01',dueDate:'2026-10-20',evidenceRef:'TEST-UNKNOWN',basis:'actual'}
    expect((await call('POST','/finance/company-expenses',body)).status).toBe(422)
    expect((await t.db.query("select 1 from company_expenses where evidence_ref='TEST-UNKNOWN'")).length).toBe(0)
    const e=await post('/finance/company-expenses',{...body,category:'office',incurredOn:'2026-09-30',evidenceRef:'TEST-INVOICE-ROLLBACK'})
    const i=await post('/finance/vendor-invoices',{vendorId:'VND-001',vendorInvoiceNumber:'TEST-POLICY-ROLLBACK',invoiceDate:'2026-10-02',dueDate:'2026-10-28',totalMinor:M(1)})
    const [book]=await t.db.query<{id:string}>('select id from accounting_books')
    await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      values ('APL-company-v2',$1,'company_expense',2,'2026-10-02','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only','{}'::jsonb,'TEST_ONLY unknown revision','USR-010')`,[book!.id])
    expect((await call('POST',`/finance/company-expenses/${e.id}/invoice`,{vendorInvoiceId:i.id})).status).toBe(422)
    expect((await t.db.query('select status from vendor_invoices where id=$1',[i.id]))[0]!.status).toBe('submitted')
    expect((await t.db.query('select 1 from company_expense_invoice_links where vendor_invoice_id=$1',[i.id])).length).toBe(0)
    await t.db.query("update accounting_periods set status='closed' where id=$1",[period])
    expect((await call('POST','/finance/company-expenses',{...body,category:'office'})).status).toBe(422)
    expect((await t.db.query("select 1 from company_expenses where evidence_ref='TEST-UNKNOWN'")).length).toBe(0)
  })
})

describe('company expense crossing cutover and unknown policy',()=>{
  test('opening carries the prior expense accrual; a later actual invoice posts only the difference, without replaying cash',async()=>{
    const t=await makeTestApp()
    try {
      const finance=await t.login(DEMO.finance),owner=await t.login(DEMO.superAdmin)
      const call=(cookie:string,method:string,path:string,body?:unknown)=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':crypto.randomUUID()}})
      const post=async(path:string,body:unknown,cookie=finance)=>{const r=await call(cookie,'POST',path,body);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
      await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
        values ('BA-OFFICE','OFFICE','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-08-01','USR-001',now(),'USR-010',now(),'USR-010')`)
      const s=await post('/finance/company-expense-schedules',{vendorId:'VND-001',description:'TEST_ONLY prior rent',contractRef:'TEST-PRIOR-CONTRACT',category:'office',amountMinor:M(5),startMonth:'2026-08',months:1,dueDay:28})
      const book=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY office opening',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
      await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))
      for(const kind of ['opening','company_expense']) await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ($1,$2,$3,1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY','USR-010')`,[`APL-${kind}`,book.id,kind,JSON.stringify(kind==='company_expense'?{classifications:{office:'office-expense'}}:{})])
      const missing=(await call(finance,'GET','/accounting/opening-plan')).json.data
      expect(missing.exceptions.some((e:{code:string})=>e.code==='RECURRING_REVIEW_REQUIRED')).toBe(true)
      const e=await post('/finance/company-expenses',{scheduleId:s.id,period:'2026-08',incurredOn:'2026-08-31',evidenceRef:'TEST-PRIOR-DELIVERY',basis:'estimate'})
      const decisions={equity:{capitalMinor:M(100)}}
      const p=await post('/accounting/opening-plan/preview',{decisions},owner)
      expect(p.items.find((i:{role:string})=>i.role==='company-accrued')).toMatchObject({amountMinor:M(5),sourceType:'company_expense',sourceId:e.id})
      expect(p.undecided).toHaveLength(0);expect(p.exceptions).toHaveLength(0)
      await post('/accounting/opening-plan/confirm',{planHash:p.planHash,decisions,reason:'TEST_ONLY evidence at cutover'},owner)
      await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY'")
      const i=await post('/finance/vendor-invoices',{vendorId:'VND-001',vendorInvoiceNumber:'TEST-PRIOR-ACTUAL',invoiceDate:'2026-09-01',dueDate:'2026-09-28',totalMinor:M(6)})
      await post(`/finance/company-expenses/${e.id}/invoice`,{vendorInvoiceId:i.id})
      const balances=await t.db.query<{control_role:string;n:string}>(`select a.control_role,sum(l.debit_minor-l.credit_minor) as n from accounting_journal_lines l
        join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code group by a.control_role`)
      const balance=(role:string)=>balances.find(b=>b.control_role===role)?.n ?? '0'
      expect(balance('company-accrued')).toBe('0');expect(balance('payable')).toBe('-'+M(6));expect(balance('office-expense')).toBe(M(1));expect(balance('cash')).toBe(M(100))
      expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
      expect((await call(finance,'GET','/accounting/trial-balance?asOf=2026-10-21')).json.data.balanced).toBe(true)
    } finally {await t.cleanup()}
  },60000)
  test('unknown classification remains pending; retry uses the same immutable source after a TEST_ONLY policy is configured',async()=>{
    const t=await makeTestApp()
    try {
      const finance=await t.login(DEMO.finance),owner=await t.login(DEMO.superAdmin)
      const call=(path:string,body:unknown,key:string=crypto.randomUUID())=>t.call('POST',`/api/v1${path}`,{cookie:path.startsWith('/accounting/') ? owner : finance,body,headers:{'idempotency-key':key}})
      const book=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY office pending',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
      await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))
      const input={vendorId:'VND-001',description:'TEST_ONLY office pending',category:'office',amountMinor:M(5),incurredOn:'2026-09-30',dueDate:'2026-10-20',evidenceRef:'TEST-PENDING',basis:'actual'}
      const r=await call('/finance/company-expenses',input,'pending-source-1')
      expect(r.status,r.text).toBe(201);expect(r.json.data.accountingStatus).toBe('pending')
      expect((await call('/finance/company-expenses',input,'pending-source-1')).json.data.id).toBe(r.json.data.id)
      expect((await t.db.query('select count(*) as n from accounting_journals'))[0]!.n).toBe('0')
      await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
        values ('APL-company',$1,'company_expense',1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only','{"classifications":{"office":"office-expense"}}'::jsonb,'TEST_ONLY','USR-010')`,[book.id])
      const [event]=await t.db.query<{id:string}>("select id from accounting_events where source_type='company_expense' and source_id=$1",[r.json.data.id])
      const retry=await call(`/accounting/exceptions/${event!.id}/retry`,{},'pending-retry-1')
      expect(retry.status,retry.text).toBe(200);expect(retry.json.data.status).toBe('posted')
      expect((await call(`/accounting/exceptions/${event!.id}/retry`,{},'pending-retry-1')).json.data.status).toBe('posted')
      expect((await t.db.query('select count(*) as n from company_expenses'))[0]!.n).toBe('1')
      expect((await t.db.query('select count(*) as n from accounting_journals'))[0]!.n).toBe('1')
      expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
    } finally {await t.cleanup()}
  },60000)
})
