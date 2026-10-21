/** Local browser UAT server. Always fresh PGlite MEMORY, never reads DATABASE_URL or touches an application DB. */
import { makeTestApp } from '../test/helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'

if (process.env.APP_ENV !== 'test' || process.env.TEST_DATABASE_URL) throw new Error('Run with APP_ENV=test and no TEST_DATABASE_URL. This UAT uses memory only.')
const t = await makeTestApp({ config:{ demoLogin:true,allowedOrigins:['http://localhost:8080','http://127.0.0.1:8080'] } })
await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
  values ('BA-UAT','TEST-UAT','Bank Sintetis','TEST_ONLY','123456789','verified',200000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)

if(process.env.ACCOUNTING_RECEIPT_MATCH_UAT==='1'){
  const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
  const b=await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY supplier receipt rehearsal',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_uat_setup','test'))
  await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-12-31',reason:'TEST_ONLY browser period'},'req_uat_period'))
  for(const kind of ['supplier_fulfillment','vendor_billing'])await t.db.query(`insert into accounting_policies(id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,validation_status,settings,rationale,created_by)
    values($1,$2,$3,1,'2026-09-01','principal','supplier-fulfillment','TEST_ONLY_EXCLUDED','test-only',$4::text::jsonb,'TEST_ONLY no production decision','USR-010')`,[`APL-UAT-${kind}`,b.id,kind,JSON.stringify({costMatching:'receipt-links',...(kind==='vendor_billing'?{invoiceTreatment:'prepaid'}:{})})])
  await t.db.query(`insert into sales_order_refs(id,party_id,price_minor,traveler_count,destination,travel_start_date,travel_end_date)
    values('SLO-UAT-MATCH','PTY-001',100000000,1,'TEST_ONLY supplier matching','2026-10-01','2026-10-02')`)
}
t.app.listen({ hostname:'127.0.0.1',port:3000 })
console.log(`ACCOUNTING UAT ONLY: http://127.0.0.1:3000; fresh PGlite memory; synthetic demo logins; book ${process.env.ACCOUNTING_RECEIPT_MATCH_UAT==='1'?'TEST_ONLY supplier shadow fixture':'initially absent'}; no external payment provider.`)
async function stop() { await t.app.stop();await t.cleanup();process.exit(0) }
process.on('SIGINT',() => void stop())
process.on('SIGTERM',() => void stop())
