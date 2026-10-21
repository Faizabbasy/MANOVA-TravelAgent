import { afterAll,beforeAll,describe,expect,test } from 'bun:test'
import { DEMO,makeTestApp,type TestApp } from './helpers'
import { parseIdrAmount,parseStatementCsv } from '../src/modules/finance/statement-csv'

/** Owner accounting F7 / A13: statement import never creates cash; matching is explicit, bounded and reversible with history. */
const mapping = { delimiter:';',skipRows:1,dateColumn:0,dateFormat:'DD/MM/YYYY',descriptionColumn:1,debitColumn:2,creditColumn:3,referenceColumn:4,numberStyle:'id' } as const
const csv = (rows:string[]) => ['Tanggal;Keterangan;Debit;Kredit;Ref',...rows].join('\r\n')

describe('CSV parsing',() => {
  test('Indonesian and international numbers are exact whole rupiah; fractions and both sides are rejected',() => {
    expect(parseIdrAmount('1.234.567,00','id')).toBe(1234567n);expect(parseIdrAmount('1,234,567.00','en')).toBe(1234567n)
    expect(parseIdrAmount('Rp 9.007.199.254.740.993','id')).toBe(9007199254740993n)
    expect(parseIdrAmount('1.000,50','id')).toBeNull();expect(parseIdrAmount('(2.500)','id')).toBe(-2500n);expect(parseIdrAmount('2.500 DB','id')).toBe(-2500n)
    const r = parseStatementCsv(csv(['01/10/2026;"Transfer, masuk";;1.000.000,00;','31/02/2026;Salah;1;;','02/10/2026;Dua sisi;1;1;']),mapping)
    expect(r.rows).toHaveLength(1);expect(r.rows[0]).toMatchObject({ bookedOn:'2026-10-01',description:'Transfer, masuk',direction:'in',amountMinor:'1000000',externalRef:null })
    expect(r.errors.map(e => e.lineNo)).toEqual([3,4])
  })
})

