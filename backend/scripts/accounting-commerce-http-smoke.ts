/** TEST_ONLY commerce HTTP rehearsal. Fixed localhost proxy; refuses non-memory/test/shadow targets. */
const origin='http://localhost:8080'
let cookie=''
async function call(method:string,path:string,body?:unknown,key:string=crypto.randomUUID()) {
  const response=await fetch(`${origin}/api/v1${path}`,{method,signal:AbortSignal.timeout(30000),headers:{origin,cookie,'content-type':'application/json','idempotency-key':key},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const json=await response.json() as any
  console.log(`${method} ${path}: ${response.status}`)
  return {response,json}
}
function check(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message)}
const h=await call('GET','/health')
check(h.json.data.environment==='test' && h.json.data.database.engine==='pglite','Refuse non-test memory server')
const login=await call('POST','/auth/demo-login',{userId:'USR-010'})
cookie=login.response.headers.get('set-cookie')?.split(';')[0] ?? ''
check(cookie,'Synthetic login failed')
const setup=await call('GET','/accounting/setup')
check(setup.json.data.book?.mode==='shadow' && setup.json.data.book?.purpose==='rehearsal','Run initial shadow smoke first; refuse active target')
async function post(path:string,body:unknown={},key?:string){const r=await call('POST',path,body,key);check(r.response.ok,JSON.stringify(r.json));return r.json.data}
const order=await post('/sales-orders',{customerName:'TEST_ONLY HTTP native customer',destination:'TEST_ONLY',travelStartDate:'2026-11-01',travelEndDate:'2026-11-02',travelerCount:1,priceMinor:'100000000'})
check(order.projectId===null,'Native retail must not create a project')
await post(`/finance/sales-orders/${order.id}/confirm-dp`,{bankAccountId:'BA-UAT',dpAmountMinor:'30000000',effectiveDate:'2026-10-21',dueDate:'2026-11-01'})
const fulfillment=await post('/finance/fulfillments',{side:'supplier',salesOrderId:order.id,vendorId:'VND-001',amountMinor:'60000000',fulfilledOn:'2026-10-21',basis:'estimate',isFinal:true,evidence:'TEST_ONLY supplier service'})
check(fulfillment.accountingStatus==='pending','Unknown supplier policy must remain pending')
const invoice=await post('/finance/vendor-invoices',{vendorId:'VND-001',salesOrderId:order.id,vendorInvoiceNumber:`TEST_ONLY-HTTP-${order.id}`,invoiceDate:'2026-10-21',dueDate:'2026-11-01',totalMinor:'70000000'})
await post(`/finance/vendor-invoices/${invoice.id}/review`,{action:'approve'})
const payables=await call('GET',`/finance/payables?view=all&salesOrderId=${order.id}`)
check(payables.json.data.length===1 && payables.json.data[0].id===invoice.id,'Native supplier source missing from existing AP')
await post(`/sales-orders/${order.id}/status`,{to:'cancelled',reason:'TEST_ONLY automatic cancellation source'})
const cases=await call('GET',`/finance/refunds?view=all&salesOrderId=${order.id}`)
check(cases.json.data.length===1,'Operational cancellation must create one Finance case')
const refund=cases.json.data[0]
check(refund.salesOrderId===order.id && refund.project===null,'Refund lost native source')
await post(`/finance/refunds/${refund.id}/approve`,{refundMinor:'20000000'})
await post(`/finance/refunds/${refund.id}/settlements`,{bankAccountId:'BA-UAT',amountMinor:'20000000',effectiveDate:'2026-10-21'})
const cr=await post('/projects/PRJ-101/change-requests',{source:'internal',beforeSummary:'TEST_ONLY original',afterSummary:'TEST_ONLY extra',commercialImpactMinor:'10000000'})
const planBody={mode:'charge',basis:'commercial',reason:'TEST_ONLY agreed commercial addition',allocations:[{amountMinor:'10000000',dueDate:'2026-11-01'}]}
const key:string=crypto.randomUUID()
const plan=await post(`/finance/change-requests/${cr.id}/billing`,planBody,key)
check((await post(`/finance/change-requests/${cr.id}/billing`,planBody,key)).plans[0].id===plan.plans[0].id,'Plan retry duplicated source')
await post(`/change-requests/${cr.id}/review`);await post(`/change-requests/${cr.id}/approve`)
const applied=(await call('GET',`/finance/change-requests/${cr.id}/billing`)).json.data
check(applied.plans[0].status==='applied','Approval did not create linked draft')
const draft=(await call('GET',`/finance/customer-invoices/${applied.plans[0].allocations[0].invoiceId}`)).json.data
check(draft.status==='draft' && draft.changeRequestId===cr.id,'Invoice must retain real CR source')
await post(`/finance/change-billing-plans/${plan.plans[0].id}/void`,{reason:'TEST_ONLY source correction'})
const admin=await call('POST','/auth/demo-login',{userId:'USR-002'})
cookie=admin.response.headers.get('set-cookie')?.split(';')[0] ?? ''
check((await call('GET',`/finance/change-requests/${cr.id}/billing`)).response.status===403,'Admin amounts exposed')
check((await call('GET',`/accounting/orders/${order.id}/summary`)).response.status===403,'Admin accounting exposed')
console.log(JSON.stringify({result:'passed',boundary:'live HTTP through Nuxt proxy -> synthetic PGlite memory',nativeOrder:order.id,sourceOnly:true,policy:'unknown stays pending',crDraft:true,crVoid:true,admin403:true,browserUat:'unverified'},null,2))
export {}
