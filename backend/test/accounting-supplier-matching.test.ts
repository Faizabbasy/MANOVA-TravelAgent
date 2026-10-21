import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
import {migrateDown} from '../src/db/migrator'
import {postBusinessEvent} from '../src/modules/accounting/posting'
const M=(n:number)=>(BigInt(n)*1000000n).toString()
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
describe('explicit supplier receipt matching; no parallel cash ledger',()=>{
  let t:TestApp,finance:string,admin:string,client:string,bookId:string
  const call=(method:string,path:string,body?:unknown,cookie=finance,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,key?:string)=>{const r=await call('POST',path,body,finance,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const balance=async(role:string,order:string,date='2026-10-21')=>(await t.db.query<{n:string}>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.control_role=$1 and l.sales_order_id=$2 and j.effective_date<=$3`,[role,order,date]))[0]!.n
  const receipt=async(order:string,n:number,date='2026-10-02')=>(await post('/finance/fulfillments',{side:'supplier',salesOrderId:order,vendorId:'VND-001',amountMinor:M(n),fulfilledOn:date,basis:'estimate',isFinal:true,evidence:'TEST_ONLY actual supplier delivery'})).id as string
  const invoice=async(order:string,n:number,date='2026-10-03')=>{
    const i=await post('/finance/vendor-invoices',{vendorId:'VND-001',salesOrderId:order,vendorInvoiceNumber:crypto.randomUUID(),invoiceDate:date,dueDate:'2026-11-01',totalMinor:M(n)})
    await post(`/finance/vendor-invoices/${i.id}/review`,{action:'approve'});return i.id as string
  }
  const match=(id:string,f:string,n:number,closesReceipt:boolean,key?:string,postingDate?:string)=>post(`/finance/vendor-invoices/${id}/receipts`,{fulfillmentId:f,actualMinor:M(n),closesReceipt,reason:'TEST_ONLY checked source evidence',...(postingDate?{postingDate}:{})},key)
  beforeAll(async()=>{
    t=await makeTestApp();finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin);client=await t.login(DEMO.client)
    for(const id of ['A','B','C','D','E','F','G','LEGACY','PENDING'])await t.db.query(`insert into sales_order_refs(id,party_id,price_minor,traveler_count,destination,travel_start_date,travel_end_date) values($1,'PTY-001',100000000,1,'TEST_ONLY','2026-10-01','2026-10-02')`,[`SLO-M-${id}`])
    const book=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY receipt matching',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'));bookId=book.id
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-09-30',reason:'TEST_ONLY September'},'req_sep'))
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-10-01',endsOn:'2026-11-30',reason:'TEST_ONLY October'},'req_oct'))
    for(const kind of ['supplier_fulfillment','vendor_billing'])await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      values($1,$2,$3,1,'2026-09-01','principal','supplier-fulfillment','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY not production','USR-010')`,[`APL-M-${kind}`,book.id,kind,JSON.stringify({costMatching:'receipt-links',...(kind==='vendor_billing'?{invoiceTreatment:'prepaid'}:{})})])
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('two partial invoices explicitly replace one final service estimate, not other receipts of the same supplier',async()=>{
    const f=await receipt('SLO-M-A',60),other=await receipt('SLO-M-A',20)
    const a=await invoice('SLO-M-A',30),b=await invoice('SLO-M-A',40)
    expect(await balance('direct-cost','SLO-M-A')).toBe(M(80));expect(await balance('accrued-cost','SLO-M-A')).toBe('-'+M(80))
    const first=await match(a,f,30,false,'matching-partial-key');expect((await match(a,f,30,false,'matching-partial-key')).matches).toEqual(first.matches)
    const owner=await t.login(DEMO.superAdmin)
    const source=await call('GET',`/accounting/sources/vendor_fulfillment_match/${first.matches[0].id}`,undefined,owner)
    expect(source.status,source.text).toBe(200);expect(source.json.data.status).toBe('posted');expect(source.json.data.journals).toHaveLength(1)
    expect(await balance('direct-cost','SLO-M-A')).toBe(M(80));expect(await balance('accrued-cost','SLO-M-A')).toBe('-'+M(50))
    const r=await match(b,f,40,true)
    expect(r.matches[0]).toMatchObject({actualMinor:M(40),estimateMinor:M(30),closesReceipt:true})
    expect(r.receipts.find((s:{id:string})=>s.id===other).remainingMinor).toBe(M(20))
    expect(await balance('direct-cost','SLO-M-A')).toBe(M(90));expect(await balance('prepaid-trip','SLO-M-A')).toBe('0');expect(await balance('accrued-cost','SLO-M-A')).toBe('-'+M(20))
    expect(await balance('payable','SLO-M-A')).toBe('-'+M(70))
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
  })
  test('backdated invoice retains its source date, and matching starts only when both facts exist',async()=>{
    const f=await receipt('SLO-M-B',60),i=await invoice('SLO-M-B',70,'2026-09-30')
    expect(await balance('prepaid-trip','SLO-M-B','2026-09-30')).toBe(M(70));expect(await balance('direct-cost','SLO-M-B','2026-09-30')).toBe('0')
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{fulfillmentId:f,actualMinor:M(70),closesReceipt:true,postingDate:'2026-09-30',reason:'TEST_ONLY too early'})).status).toBe(400)
    const r=await match(i,f,70,true)
    expect(r.matches[0]).toMatchObject({economicDate:'2026-10-02',postingDate:'2026-10-02'})
    expect(await balance('direct-cost','SLO-M-B','2026-10-02')).toBe(M(70));expect(await balance('accrued-cost','SLO-M-B')).toBe('0');expect(await balance('prepaid-trip','SLO-M-B')).toBe('0')
    expect((await t.db.query('select invoice_date from vendor_invoices where id=$1',[i]))[0]!.invoice_date).toBe('2026-09-30')
  })
  test('invoice first and lower actual need explicit last-invoice confirmation; undo restores original facts exactly',async()=>{
    const i=await invoice('SLO-M-C',18),f=await receipt('SLO-M-C',20)
    const r=await match(i,f,18,true),id=r.matches[0].id
    expect(await balance('direct-cost','SLO-M-C')).toBe(M(18));expect(await balance('prepaid-trip','SLO-M-C')).toBe('0');expect(await balance('accrued-cost','SLO-M-C')).toBe('0')
    await post(`/finance/supplier-receipt-matches/${id}/void`,{reason:'TEST_ONLY source mismatch'},'matching-void-key')
    await post(`/finance/supplier-receipt-matches/${id}/void`,{reason:'TEST_ONLY source mismatch'},'matching-void-key')
    expect(await balance('direct-cost','SLO-M-C')).toBe(M(20));expect(await balance('prepaid-trip','SLO-M-C')).toBe(M(18));expect(await balance('accrued-cost','SLO-M-C')).toBe('-'+M(20))
    await match(i,f,18,true)
    await post(`/finance/vendor-invoices/${i}/void`,{reason:'TEST_ONLY supplier corrected invoice'})
    expect(await balance('direct-cost','SLO-M-C')).toBe(M(20));expect(await balance('prepaid-trip','SLO-M-C')).toBe('0');expect(await balance('payable','SLO-M-C')).toBe('0');expect(await balance('accrued-cost','SLO-M-C')).toBe('-'+M(20))
    expect((await call('GET',`/finance/vendor-invoices/${i}/receipts`)).json.data.matches.every((m:{status:string})=>m.status==='void')).toBe(true)
    const i2=await invoice('SLO-M-C',19);await match(i2,f,19,true)
    await post(`/finance/fulfillments/${f}/void`,{reason:'TEST_ONLY service source corrected'})
    expect(await balance('direct-cost','SLO-M-C')).toBe('0');expect(await balance('accrued-cost','SLO-M-C')).toBe('0');expect(await balance('prepaid-trip','SLO-M-C')).toBe(M(19))
  })
  test('capabilities, source scope, SQL guards, exact strings and closed-period rollback',async()=>{
    const f=await receipt('SLO-M-D',20),foreign=await receipt('SLO-M-E',20),i=await invoice('SLO-M-D',25)
    const body={fulfillmentId:f,actualMinor:M(25),closesReceipt:true,reason:'TEST_ONLY matching scope'}
    expect((await call('GET',`/finance/vendor-invoices/${i}/receipts`,undefined,'')).status).toBe(401)
    expect((await call('GET',`/finance/vendor-invoices/${i}/receipts`,undefined,admin)).status).toBe(403)
    expect((await call('GET',`/finance/vendor-invoices/${i}/receipts`,undefined,client)).status).toBe(403)
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,body,admin)).status).toBe(403)
    expect((await call('POST','/finance/vendor-invoices/MISSING/receipts',body)).status).toBe(404)
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{...body,fulfillmentId:'MISSING'})).status).toBe(404)
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{...body,fulfillmentId:foreign})).status).toBe(400)
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{...body,closesReceipt:false})).status).toBe(400)
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{...body,actualMinor:'25000000.1'})).status).toBe(400)
    await t.db.query("update accounting_periods set status='closed' where starts_on='2026-10-01'")
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,body)).json.error.code).toBe('ACCOUNTING_PERIOD_LOCKED')
    expect((await t.db.query('select count(*) as n from vendor_fulfillment_matches where vendor_invoice_id=$1',[i]))[0]!.n).toBe('0')
    await t.db.query("update accounting_periods set status='open' where starts_on='2026-10-01'")
    const r=await match(i,f,25,true),id=r.matches[0].id
    await expect(t.db.query("update vendor_fulfillment_matches set actual_minor=1 where id=$1",[id])).rejects.toThrow()
    await expect(t.db.query('delete from vendor_fulfillment_matches where id=$1',[id])).rejects.toThrow()
    await expect(t.db.query("update vendor_invoices set status='void',void_reason='TEST_ONLY SQL bypass' where id=$1",[i])).rejects.toThrow()
    await expect(migrateDown(t.db,{to:58})).rejects.toThrow()
    const i2=await invoice('SLO-M-D',1)
    await expect(t.db.query(`insert into vendor_fulfillment_matches(id,vendor_invoice_id,fulfillment_id,actual_minor,estimate_minor,closes_receipt,economic_date,posting_date,reason,created_by) values('VFM-SQL-BAD',$1,$2,1,1,true,'2026-10-03','2026-10-03','TEST_ONLY exceeds receipt','USR-010')`,[i2,f])).rejects.toThrow()
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,body)).status).toBe(400)
  })
  test('direct SQL cannot insert or void a match without its mandatory journal in the same transaction',async()=>{
    const f=await receipt('SLO-M-G',20),i=await invoice('SLO-M-G',25)
    await expect(t.db.query(`insert into vendor_fulfillment_matches(id,vendor_invoice_id,fulfillment_id,actual_minor,estimate_minor,closes_receipt,economic_date,posting_date,reason,created_by)
      values('VFM-SQL-UNPOSTED',$1,$2,1000000,1000000,false,'2026-10-03','2026-10-03','TEST_ONLY missing journal','USR-010')`,[i,f])).rejects.toThrow('Mandatory accounting supplier matching')
    expect((await t.db.query("select count(*) as n from vendor_fulfillment_matches where id='VFM-SQL-UNPOSTED'"))[0]!.n).toBe('0')
    const r=await match(i,f,25,true),id=r.matches[0].id
    await expect(t.db.query("update vendor_fulfillment_matches set status='void',void_reason='TEST_ONLY SQL missing reversal',voided_by='USR-010',voided_at=now() where id=$1",[id])).rejects.toThrow('Mandatory accounting supplier matching')
    expect((await t.db.query('select status from vendor_fulfillment_matches where id=$1',[id]))[0]!.status).toBe('recorded')
    expect(await balance('direct-cost','SLO-M-G')).toBe(M(25))
  })
  test('project, company report and monthly review keep unmatched estimates visible despite an approved invoice',async()=>{
    const f=await post('/finance/fulfillments',{side:'supplier',projectId:'PRJ-101',vendorId:'VND-001',amountMinor:M(60),fulfilledOn:'2026-10-02',basis:'estimate',isFinal:true,evidence:'TEST_ONLY project service actually received'})
    const i=await post('/finance/vendor-invoices',{vendorId:'VND-001',projectId:'PRJ-101',vendorInvoiceNumber:'TEST_ONLY PROJECT MATCH',invoiceDate:'2026-10-03',dueDate:'2026-11-01',totalMinor:M(70)})
    await post(`/finance/vendor-invoices/${i.id}/review`,{action:'approve'})
    const a=(await call('GET','/accounting/projects/PRJ-101/summary')).json.data
    expect(a.accountingReview.estimateCount).toBe(1);expect(a.figures.estimatedFinalCostMinor).toBeNull()
    expect(a.reasons.map((r:{code:string})=>r.code)).toContain('SUPPLIER_MATCH_REQUIRED')
    const pnl=(await call('GET','/accounting/reports/profit-loss?from=2026-09-01&to=2026-10-21')).json.data
    expect(pnl.reasons.map((r:{code:string})=>r.code)).toContain('ACCRUAL_UNMATCHED')
    const [period]=await t.db.query<{id:string}>("select id from accounting_periods where starts_on='2026-10-01'")
    const review=(await call('GET',`/accounting/periods/${period!.id}/review`)).json.data
    expect(review.checks.find((c:{code:string})=>c.code==='ACCRUALS').status).toBe('warning')
    await match(i.id,f.id,70,true)
    const b=(await call('GET','/accounting/projects/PRJ-101/summary')).json.data
    expect(b.accountingReview.estimateCount).toBe(0);expect(b.figures.recognizedDirectCostMinor).toBe(M(70))
    expect(b.reasons.map((r:{code:string})=>r.code)).not.toContain('SUPPLIER_MATCH_REQUIRED')
  })
  test('a paid invoice cannot void its matches; the existing payment must be reversed first',async()=>{
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values('BA-MATCH','MATCH','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    for(const kind of ['opening','vendor_payment','vendor_allocation'])await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,rationale,created_by)
      values($1,$2,$3,1,'2026-09-01','not-applicable','TEST_ONLY','TEST_ONLY_EXCLUDED','test-only','TEST_ONLY payment fixture','USR-010')`,[`APL-M-${kind}`,bookId,kind])
    await t.db.transaction(tx=>postBusinessEvent(tx,actor,{sourceType:'test_opening',sourceId:'MATCH',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',snapshot:{amount:M(100)},policyKind:'opening',description:'TEST_ONLY opening',lines:[{accountCode:'1100',bankAccountId:'BA-MATCH',debitMinor:M(100),creditMinor:'0'},{accountCode:'3100',debitMinor:'0',creditMinor:M(100)}]},'req_opening'))
    const f=await receipt('SLO-M-F',20),i=await invoice('SLO-M-F',25),r=await match(i,f,25,true),id=r.matches[0].id
    const payment=await post('/finance/vendor-payments',{bankAccountId:'BA-MATCH',vendorId:'VND-001',amountMinor:M(25),effectiveDate:'2026-10-03',allocations:[{vendorInvoiceId:i,amountMinor:M(25)}]})
    expect((await call('POST',`/finance/vendor-invoices/${i}/void`,{reason:'TEST_ONLY paid invoice refusal'})).status).toBe(422)
    expect((await t.db.query('select status from vendor_fulfillment_matches where id=$1',[id]))[0]!.status).toBe('recorded')
    expect(await balance('direct-cost','SLO-M-F')).toBe(M(25));expect(await balance('payable','SLO-M-F')).toBe('0')
    await post(`/finance/transactions/${payment.transactionId}/reverse`,{reason:'TEST_ONLY payment corrected'})
    await post(`/finance/vendor-invoices/${i}/void`,{reason:'TEST_ONLY invoice corrected'})
    expect(await balance('direct-cost','SLO-M-F')).toBe(M(20));expect(await balance('payable','SLO-M-F')).toBe('0')
    expect((await t.db.query('select status from vendor_fulfillment_matches where id=$1',[id]))[0]!.status).toBe('void')
  })
  test('legacy posted sources cannot be silently reclassified by changing the current policy',async()=>{
    await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      select id||'-legacy-v2',book_id,source_kind,2,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings-'costMatching','TEST_ONLY legacy fixture',created_by from accounting_policies where book_id=$1 and version=1 and source_kind in ('supplier_fulfillment','vendor_billing')`,[bookId])
    const f=await receipt('SLO-M-LEGACY',20),i=await invoice('SLO-M-LEGACY',18)
    expect(await balance('direct-cost','SLO-M-LEGACY')).toBe(M(18))
    await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      select id||'-v3',book_id,source_kind,3,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings||'{"costMatching":"receipt-links"}'::jsonb,'TEST_ONLY new policy',created_by from accounting_policies where book_id=$1 and version=2`,[bookId])
    expect((await call('POST',`/finance/vendor-invoices/${i}/receipts`,{fulfillmentId:f,actualMinor:M(18),closesReceipt:true,reason:'TEST_ONLY legacy rejected'})).status).toBe(400)
    expect(await balance('direct-cost','SLO-M-LEGACY')).toBe(M(18))
    expect((await t.db.query('select count(*) as n from vendor_fulfillment_matches where vendor_invoice_id=$1',[i]))[0]!.n).toBe('0')
  })
  test('draft configuration remains unknown or explicit, never activates a policy',async()=>{
    const owner=await t.login(DEMO.superAdmin)
    const r=await call('POST','/accounting/policies',{sourceKind:'vendor_billing',effectiveFrom:'2026-10-21',principalAgent:'unknown',recognition:'unknown',taxTreatment:'unknown',rationale:'TEST_ONLY owner proposal',settings:{costMatching:'receipt-links',invoiceTreatment:'prepaid'}},owner)
    expect(r.status,r.text).toBe(200);expect(r.json.data.validationStatus).toBe('draft')
    const p=(await t.db.query('select * from accounting_policies where id=$1',[r.json.data.id]))[0]!
    expect(p.settings).toEqual({costMatching:'receipt-links',invoiceTreatment:'prepaid'});expect(p.principal_agent).toBe('unknown')
    expect((await call('POST','/accounting/policies',{sourceKind:'payroll',effectiveFrom:'2026-10-21',principalAgent:'unknown',recognition:'unknown',taxTreatment:'unknown',rationale:'TEST_ONLY invalid option',settings:{costMatching:'receipt-links'}},owner)).status).toBe(400)
  })
})
