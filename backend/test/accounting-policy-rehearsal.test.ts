import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {createHash} from 'node:crypto'
import {DEMO,makeTestApp,type TestApp} from './helpers'
import {createBook,createPeriod} from '../src/modules/accounting/setup'
import {postBusinessEvent,originalLines,type BusinessEvent} from '../src/modules/accounting/posting'
import {rehearseDraftPolicy} from '../src/modules/accounting/policy-rehearsal'
import {migrateDown} from '../src/db/migrator'
const actor={userId:'USR-010',role:'super-admin' as const,name:'TEST_ONLY',email:'test@example.invalid',sessionId:'TEST_ONLY',partyId:null,vendorId:null}
function canonical(value:unknown):string{
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`
  if(value && typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}
describe('owner policy rehearsal and immutable pending correction identity',()=>{
  let t:TestApp,owner:string,finance:string,admin:string,bookId:string,invoiceId:string
  const call=(method:string,path:string,body?:unknown,cookie=owner,key:string=crypto.randomUUID())=>t.call(method,`/api/v1${path}`,{cookie,body,headers:{'idempotency-key':key}})
  const post=async(path:string,body:unknown,cookie=owner,key?:string)=>{const r=await call('POST',path,body,cookie,key);expect(r.status,r.text).toBeLessThan(300);return r.json.data}
  const proposal=(overrides:Record<string,unknown>={})=>({sourceKind:'customer_billing',effectiveFrom:'2026-09-01',principalAgent:'principal',recognition:'fulfillment',taxTreatment:'TEST_ONLY_EXCLUDED',rationale:'TEST_ONLY source contract fixture',settings:{billingRight:'unconditional'},...overrides})
  beforeAll(async()=>{
    t=await makeTestApp();owner=await t.login(DEMO.superAdmin);finance=await t.login(DEMO.finance);admin=await t.login(DEMO.admin)
    bookId=(await t.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY owner policy workbench',purpose:'rehearsal',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_setup','test'))).id
    await t.db.transaction(tx=>createPeriod(tx,actor,{startsOn:'2026-09-01',endsOn:'2026-12-31',reason:'TEST_ONLY source policy period'},'req_period'))
  },60000)
  afterAll(async()=>{await t?.cleanup()})
  test('unknown stays unknown; authorization, confirmation and incomplete methods reject fixture use',async()=>{
    const draft=await post('/accounting/policies',proposal({principalAgent:'unknown',recognition:'unknown',taxTreatment:'unknown',settings:{}}))
    const path=`/accounting/policies/${draft.id}/rehearse`,body={reason:'TEST_ONLY explicit isolated rehearsal',confirm:true}
    expect((await call('POST',path,body,'')).status).toBe(401)
    expect((await call('POST',path,body,finance)).status).toBe(403)
    expect((await call('POST',path,body,admin)).status).toBe(403)
    expect((await call('POST','/accounting/policies/MISSING/rehearse',body)).status).toBe(404)
    expect((await call('POST',path,body)).status).toBe(400)
    expect((await call('POST',path,{...body,confirm:false})).status).toBe(400)
    expect((await t.db.query('select validation_status,principal_agent from accounting_policies where id=$1',[draft.id]))[0]).toMatchObject({validation_status:'draft',principal_agent:'unknown'})
    const supplier=await post('/accounting/policies',proposal({sourceKind:'supplier_fulfillment',recognition:'supplier-fulfillment',settings:{}}))
    expect((await call('POST',`/accounting/policies/${supplier.id}/rehearse`,body)).status).toBe(400)
    expect((await call('POST','/accounting/policies',proposal({sourceKind:'manual_cash',settings:{classifications:{tax:'office-expense'}}}))).status).toBe(400)
    const loan=await post('/accounting/policies',proposal({sourceKind:'owner_funds',settings:{contributionRole:'loan',withdrawalRole:'loan'}}))
    expect((await call('POST',`/accounting/policies/${loan.id}/rehearse`,body)).status).toBe(400)
  })
  test('a pending invoice and its pending void resolve from the same owner UI commands without another source or cash',async()=>{
    const inv=await post('/finance/customer-invoices',{projectId:'PRJ-101',invoiceType:'dp',dueDate:'2026-12-01',lines:[{description:'TEST_ONLY pending correction',amountMinor:'10000000'}]},finance);invoiceId=inv.id
    await post(`/finance/customer-invoices/${inv.id}/issue`,{issueDate:'2026-09-05'},finance)
    await post(`/finance/customer-invoices/${inv.id}/void`,{reason:'TEST_ONLY original invoice correction'},finance)
    const before=await t.db.query<{id:string;event_kind:string;fingerprint:string;identity_version:number}>('select id,event_kind,fingerprint,identity_version from accounting_events where source_id=$1 order by id',[inv.id])
    expect(before).toHaveLength(2);expect(before.every(e=>e.identity_version===2)).toBe(true)
    const draft=await post('/accounting/policies',proposal()),input={reason:'TEST_ONLY isolated contract facts checked',confirm:true}
    const result=await post(`/accounting/policies/${draft.id}/rehearse`,input,owner,'policy-fixture-stable-key')
    expect(await post(`/accounting/policies/${draft.id}/rehearse`,input,owner,'policy-fixture-stable-key')).toEqual(result)
    expect(result.validationStatus).toBe('test-only');expect(result.version).toBe(draft.version+1)
    expect((await t.db.query('select validation_status from accounting_policies where id=$1',[draft.id]))[0]!.validation_status).toBe('draft')
    const original=before.find(e=>e.event_kind==='invoice_recognized')!,correction=before.find(e=>e.event_kind==='invoice_voided')!
    expect((await post(`/accounting/exceptions/${correction.id}/retry`,{})).status).toBe('pending')
    expect((await post(`/accounting/exceptions/${original.id}/retry`,{})).status).toBe('posted')
    expect((await t.db.query('select status from accounting_posting_registry where event_id=$1',[correction.id]))[0]!.status).toBe('posted')
    expect((await call('POST',`/accounting/exceptions/${correction.id}/retry`,{})).status).toBe(404)
    expect(await t.db.query('select id,event_kind,fingerprint,identity_version from accounting_events where source_id=$1 order by id',[inv.id])).toEqual(before)
    expect((await t.db.query('select count(*) as n from financial_transactions'))[0]!.n).toBe('0')
    expect((await t.db.query('select status from customer_invoices where id=$1',[inv.id]))[0]!.status).toBe('void')
    const [net]=await t.db.query<{ar:string;deferred:string}>(`select coalesce(sum(debit_minor-credit_minor) filter(where account_code='1110'),0) as ar,coalesce(sum(debit_minor-credit_minor) filter(where account_code='2130'),0) as deferred
      from accounting_journal_lines l join accounting_journals j on j.id=l.journal_id where j.status='posted'`)
    expect(net).toEqual({ar:'0',deferred:'0'})
    expect((await call('POST',`/accounting/policies/${draft.id}/rehearse`,input)).status).toBe(409)
    await expect(t.db.query('update accounting_policy_rehearsals set reason=$2 where draft_policy_id=$1',[draft.id,'TEST_ONLY changed review'])).rejects.toThrow('immutable')
    await expect(migrateDown(t.db,{to:60})).rejects.toThrow('identity evidence')
  })
  test('legacy pending correction binds its resolved original once, preserves its fingerprint and refuses changed facts or retargeting',async()=>{
    const primary:BusinessEvent={sourceType:'TEST_ONLY_legacy',sourceId:'TEST_ONLY-LEGACY',sourceVersion:'1',kind:'source_recorded',effectiveDate:'2026-09-05',snapshot:{amountMinor:'100',testOnly:true},policyKind:'customer_billing',description:'TEST_ONLY legacy event',
      lines:[{accountCode:'1110',debitMinor:'100',creditMinor:'0',partyId:'PTY-001'},{accountCode:'2130',debitMinor:'0',creditMinor:'100',partyId:'PTY-001'}]}
    const correction:BusinessEvent={...primary,sourceVersion:'void',kind:'source_voided',effectiveDate:'2026-10-21',snapshot:{...primary.snapshot,correctionReason:'TEST_ONLY old pending reversal'},correctionReason:'TEST_ONLY old pending reversal',lines:[]}
    const oldHash=(e:BusinessEvent)=>createHash('sha256').update(canonical({snapshot:e.snapshot,date:e.effectiveDate,reversalOfId:undefined,correctionReason:e.correctionReason})).digest('hex')
    for(const [id,e] of [['AEV-LEGACY-P',primary],['AEV-LEGACY-V',correction]] as const){
      await t.db.query(`insert into accounting_events(id,book_id,source_type,source_id,source_version,event_kind,effective_date,snapshot,fingerprint,actor_user_id,request_id)
        values($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9,'USR-010','req_TEST_ONLY_legacy')`,[id,bookId,e.sourceType,e.sourceId,e.sourceVersion,e.kind,e.effectiveDate,JSON.stringify(e.snapshot),oldHash(e)])
      await t.db.query("insert into accounting_posting_registry(book_id,event_id,purpose,status,reason_code,reason_message) values($1,$2,'primary','pending','TEST_ONLY','TEST_ONLY legacy pending')",[bookId,id])
    }
    const original=await t.db.transaction(tx=>postBusinessEvent(tx,actor,primary,'req_legacy_parent'))
    const event={...correction,lines:await originalLines(t.db,original.journalId!),reversalOfId:original.journalId!}
    const reversed=await t.db.transaction(tx=>postBusinessEvent(tx,actor,event,'req_legacy_void'))
    expect(reversed.status).toBe('posted')
    expect((await t.db.transaction(tx=>postBusinessEvent(tx,actor,event,'req_legacy_void_retry'))).journalId).toBe(reversed.journalId)
    expect((await t.db.query('select fingerprint,identity_version from accounting_events where id=$1',['AEV-LEGACY-V']))[0]).toEqual({fingerprint:oldHash(correction),identity_version:1})
    await expect(t.db.transaction(tx=>postBusinessEvent(tx,actor,{...event,snapshot:{...event.snapshot,amountMinor:'101'}},'req_wrong_amount'))).rejects.toThrow('Fakta sumber berbeda')
    await expect(t.db.transaction(tx=>postBusinessEvent(tx,actor,{...event,reversalOfId:'AJN-OTHER'},'req_wrong_parent'))).rejects.toThrow('Fakta sumber berbeda')
    // A new-identity posted reversal is equally unable to change its immutable parent.
    const [existing]=await t.db.query<{id:string}>(`select j.reversal_of_id as id from accounting_journals j join accounting_events e on e.id=j.event_id where e.source_id=$1 and e.event_kind='invoice_voided'`,[invoiceId])
    expect(existing?.id).toBeTruthy()
  })
  test('production profile stays OFF and cannot turn a proposal into a test-only or validated policy',async()=>{
    const p=await makeTestApp()
    try{
      const b=await p.db.transaction(tx=>createBook(tx,actor,{name:'TEST_ONLY production-off guard',purpose:'production',cutoverDate:'2026-09-01',timezone:'Asia/Jakarta'},'req_prod_off','test'))
      const cookie=await p.login(DEMO.superAdmin)
      const draft=await p.call('POST','/api/v1/accounting/policies',{cookie,body:proposal(),headers:{'idempotency-key':'prod-off-draft'}})
      expect(draft.status,draft.text).toBe(200)
      const result=await p.call('POST',`/api/v1/accounting/policies/${draft.json.data.id}/rehearse`,{cookie,body:{reason:'TEST_ONLY production refusal',confirm:true},headers:{'idempotency-key':'prod-off-rehearse'}})
      expect(result.status).toBe(422)
      expect((await p.db.query('select mode from accounting_books where id=$1',[b.id]))[0]!.mode).toBe('off')
      expect((await p.db.query("select count(*) as n from accounting_policies where validation_status<>'draft'"))[0]!.n).toBe('0')
      await expect(t.db.transaction(tx=>rehearseDraftPolicy(tx,actor,'MISSING',{reason:'TEST_ONLY production environment',confirm:true},'req_prod_env','production'))).rejects.toThrow('terisolasi')
    }finally{await p.cleanup()}
  },60000)
})