describe('bank reconciliation',() => {
  let t:TestApp,cookie:string,admin:string,receipt:string,payment:string,fee:string
  const call = (method:'POST'|'GET',path:string,body?:unknown,key:string = crypto.randomUUID(),as?:string) => t.call(method,`/api/v1${path}`,{ cookie:as ?? cookie,body,headers:{ 'idempotency-key':key } })
  const post = async (path:string,body:unknown,key?:string) => { const r = await call('POST',path,body,key);expect(r.status, r.text).toBeLessThan(300);return r.json.data }
  const lines = async () => (await call('GET','/finance/bank-statement-lines?bankAccountId=BA-TEST&from=2026-10-01&to=2026-10-31')).json.data
  const cashCount = async () => (await t.db.query<{ n:string }>('select count(*) as n from financial_transactions'))[0]!.n
  beforeAll(async () => {
    t = await makeTestApp();cookie = await t.login(DEMO.finance);admin = await t.login(DEMO.admin)
    await t.db.query(`insert into bank_accounts (id,code,bank_name,holder_name,account_number,opening_status,opening_balance_minor,opening_date,opening_submitted_by,opening_submitted_at,opening_verified_by,opening_verified_at,created_by)
      values ('BA-TEST','TESTBANK','Synthetic','TEST_ONLY','123456','verified',100000000,'2026-09-01','USR-001',now(),'USR-010',now(),'USR-010')`)
    receipt = (await post('/finance/receipts',{ bankAccountId:'BA-TEST',partyId:'PTY-001',amountMinor:'5000000',effectiveDate:'2026-10-02' })).transactionId
    payment = (await post('/finance/vendor-payments',{ bankAccountId:'BA-TEST',vendorId:'VND-001',amountMinor:'2000000',effectiveDate:'2026-10-03' })).transactionId
    fee = (await post('/finance/transactions',{ bankAccountId:'BA-TEST',kind:'expense',category:'bank_fee',amountMinor:'6500',effectiveDate:'2026-10-03' })).transactionId
  },60000)
  afterAll(async () => { await t?.cleanup() })

  const file = csv(['02/10/2026;Setoran PT A;;5.000.000,00;TRX001','03/10/2026;Transfer vendor + biaya;2.006.500,00;;TRX002',
    '05/10/2026;Biaya admin;6.500,00;;','05/10/2026;Biaya admin;6.500,00;;','06/10/2026;Bunga;;1.200,00;'])
  const body = (text = file) => ({ bankAccountId:'BA-TEST',fileName:'oktober.csv',csv:text,mapping })

  test('preview writes nothing; import keeps two identical legitimate rows; re-import and overlap add nothing; no cash created',async () => {
    const cash = await cashCount()
    const p = await post('/finance/bank-statements/preview',body())
    expect(p.rows).toHaveLength(5);expect(p.errors).toHaveLength(0)
    expect((await t.db.query('select id from bank_statement_lines')).length).toBe(0)
    const first = await post('/finance/bank-statements',body(),'import-oct')
    expect(first).toMatchObject({ imported:5,skippedDuplicates:0,alreadyImported:false })
    expect((await post('/finance/bank-statements',body(),'import-oct-retry')).alreadyImported).toBe(true)
    const overlap = await post('/finance/bank-statements',body(csv(['05/10/2026;Biaya admin;6.500,00;;','06/10/2026;Bunga;;1.200,00;','07/10/2026;Baru;;100,00;'])),'import-overlap')
    expect(overlap).toMatchObject({ imported:1,skippedDuplicates:2 })
    expect((await t.db.query('select id from bank_statement_lines')).length).toBe(6)
    expect(await cashCount()).toBe(cash)
    expect((await call('POST','/finance/bank-statements',body(csv(['99/99/2026;x;1;;'])))).status).toBe(400)
  })
  test('one line matches a payment and its fee (split); totals cannot exceed; candidates are suggested',async () => {
    const all = (await lines()).lines
    const split = all.find((l:{ externalRef:string }) => l.externalRef === 'TRX002')
    expect(split.candidates.map((c:{ transactionId:string }) => c.transactionId)).toEqual(expect.arrayContaining([payment,fee]))
    const over = await call('POST',`/finance/bank-statement-lines/${split.id}/match`,{ matches:[{ transactionId:payment,amountMinor:'2000000' },{ transactionId:fee,amountMinor:'6501' }] })
    expect(over.status).toBe(400)
    const wrongSide = await call('POST',`/finance/bank-statement-lines/${split.id}/match`,{ matches:[{ transactionId:receipt,amountMinor:'1' }] })
    expect(wrongSide.status).toBe(422)
    const matched = await post(`/finance/bank-statement-lines/${split.id}/match`,{ matches:[{ transactionId:payment,amountMinor:'2000000' },{ transactionId:fee,amountMinor:'6500' }] })
    expect(matched.status).toBe('matched')
    const deposit = all.find((l:{ externalRef:string }) => l.externalRef === 'TRX001')
    expect((await post(`/finance/bank-statement-lines/${deposit.id}/match`,{ matches:[{ transactionId:receipt,amountMinor:'5000000' }] })).status).toBe('matched')
    const again = await call('POST',`/finance/bank-statement-lines/${deposit.id}/match`,{ matches:[{ transactionId:receipt,amountMinor:'1' }] })
    expect(again.status).toBe(400)
  })
  test('reversing a matched transaction stops it counting as settled; unmatch keeps history and the cash journal',async () => {
    const deposit = (await lines()).lines.find((l:{ externalRef:string }) => l.externalRef === 'TRX001')
    await post(`/finance/transactions/${receipt}/reverse`,{ reason:'TEST_ONLY reversed receipt' })
    expect((await lines()).lines.find((l:{ id:string }) => l.id === deposit.id).status).toBe('unmatched')
    const split = (await lines()).lines.find((l:{ externalRef:string }) => l.externalRef === 'TRX002')
    const undone = await post(`/finance/bank-statement-lines/${split.id}/unmatch`,{ reason:'TEST_ONLY wrong pairing' })
    expect(undone.status).toBe('unmatched')
    expect((await t.db.query('select id from bank_reconciliation_matches where statement_line_id=$1',[split.id])).length).toBe(2)
    expect((await t.db.query('select id from financial_transactions where id=$1',[payment])).length).toBe(1)
    await expect(t.db.query('delete from bank_reconciliation_matches')).rejects.toThrow()
  })
  test('a line without a source is recorded once from the line and matched; access is limited',async () => {
    const interest = (await lines()).lines.find((l:{ description:string }) => l.description === 'Bunga')
    const cash = BigInt(await cashCount())
    const res = await post(`/finance/bank-statement-lines/${interest.id}/record`,{ memo:'TEST_ONLY bunga bank' },'record-interest')
    expect((await post(`/finance/bank-statement-lines/${interest.id}/record`,{ memo:'TEST_ONLY bunga bank' },'record-interest')).transactionId).toBe(res.transactionId)
    expect(BigInt(await cashCount())).toBe(cash + 1n)
    expect((await lines()).lines.find((l:{ id:string }) => l.id === interest.id).status).toBe('matched')
    expect((await call('POST',`/finance/bank-statement-lines/${interest.id}/record`,{})).status).toBe(422)
    expect((await t.call('GET','/api/v1/finance/bank-statement-lines?bankAccountId=BA-TEST',{ cookie:admin })).status).toBe(403)
    expect((await t.call('POST','/api/v1/finance/bank-statements',{ cookie:admin,body:body(),headers:{ 'idempotency-key':'admin-import' } })).status).toBe(403)
  })
})
