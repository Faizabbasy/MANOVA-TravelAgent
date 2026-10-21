import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
import {postBusinessEvent} from '../src/modules/accounting/posting'
const M=(n:number)=>(BigInt(n)*1000000n).toString()
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
describe('native order cancellation, refunds and source integration',()=>{
  let t:TestApp,finance:string,admin:string,invoiceA:string,caseA:string,settlement:string
  const call=(method:string,path:string,body?:unknown,cookie=finance,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,key?:string)=>{const r=await call('POST',path,body,finance,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const balance=async(role:string,order?:string)=>(await t.db.query<{n:string}>(`select coalesce(sum(l.debit_minor-l.credit_minor),0) as n from accounting_journal_lines l
    join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code
    where a.control_role=$1 and ($2::text is null or l.sales_order_id=$2)`,[role,order ?? null]))[0]!.n
  beforeAll(async()=>{
    t=await makeTestApp();finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin)
    for(const id of ['SLO-RF-A','SLO-RF-B','SLO-RF-C']) await t.db.query(`insert into sales_order_refs(id,party_id,price_minor,traveler_count,destination,travel_start_date,travel_end_date)
      values ($1,'PTY-001',100000000,1,'TEST_ONLY','2026-11-01','2026-11-02')`,[id])
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-RF','ORDER-RF','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    const b=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY native refund',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))
    for(const kind of ['opening','customer_billing','customer_receipt','customer_allocation','fulfillment','refund']) await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
      values ($1,$2,$3,1,'2026-09-01','principal',$4,'TEST_ONLY_EXCLUDED','test-only',$5::text::jsonb,'TEST_ONLY no production policy','USR-010')`,[`APL-${kind}`,b.id,kind,['customer_billing','fulfillment'].includes(kind)?'fulfillment':'TEST_ONLY',JSON.stringify(kind==='customer_billing'?{billingRight:'unconditional'}:{})])
    await t.db.transaction(tx=>postBusinessEvent(tx,actor,{sourceType:'test_opening',sourceId:'TEST_ONLY',sourceVersion:'1',kind:'opening',effectiveDate:'2026-09-01',snapshot:{amount:M(100)},policyKind:'opening',description:'TEST_ONLY opening',lines:[{accountCode:'1100',bankAccountId:'BA-RF',debitMinor:M(100),creditMinor:'0'},{accountCode:'3100',debitMinor:'0',creditMinor:M(100)}]},'req_opening'))
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
    for(const id of ['SLO-RF-A','SLO-RF-B','SLO-RF-C']) {
      const paid=await post(`/finance/sales-orders/${id}/confirm-dp`,{bankAccountId:'BA-RF',dpAmountMinor:M(30),effectiveDate:'2026-09-02',dueDate:'2026-11-01'})
      if(id==='SLO-RF-A') invoiceA=paid.invoiceId
    }
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('a standalone case uses only its own paid invoices; approval and payout never reduce revenue twice',async()=>{
    const input={subjectType:'sales_order',subjectId:'SLO-RF-A',cancelDate:'2026-10-21',calculation:'manual',proposedRefundMinor:M(20),reason:'TEST_ONLY customer cancellation'}
    const preview=await post('/finance/cancellations/preview',input)
    expect(preview.subject.projectId).toBeNull();expect(preview.maxRefundableMinor).toBe(M(30))
    const r=await post('/finance/cancellations',input,'test-order-refund-case')
    caseA=r.id;expect(r.project).toBeNull();expect(r.salesOrderId).toBe('SLO-RF-A')
    expect((await post('/finance/cancellations',input,'test-order-refund-case')).id).toBe(caseA)
    expect(await balance('receivable','SLO-RF-A')).toBe('0');expect(await balance('receivable','SLO-RF-B')).toBe(M(70))
    await post(`/finance/refunds/${caseA}/approve`,{refundMinor:M(20),note:'TEST_ONLY manual approval'})
    expect(await balance('refund-payable','SLO-RF-A')).toBe('-'+M(20));expect(await balance('service-revenue','SLO-RF-A')).toBe('0')
    expect((await call('POST',`/finance/refunds/${caseA}/settlements`,{bankAccountId:'BA-RF',amountMinor:M(20),effectiveDate:'2026-09-30'})).status).toBe(400)
    const body={bankAccountId:'BA-RF',amountMinor:M(20),effectiveDate:'2026-10-21'}
    const p=await post(`/finance/refunds/${caseA}/settlements`,body,'test-order-refund-cash');settlement=p.transactionId
    expect((await post(`/finance/refunds/${caseA}/settlements`,body,'test-order-refund-cash')).transactionId).toBe(settlement)
    expect(await balance('cash')).toBe(M(170));expect(await balance('refund-payable','SLO-RF-A')).toBe('0')
    expect(await balance('service-revenue','SLO-RF-A')).toBe('0')
    expect((await call('POST','/finance/fulfillments',{side:'customer',salesOrderId:'SLO-RF-A',amountMinor:M(1),fulfilledOn:'2026-10-21',evidence:'TEST_ONLY cannot fulfill canceled billing'})).status).toBe(400)
    const list=(await call('GET','/finance/refunds?view=all&salesOrderId=SLO-RF-A')).json.data
    expect(list.map((r:{id:string})=>r.id)).toEqual([caseA])
  })
  test('settlement reversal then case void restores the exact receivable and deferral without rewriting operational facts',async()=>{
    expect((await call('POST',`/finance/refunds/${caseA}/reject`,{reason:'TEST_ONLY needs cash reversal first'})).status).toBe(422)
    await post(`/finance/transactions/${settlement}/reverse`,{reason:'TEST_ONLY incorrect refund'})
    expect(await balance('refund-payable','SLO-RF-A')).toBe('-'+M(20))
    await post(`/finance/refunds/${caseA}/reject`,{reason:'TEST_ONLY cancellation withdrawn'})
    expect(await balance('receivable','SLO-RF-A')).toBe(M(70));expect(await balance('contract-liability','SLO-RF-A')).toBe('-'+M(100));expect(await balance('refund-payable','SLO-RF-A')).toBe('0')
    expect(await balance('cash')).toBe(M(190))
    expect((await call('GET','/accounting/reports/balance-sheet?asOf=2026-10-21')).json.data.balanced).toBe(true)
  })
  test('operational order cancellation creates one requested case automatically; Admin sees status only and cannot settle',async()=>{
    const r=await call('POST','/sales-orders/SLO-RF-B/status',{to:'cancelled',reason:'TEST_ONLY operational cancellation'},admin)
    expect(r.status,r.text).toBeLessThan(300)
    const list=(await call('GET','/finance/refunds?view=all&salesOrderId=SLO-RF-B',undefined,admin)).json.data
    expect(list).toHaveLength(1);expect(list[0].view).toBe('status');expect(JSON.stringify(list[0])).not.toContain('30000000')
    expect((await call('POST',`/finance/refunds/${list[0].id}/settlements`,{bankAccountId:'BA-RF',amountMinor:M(1),effectiveDate:'2026-10-21'},admin)).status).toBe(403)
    expect((await call('POST',`/finance/customer-invoices/${invoiceA}/debit-notes`,{amountMinor:M(1),reason:'TEST_ONLY allowed after financial void',dueDate:'2026-11-01'})).status).toBe(201)
  })
  test('Group Trip participant refunds stay with the participant customer and never merge into the organiser’s refund',async()=>{
    const [p]=await t.db.query<{id:string}>("select id from projects where is_group_trip order by id limit 1")
    expect(p).toBeTruthy()
    for(const [id,party] of [['SLO-RF-G1','PTY-001'],['SLO-RF-G2','PTY-006']]) {
      await t.db.query(`insert into sales_order_refs(id,project_id,party_id,price_minor,traveler_count) values ($1,$2,$3,100000000,1)`,[id!,p!.id,party!])
      await post(`/finance/sales-orders/${id}/confirm-dp`,{bankAccountId:'BA-RF',dpAmountMinor:M(30),effectiveDate:'2026-09-02',dueDate:'2026-11-01'})
    }
    const whole=await post('/finance/cancellations/preview',{subjectType:'project',subjectId:p!.id,cancelDate:'2026-10-21'})
    expect(whole.blockers.some((b:{code:string})=>b.code==='MULTI_CUSTOMER_CASE_REQUIRED')).toBe(true)
    const r=await post('/finance/cancellations',{subjectType:'sales_order',subjectId:'SLO-RF-G2',calculation:'manual',proposedRefundMinor:M(30),reason:'TEST_ONLY participant cancellation'})
    expect(r.party.id).toBe('PTY-006');expect(r.project.id).toBe(p!.id)
    await post(`/finance/refunds/${r.id}/approve`,{refundMinor:M(30)})
    await post(`/finance/refunds/${r.id}/settlements`,{bankAccountId:'BA-RF',amountMinor:M(30),effectiveDate:'2026-10-21'})
    expect(await balance('refund-payable','SLO-RF-G2')).toBe('0')
    expect(await balance('receivable','SLO-RF-G1')).toBe(M(70))
    expect((await call('GET','/accounting/reports/balance-sheet?asOf=2026-10-21')).json.data.balanced).toBe(true)
  })
})
