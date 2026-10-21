import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
const M=(n:number)=>(BigInt(n)*1000000n).toString()
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}

describe('commercial change source to ordinary invoice drafts',()=>{
  let t:TestApp,finance:string,admin:string,cr:string,plan:string,draft:string,extra:string
  const call=(method:string,path:string,body?:unknown,cookie=finance,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown={},cookie=finance,key?:string)=>{const r=await call('POST',path,body,cookie,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const change=async(n=10)=>post('/projects/PRJ-101/change-requests',{source:'internal',beforeSummary:'TEST_ONLY original service',afterSummary:'TEST_ONLY extra service',commercialImpactMinor:M(n)},admin)
  const value=async()=>(await t.db.query<{n:string}>('select contract_value_minor as n from projects where id=$1',['PRJ-101']))[0]!.n
  const revenue=async()=>(await t.db.query<{n:string}>(`select coalesce(sum(l.credit_minor-l.debit_minor),0) as n from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id and j.status='posted' join accounting_accounts a on a.book_id=l.book_id and a.code=l.account_code where a.account_type='revenue' and l.project_id='PRJ-101'`))[0]!.n
  const fulfill=(n:number)=>post('/finance/fulfillments',{side:'customer',projectId:'PRJ-101',amountMinor:M(n),fulfilledOn:'2026-10-02',evidence:'TEST_ONLY extra delivered'})
  beforeAll(async()=>{
    t=await makeTestApp();finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin)
    await t.db.query("update projects set contract_value_minor=100000000 where id='PRJ-101'")
    const b=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY change billing',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-11-30',reason:'TEST_ONLY window'},'req_period'))
    for(const kind of ['customer_billing','fulfillment','customer_receipt','customer_allocation']) await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by) values ($1,$2,$3,1,'2026-09-01','principal','fulfillment','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY no production policy','USR-010')`,[`APL-${kind}`,b.id,kind,JSON.stringify(kind==='customer_billing'?{billingRight:'unconditional'}:{})])
    await t.db.query(`insert into bank_accounts(id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-CR','CR-TEST','Synthetic','TEST_ONLY','123456','verified',0,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    await t.db.query("update accounting_books set mode='active',entity_type='TEST_ONLY',accounting_standard='TEST_ONLY',opening_validated=true")
    const i=await post('/finance/customer-invoices',{projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-10-28',lines:[{description:'TEST_ONLY base',amountMinor:M(100)}]})
    await post(`/finance/customer-invoices/${i.id}/issue`,{issueDate:'2026-09-01'});await fulfill(100)
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('configuration waits for approval; approval creates one protected draft and amends only its contract',async()=>{
    cr=(await change()).id
    const body={mode:'charge',basis:'commercial',reason:'TEST_ONLY separately approved addition',allocations:[{amountMinor:M(10),dueDate:'2026-10-28'}]}
    const p=await post(`/finance/change-requests/${cr}/billing`,body,finance,'TEST-change-plan')
    expect((await post(`/finance/change-requests/${cr}/billing`,body,finance,'TEST-change-plan')).plans[0].id).toBe(p.plans[0].id)
    plan=p.plans[0].id;expect(p.plans[0].status).toBe('draft');expect(await value()).toBe(M(100))
    await post(`/change-requests/${cr}/review`,{},admin);await post(`/change-requests/${cr}/approve`,{},admin)
    const status=(await call('GET',`/finance/change-requests/${cr}/billing`)).json.data
    expect(status.plans[0].status).toBe('applied');draft=status.plans[0].allocations[0].invoiceId
    expect(await value()).toBe(M(110));expect(await revenue()).toBe(M(100))
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
    expect((await call('DELETE',`/finance/customer-invoices/${draft}`)).status).toBeGreaterThanOrEqual(400)
    await expect(t.db.query('update customer_invoices set total_minor=1 where id=$1',[draft])).rejects.toThrow()
    await expect(t.db.query('update change_requests set commercial_impact_minor=1 where id=$1',[cr])).rejects.toThrow()
  })
  test('issuing the source debit note reclasses fulfilled rights without recognising the service twice',async()=>{
    extra=(await fulfill(10)).id;expect(await revenue()).toBe(M(110))
    const issued=await call('POST',`/finance/customer-invoices/${draft}/issue`,{issueDate:'2026-10-03'})
    expect(issued.status,issued.text).toBeLessThan(300)
    expect(issued.json.data.number).toStartWith('DN-');expect(issued.json.meta.warnings ?? []).toEqual([]);expect(await revenue()).toBe(M(110))
    expect((await call('POST',`/finance/change-billing-plans/${plan}/void`,{reason:'TEST_ONLY correction'})).status).toBeGreaterThanOrEqual(400)
    await post(`/finance/customer-invoices/${draft}/void`,{reason:'TEST_ONLY incorrect addition'})
    expect((await call('POST',`/finance/change-billing-plans/${plan}/void`,{reason:'TEST_ONLY correction'})).status).toBeGreaterThanOrEqual(400)
    await post(`/finance/fulfillments/${extra}/void`,{reason:'TEST_ONLY extra service reversed'})
    await post(`/finance/change-billing-plans/${plan}/void`,{reason:'TEST_ONLY correction'})
    expect(await value()).toBe(M(100));expect(await revenue()).toBe(M(100))
    expect((await t.db.query('select count(*) as n from change_billing_amendments'))[0]!.n).toBe('2')
  })
  test('no charge is explicit; auth, allocation reconciliation and source scope remain enforced',async()=>{
    const c=(await change()).id
    const p=await post(`/finance/change-requests/${c}/billing`,{mode:'no-charge',basis:'none',reason:'TEST_ONLY goodwill approved',allocations:[]})
    await post(`/change-requests/${c}/review`,{},admin);await post(`/change-requests/${c}/approve`,{},admin)
    expect((await call('GET',`/finance/change-requests/${c}/billing`)).json.data.plans[0]).toMatchObject({status:'applied',totalMinor:'0',allocations:[]})
    expect(await value()).toBe(M(100))
    expect((await t.call('GET',`/api/v1/finance/change-requests/${c}/billing`)).status).toBe(401)
    expect((await call('GET',`/finance/change-requests/${c}/billing`,undefined,admin)).status).toBe(403)
    expect((await call('GET','/finance/change-requests/CR-MISSING/billing')).status).toBe(404)
    const other=(await change()).id
    const bad=await call('POST',`/finance/change-requests/${other}/billing`,{mode:'charge',basis:'commercial',reason:'TEST_ONLY allocation mismatch',allocations:[{amountMinor:M(9),dueDate:'2026-10-28'}]})
    expect(bad.status,bad.text).toBe(400)
    expect(p.plans[0].mode).toBe('no-charge')
  })
  test('Group Trip commercial allocations bill each actual participant and amend each order once',async()=>{
    const [p]=await t.db.query<{id:string;contract_value_minor:string|null}>("select id,contract_value_minor from projects where is_group_trip order by id limit 1")
    expect(p).toBeTruthy()
    for(const [id,party] of [['SLO-CR-A','PTY-001'],['SLO-CR-B','PTY-006']]) {
      await t.db.query('insert into sales_order_refs(id,project_id,party_id,price_minor,traveler_count) values ($1,$2,$3,100000000,1)',[id!,p!.id,party!])
      await post(`/finance/sales-orders/${id}/confirm-dp`,{bankAccountId:'BA-CR',dpAmountMinor:M(30),effectiveDate:'2026-09-01',dueDate:'2026-10-28'})
    }
    const c=await post(`/projects/${p!.id}/change-requests`,{source:'internal',beforeSummary:'TEST_ONLY group service',afterSummary:'TEST_ONLY additions split by customer',commercialImpactMinor:M(10)},admin)
    await post(`/change-requests/${c.id}/review`,{},admin);await post(`/change-requests/${c.id}/approve`,{},admin)
    expect((await call('GET',`/finance/change-requests/${c.id}/billing`)).json.data.needsDecision).toBe(true)
    const body={mode:'charge',basis:'commercial',reason:'TEST_ONLY participant-approved split',allocations:[{salesOrderId:'SLO-CR-A',amountMinor:M(3),dueDate:'2026-10-28'},{salesOrderId:'SLO-CR-B',amountMinor:M(7),dueDate:'2026-10-28'}]}
    const r=await post(`/finance/change-requests/${c.id}/billing`,body)
    expect(r.plans[0].allocations.map((a:any)=>[a.partyId,a.amountMinor])).toEqual([['PTY-001',M(3)],['PTY-006',M(7)]])
    for(const a of r.plans[0].allocations) {
      const i=(await call('GET',`/finance/customer-invoices/${a.invoiceId}`)).json.data
      expect(i.changeRequestId).toBe(c.id);expect(i.party.id).toBe(a.partyId);expect(i.salesOrderId).toBe(a.salesOrderId)
      const issued=await call('POST',`/finance/customer-invoices/${a.invoiceId}/issue`,{issueDate:'2026-10-03'})
      expect(issued.status,issued.text).toBeLessThan(300);expect(issued.json.meta.warnings ?? []).toEqual([])
    }
    expect((await t.db.query("select price_minor from sales_order_refs where id in ('SLO-CR-A','SLO-CR-B') order by id")).map(r=>r.price_minor)).toEqual([M(103),M(107)])
    expect((await t.db.query('select contract_value_minor from projects where id=$1',[p!.id]))[0]!.contract_value_minor).toBe(p!.contract_value_minor)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('2') // the two genuine participant DPs only
  })
})
