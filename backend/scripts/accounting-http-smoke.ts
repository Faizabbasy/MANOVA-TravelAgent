/** Exercises a LIVE isolated server through the real Nuxt proxy. Never points at a configurable/remote host. */
const origin = 'http://localhost:8080'
async function call(path:string,options:{ method?:string;body?:unknown;cookie?:string;key?:string }={}) {
  console.log(`Checking ${options.method ?? 'GET'} ${path}`)
  const response = await fetch(`${origin}/api/v1${path}`,{ method:options.method ?? 'GET',
    signal:AbortSignal.timeout(30_000),
    headers:{ origin,...(options.body ? { 'content-type':'application/json' } : {}),...(options.cookie ? { cookie:options.cookie } : {}),...(options.key ? { 'idempotency-key':options.key } : {}) },
    ...(options.body ? { body:JSON.stringify(options.body) } : {}) })
  const json = await response.json() as any
  console.log(`HTTP ${response.status} ${path}`)
  return { status:response.status,json,cookie:response.headers.get('set-cookie')?.split(';')[0] }
}
const check = (ok:unknown,message:string) => { if (!ok) throw new Error(message) }
const health = await call('/health')
check(health.status===200 && health.json.data.environment==='test' && health.json.data.database.engine==='pglite','Refuse: target must be the fresh TEST PGlite rehearsal server, healthy with no migration drift.')
check((await call('/accounting/setup')).status===401,'Anonymous access must fail.')
const owner = await call('/auth/demo-login',{ method:'POST',body:{ userId:'USR-010' } })
check(owner.cookie,'Synthetic owner login failed.')
const initial = await call('/accounting/setup',{ cookie:owner.cookie })
check(initial.json.data.book===null,'Refuse: this smoke test needs the empty UAT profile, never an existing book.')
const key = crypto.randomUUID()
const body = { name:'TEST_ONLY HTTP rehearsal',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta' }
const created = await call('/accounting/setup',{ method:'POST',body,cookie:owner.cookie,key })
check(created.status===200 && created.json.data.mode==='shadow','Setup must create shadow only.')
check((await call('/accounting/setup',{ method:'POST',body,cookie:owner.cookie,key })).json.data.id===created.json.data.id,'Setup retry duplicated a book.')
const period = await call('/accounting/periods',{ method:'POST',cookie:owner.cookie,key:crypto.randomUUID(),body:{ startsOn:'2026-09-01',endsOn:'2026-12-31',reason:'TEST_ONLY HTTP UAT' } })
check(period.status===200,'Period create failed.')
const cash = await call('/finance/transactions',{ method:'POST',cookie:owner.cookie,key:crypto.randomUUID(),body:{ bankAccountId:'BA-UAT',kind:'expense',category:'office',amountMinor:'5000',effectiveDate:'2026-10-21',memo:'TEST_ONLY HTTP, no external money' } })
check(cash.status===200 || cash.status===201,'Existing source cash command failed.')
const status = await call(`/accounting/sources/financial_transaction/${cash.json.data.transactionId}`,{ cookie:owner.cookie })
check(status.json.data.status==='pending','Unknown policy must be pending, not fake posted.')
const balance = await call('/accounting/trial-balance?asOf=2026-10-21',{ cookie:owner.cookie })
check(balance.json.data.netProfitMinor===null && balance.json.data.reasons.some((r:any) => r.code==='SOURCE_PENDING'),'Missing facts must be visible and after-tax profit unavailable.')
// Office prepayment: one source payment plus an exact service schedule, never a second payment at amortisation.
const prepaidBody = { bankAccountId:'BA-UAT',amountMinor:'9000000',effectiveDate:'2026-09-01',description:'TEST_ONLY HTTP rent',
  evidenceRef:'TEST_ONLY-HTTP-RENT',startMonth:'2026-09',months:3,method:'equal-months' }
const prepaidKey = crypto.randomUUID()
const prepaid = await call('/finance/prepaid-expenses',{method:'POST',cookie:owner.cookie,key:prepaidKey,body:prepaidBody})
check(prepaid.status===201 && prepaid.json.data.accountingStatus==='pending','Prepaid source must be pending while policy is unknown.')
check((await call('/finance/prepaid-expenses',{method:'POST',cookie:owner.cookie,key:prepaidKey,body:prepaidBody})).json.data.transactionId===prepaid.json.data.transactionId,'Prepaid retry must return the same cash source.')
const amortization = await call('/finance/prepaid-amortization-runs',{method:'POST',cookie:owner.cookie,key:crypto.randomUUID(),body:{throughPeriod:'2026-09'}})
check(amortization.status===200 && amortization.json.data.booked[0]?.amountMinor==='3000000','Completed office service month must be exact, with posting visibly pending.')
const prepaidList = await call('/finance/prepaid-expenses?asOf=2026-10-21',{cookie:owner.cookie})
check(prepaidList.json.data.items.length===1 && prepaidList.json.data.items[0].remainingMinor==='6000000','Source schedule must survive the real proxy/read boundary.')
// Recurring office source: plan -> incurred -> real vendor invoice. Unknown policies remain pending in shadow.
const scheduleBody={vendorId:'VND-001',description:'TEST_ONLY HTTP recurring office',contractRef:'TEST_ONLY-HTTP-RECURRING',category:'office',amountMinor:'10000000',startMonth:'2026-10',months:3,dueDay:28}
const scheduleKey=crypto.randomUUID()
const schedule=await call('/finance/company-expense-schedules',{method:'POST',cookie:owner.cookie,key:scheduleKey,body:scheduleBody})
check(schedule.status===201,'Recurring plan failed through the proxy.')
check((await call('/finance/company-expense-schedules',{method:'POST',cookie:owner.cookie,key:scheduleKey,body:scheduleBody})).json.data.id===schedule.json.data.id,'Recurring contract retry duplicated a source.')
const expenseBody={scheduleId:schedule.json.data.id,period:'2026-10',incurredOn:'2026-10-21',evidenceRef:'TEST_ONLY-HTTP-OFFICE-DELIVERY',basis:'estimate'}
const expenseKey=crypto.randomUUID()
const expense=await call('/finance/company-expenses',{method:'POST',cookie:owner.cookie,key:expenseKey,body:expenseBody})
check(expense.status===201 && expense.json.data.accountingStatus==='pending','Unconfigured office classification must remain pending.')
check((await call('/finance/company-expenses',{method:'POST',cookie:owner.cookie,key:expenseKey,body:expenseBody})).json.data.id===expense.json.data.id,'Incurred expense retry duplicated its source.')
const vendorInvoice=await call('/finance/vendor-invoices',{method:'POST',cookie:owner.cookie,key:crypto.randomUUID(),body:{vendorId:'VND-001',vendorInvoiceNumber:'TEST_ONLY-HTTP-OFFICE-INVOICE',invoiceDate:'2026-10-21',dueDate:'2026-10-28',totalMinor:'12000000'}})
check(vendorInvoice.status===201,'Genuine vendor invoice source failed.')
const matched=await call(`/finance/company-expenses/${expense.json.data.id}/invoice`,{method:'POST',cookie:owner.cookie,key:crypto.randomUUID(),body:{vendorInvoiceId:vendorInvoice.json.data.id}})
check(matched.status===200,'Existing invoice matching failed.')
const workspace=await call('/finance/company-expenses',{cookie:owner.cookie})
check(workspace.status===200 && workspace.json.data.items[0]?.invoiceId===vendorInvoice.json.data.id && workspace.json.data.schedules[0]?.id===schedule.json.data.id,'Company source links did not survive the real HTTP read boundary.')
const companyStatus=await call(`/accounting/sources/company_expense/${expense.json.data.id}`,{cookie:owner.cookie})
check(companyStatus.status===200 && companyStatus.json.data.status==='pending','Shadow company source status must expose the unknown classification.')
const admin = await call('/auth/demo-login',{ method:'POST',body:{ userId:'USR-002' } })
check((await call('/accounting/trial-balance?asOf=2026-10-21',{ cookie:admin.cookie })).status===403,'Admin must not see accounting amounts.')
check((await call('/finance/prepaid-expenses',{cookie:admin.cookie})).status===403,'Admin must not see office prepayments.')
check((await call('/finance/company-expenses',{cookie:admin.cookie})).status===403,'Admin must not see company expense amounts.')
for (const route of ['/finance/accounting','/finance/funding']) {
  console.log(`Checking SSR ${route} shell (not browser hydration)`)
  const shell = await fetch(`${origin}${route}`,{ headers:{ cookie:owner.cookie! },signal:AbortSignal.timeout(120_000) })
  check(shell.status===200,`SSR page shell failed: ${route}`)
}
console.log(JSON.stringify({ result:'passed',backend:'live PGlite memory TEST',boundary:'HTTP → Nuxt proxy → session → API → source cash → pending registry → report response',
  setupMode:created.json.data.mode,sourceStatus:status.json.data.status,netProfitMinor:balance.json.data.netProfitMinor,adminStatus:403,
  prepaid:{status:prepaid.json.data.accountingStatus,remainingMinor:prepaidList.json.data.items[0].remainingMinor,monthlyMinor:amortization.json.data.booked[0].amountMinor},
  companyExpense:{status:companyStatus.json.data.status,invoiceLinked:workspace.json.data.items[0].invoiceId===vendorInvoice.json.data.id},
  browserHydration:'not verified; browser surface unavailable' },null,2))
export {}
