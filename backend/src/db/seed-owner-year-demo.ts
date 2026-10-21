import type { AppEnv } from '../config/env'
import type { Db } from './client'
import { seedDemo, SeedRefusedError, type DemoCoreSeed } from './seed-demo'
import core from './seeds/demo-core.json'
import { demoTagged, loadActor, shiftDays } from './seed-finance-demo'
import { recordAudit } from '../shared/audit'
import { createBook, createPeriod, createDraftPolicy } from '../modules/accounting/setup'
import { rehearseDraftPolicy } from '../modules/accounting/policy-rehearsal'
import type { PolicySettingsInput } from '../modules/accounting/policy-settings'
import { confirmOpening, openingPreview } from '../modules/accounting/opening'
import { createAccount, submitOpening, verifyOpening } from '../modules/finance/accounts'
import { createInvoiceDraft, issueInvoice, postReceipt } from '../modules/finance/receivables'
import { createVendorInvoice, reviewVendorInvoice, postVendorPayment } from '../modules/finance/payables'
import { postManualTransaction, postTransfer } from '../modules/finance/postings'
import { recordFulfillment } from '../modules/finance/fulfillments'
import { matchSupplierReceipt } from '../modules/finance/supplier-matching'
import { postStaffCash, recordExpenseClaim } from '../modules/finance/staff-funds'
import { purchaseAsset, runDepreciation, receiveLoan, repayLoan } from '../modules/finance/funding'
import { payPrepaidExpense, runPrepaidAmortization } from '../modules/finance/prepaid-expenses'
import { createPayrollRun, approvePayrollRun, payPayrollRun } from '../modules/core/hr'
import { todayBusinessDate } from '../modules/finance/common'
import { seedOwnerYearStatements } from './seed-owner-year-statements'

export const OWNER_YEAR_DEMO = { id: 'owner-year-v1', from: '2025-11-01', asOf: '2026-10-22' } as const
const REQUEST = 'seed-owner-year-v1'
const MONEY = (rupiah: bigint) => rupiah.toString() // IDR minor unit is one rupiah.
const MILLION = 1_000_000n
type Event = { date: string; order: number; run: () => Promise<unknown> }
export interface OwnerYearSummary { from: string; asOf: string; projects: number; invoices: number; supplierInvoices: number; cashTransactions: number; journals: number; pending: number; skipped: boolean }

/** Atomic, reproducible DEMO ONLY. Business services create money; journals always derive from those sources. */
export async function seedOwnerYearDemo(raw: Db, options: { appEnv: AppEnv; log?: (message: string) => void }): Promise<OwnerYearSummary> {
  if (options.appEnv === 'production') throw new SeedRefusedError('Owner year demo cannot run in production.')
  if (todayBusinessDate() < OWNER_YEAR_DEMO.asOf) throw new SeedRefusedError('This fixed demo story ends on 2026-10-22; future financial facts cannot be seeded.')
  return raw.transaction(async tx => {
    await tx.query('select pg_advisory_xact_lock(4783299)')
    const db: Db = { engine: raw.engine, query: (sql, params) => tx.query(sql, params), exec: sql => tx.exec(sql), transaction: fn => fn(tx), close: async () => {} }
    const [done] = await tx.query<{ after: Omit<OwnerYearSummary, 'skipped'> }>('select after from audit_events where action=$1 and entity_id=$2', ['demo.owner_year_completed', OWNER_YEAR_DEMO.id])
    if (done) {
      await seedOwnerYearStatements(tx, await loadActor(db, 'USR-008', 'finance'))
      return { ...done.after, skipped: true }
    }
    const [occupied] = await tx.query<{ n: string }>(`select ((select count(*) from users)+(select count(*) from projects)+(select count(*) from bank_accounts)+(select count(*) from accounting_books))::text as n`)
    if (occupied!.n !== '0') throw new SeedRefusedError('Owner year demo requires its own empty database. Existing data will never be reset or overwritten.')
    // Nested domain transactions share this outer transaction: a failed seed leaves no partial story.
    const fixture = structuredClone(core) as unknown as DemoCoreSeed
    // Historic payroll statuses are replaced with real approvals/payments, never marked paid by a fixture.
    fixture.payrollRuns = []; fixture.payrollLines = []
    for (const employee of fixture.employees ?? []) if (employee.joinedOn > '2025-11-01') employee.joinedOn = '2025-10-01'
    const firstAsset = [...(fixture.assets ?? [])].sort((a, b) => a.id.localeCompare(b.id))[0]
    if (firstAsset) { firstAsset.purchasedOn = '2025-11-05'; firstAsset.purchasePriceMinor = MONEY(48n * MILLION) }
    await seedDemo(db, { appEnv: options.appEnv, seed: fixture })
    const tagged = demoTagged(db)
    const finance = await loadActor(db, 'USR-008', 'finance')
    const owner = await loadActor(db, 'USR-010', 'super-admin')
    const source = <T>(fn: (q: typeof tx) => Promise<T>) => tagged.transaction(fn)
    const book = await createBook(tx, owner, { name: 'DEMO FIKTIF — MANOVA 12 bulan', purpose: 'rehearsal', cutoverDate: OWNER_YEAR_DEMO.from, timezone: 'Asia/Jakarta' }, REQUEST, options.appEnv)
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(2025, 10 + m, 1)).toISOString().slice(0, 10)
      const end = new Date(Date.UTC(2025, 11 + m, 0)).toISOString().slice(0, 10)
      await createPeriod(tx, owner, { startsOn: start, endsOn: end, reason: 'TEST_ONLY periode cerita perusahaan 12 bulan' }, REQUEST)
    }
    const policies: [string, string, string, PolicySettingsInput][] = [
      ['opening', 'not-applicable', 'as-of', {}],
      ['customer_billing', 'principal', 'fulfillment', { billingRight: 'unconditional' }],
      ['fulfillment', 'principal', 'fulfillment', {}],
      ['vendor_billing', 'not-applicable', 'supplier-fulfillment', { costMatching: 'receipt-links', invoiceTreatment: 'prepaid' }],
      ['supplier_fulfillment', 'not-applicable', 'supplier-fulfillment', { costMatching: 'receipt-links' }],
      ...['customer_receipt', 'customer_allocation', 'vendor_payment', 'vendor_allocation', 'transfer', 'loan'].map(k => [k, 'not-applicable', 'source-fact', {}] as [string, string, string, PolicySettingsInput]),
      ['manual_cash', 'not-applicable', 'source-fact', { classifications: { office: 'office-expense', technology: 'office-expense', marketing: 'office-expense', bank_fee: 'bank-fee', other_income: 'other-revenue' } }],
      ['employee_advance', 'not-applicable', 'source-fact', { classifications: { office: 'office-expense', travel: 'office-expense' } }],
      ['payroll', 'not-applicable', 'payroll-month', {}],
      ['asset', 'not-applicable', 'source-fact', { method: 'straight-line' }],
      ['prepaid_opex', 'not-applicable', 'source-fact', { method: 'equal-months' }]
    ]
    for (const [sourceKind, principalAgent, recognition, settings] of policies) {
      const p = await createDraftPolicy(tx, owner, { sourceKind, principalAgent, recognition, settings, effectiveFrom: OWNER_YEAR_DEMO.from, taxTreatment: 'TEST_ONLY_EXCLUDED', rationale: 'TEST_ONLY skenario fiktif; bukan keputusan keuangan MANOVA' }, REQUEST)
      await rehearseDraftPolicy(tx, owner, p.id, { reason: 'TEST_ONLY fixture demo lokal terisolasi', confirm: true }, REQUEST, options.appEnv)
    }
    const accounts = []
    for (const [code, bankName, balance] of [['DEMO-BCA', 'Bank Operasional Demo', 1500n], ['DEMO-MDR', 'Bank Supplier Demo', 400n], ['DEMO-BRI', 'Dana Cadangan Demo', 250n]] as const) {
      const a = await createAccount(tagged, finance, { code, bankName, holderName: 'PERUSAHAAN FIKTIF — MANOVA DEMO', accountNumber: `990000${accounts.length + 1}` }, REQUEST)
      await submitOpening(tagged, finance, a.id, { amountMinor: MONEY(balance * MILLION), openingDate: '2025-10-31', note: 'TEST_ONLY saldo awal fiktif' }, REQUEST)
      await verifyOpening(tagged, owner, a.id, { balanceMinor: MONEY(balance * MILLION), openingDate: '2025-10-31' }, REQUEST, true)
      accounts.push(a)
    }
    const bank = accounts[0]!.id, reserve = accounts[2]!.id
    const decisions = { equity: { capitalMinor: MONEY(2150n * MILLION) } }
    const opening = await openingPreview(tx, decisions)
    await confirmOpening(tx, owner, { planHash: opening.planHash, decisions, reason: 'TEST_ONLY modal dan rekening fiktif per awal cerita' }, REQUEST)
    const events: Event[] = []
    const at = (date: string, order: number, fn: () => Promise<unknown>) => { if (date >= OWNER_YEAR_DEMO.from && date <= OWNER_YEAR_DEMO.asOf) events.push({ date, order, run: fn }) }
    const projects = await tx.query<{ id: string; party_id: string; name: string; contract_value_minor: string; travel_start_date: string; travel_end_date: string }>(`select id,party_id,name,contract_value_minor,travel_start_date,travel_end_date from projects where id between 'PRJ-301' and 'PRJ-340' order by travel_start_date,id`)
    for (const [index, p] of projects.entries()) {
      const date = `${p.travel_start_date.slice(0, 7)}-02`
      const total = BigInt(p.contract_value_minor), first = total * 40n / 100n
      let invoiceId = '', vendorId = '', receiptId = ''
      const supplier = index % 2 === 0 ? 'VND-001' : 'VND-002'
      const cost = total * BigInt(70 + index % 9) / 100n
      const invoiceDate = shiftDays(date, 5)
      const delivered = p.travel_end_date
      at(date, 1, () => source(async q => {
        const draft = await createInvoiceDraft(q, finance, { projectId: p.id, invoiceType: 'final', dueDate: shiftDays(date, 12), lines: [{ description: `DEMO paket ${p.name}`, amountMinor: MONEY(total) }] }, REQUEST)
        invoiceId = draft.id
        await issueInvoice(q, finance, invoiceId, { issueDate: date, dueDate: shiftDays(date, 12) }, REQUEST)
      }))
      at(shiftDays(date, 2), 2, () => source(q => postReceipt(q, finance, { bankAccountId: bank, projectId: p.id, partyId: p.party_id, amountMinor: MONEY(first), effectiveDate: shiftDays(date, 2), reference: `DEMO-DP-${p.id}`, allocations: [{ invoiceId, amountMinor: MONEY(first) }] }, REQUEST)))
      if (index % 11 !== 0) at(shiftDays(date, index % 7 === 0 ? 25 : 10), 2, () => source(q => postReceipt(q, finance, { bankAccountId: bank, projectId: p.id, partyId: p.party_id, amountMinor: MONEY(total - first), effectiveDate: shiftDays(date, index % 7 === 0 ? 25 : 10), reference: `DEMO-LUNAS-${p.id}`, allocations: [{ invoiceId, amountMinor: MONEY(total - first) }] }, REQUEST)))
      at(invoiceDate, 3, () => source(async q => {
        const v = await createVendorInvoice(q, finance, { projectId: p.id, vendorId: supplier, vendorInvoiceNumber: `DEMO-SUP-${p.id}`, totalMinor: MONEY(cost), invoiceDate, dueDate: shiftDays(invoiceDate, 14) }, REQUEST)
        vendorId = v.id
        await reviewVendorInvoice(q, finance, vendorId, { action: 'approve' }, REQUEST)
      }))
      if (index % 13 !== 0) at(shiftDays(invoiceDate, 6), 4, () => source(q => postVendorPayment(q, finance, { bankAccountId: bank, vendorId: supplier, projectId: p.id, amountMinor: MONEY(cost), effectiveDate: shiftDays(invoiceDate, 6), reference: `DEMO-BAYAR-${p.id}`, allocations: [{ vendorInvoiceId: vendorId, amountMinor: MONEY(cost) }] }, REQUEST)))
      at(delivered, 5, () => source(async q => {
        await recordFulfillment(q, finance, { side: 'customer', projectId: p.id, amountMinor: MONEY(total), fulfilledOn: delivered, evidence: `TEST_ONLY berita acara jasa ${p.id}`, isFinal: true }, REQUEST)
        const f = await recordFulfillment(q, finance, { side: 'supplier', projectId: p.id, vendorId: supplier, amountMinor: MONEY(cost), fulfilledOn: delivered, basis: 'actual', evidence: `TEST_ONLY penerimaan supplier ${p.id}`, isFinal: true }, REQUEST)
        receiptId = f.id
      }))
      const matchedOn = delivered > invoiceDate ? delivered : invoiceDate
      at(matchedOn, 6, () => source(q => matchSupplierReceipt(q, finance, vendorId, { fulfillmentId: receiptId, actualMinor: MONEY(cost), closesReceipt: true, postingDate: matchedOn, reason: 'TEST_ONLY invoice sesuai penerimaan jasa' }, REQUEST)))
    }
    const [employee] = await tx.query<{ id: string }>("select id from employees where status<>'resigned' order by id limit 1")
    const [, reimbursedEmployee] = await tx.query<{ id: string }>("select id from employees where status<>'resigned' order by id limit 2")
    const [asset] = await tx.query<{ id: string }>('select id from assets order by id limit 1')
    let loanId = ''
    at('2025-11-03', 6, () => source(async q => { loanId = (await receiveLoan(q, finance, { lender: 'Koperasi FIKTIF Demo', principalMinor: MONEY(240n * MILLION), receivedOn: '2025-11-03', terms: 'TEST_ONLY 24 cicilan pokok 10 juta; bunga contoh 1 juta per cicilan, bukan kebijakan produksi', bankAccountId: bank }, REQUEST)).id }))
    if (asset) at('2025-11-05', 6, () => source(q => purchaseAsset(q, finance, { assetId: asset.id, bankAccountId: bank, costMinor: MONEY(48n * MILLION), acquiredOn: '2025-11-05', usefulLifeMonths: 24 }, REQUEST)))
    at('2025-11-01', 6, () => source(q => payPrepaidExpense(q, finance, { bankAccountId: bank, amountMinor: MONEY(120n * MILLION), effectiveDate: '2025-11-01', description: 'DEMO sewa kantor 12 bulan', evidenceRef: 'TEST_ONLY-SEWA-TAHUNAN', startMonth: '2025-11', months: 12, method: 'equal-months' }, REQUEST)))
    for (let m = 0; m < 12; m++) {
      const ym = new Date(Date.UTC(2025, 10 + m, 1)).toISOString().slice(0, 7)
      const day = (d: string) => `${ym}-${d}`
      at(day('08'), 7, () => source(q => postManualTransaction(q, finance, { bankAccountId: bank, kind: 'expense', category: 'technology', amountMinor: MONEY(4n * MILLION), effectiveDate: day('08'), counterparty: 'Penyedia software FIKTIF', memo: 'DEMO langganan software bulanan' }, REQUEST)))
      at(day('12'), 7, () => source(q => postManualTransaction(q, finance, { bankAccountId: bank, kind: 'expense', category: 'marketing', amountMinor: MONEY(BigInt(8 + m % 4) * MILLION), effectiveDate: day('12'), memo: 'DEMO kampanye pemasaran' }, REQUEST)))
      at(day('15'), 7, () => source(q => postTransfer(q, finance, { fromAccountId: bank, toAccountId: reserve, amountMinor: MONEY(5n * MILLION), feeMinor: '6500', effectiveDate: day('15'), memo: 'DEMO alokasi cadangan bulanan' }, REQUEST)))
      if (m > 0) at(day('18'), 7, () => source(q => repayLoan(q, finance, { loanId, bankAccountId: bank, principalMinor: MONEY(10n * MILLION), interestMinor: MONEY(MILLION), effectiveDate: day('18') }, REQUEST)))
      if (employee) {
        at(day('09'), 7, () => source(q => postStaffCash(q, finance, 'employee_advance', { employeeId: employee.id, bankAccountId: bank, amountMinor: MONEY(3n * MILLION), effectiveDate: day('09'), memo: 'DEMO uang jalan staf' }, REQUEST)))
        at(day('10'), 7, () => source(q => recordExpenseClaim(q, finance, { employeeId: employee.id, category: 'office', amountMinor: MONEY(2n * MILLION), spentOn: day('10'), evidenceRef: `DEMO-BUKTI-${ym}`, description: 'DEMO pembelian perlengkapan kantor' }, REQUEST)))
        if (m < 11) at(day('11'), 7, () => source(q => postStaffCash(q, finance, 'employee_advance_return', { employeeId: employee.id, bankAccountId: bank, amountMinor: MONEY(MILLION), effectiveDate: day('11'), memo: 'DEMO pengembalian sisa uang jalan' }, REQUEST)))
      }
      const end = new Date(Date.UTC(2025, 11 + m, 0)).toISOString().slice(0, 10)
      at(end, 9, () => source(async q => {
        const payroll = await createPayrollRun(q, finance, { period: ym }, REQUEST)
        await approvePayrollRun(q, finance, payroll.id, end, REQUEST)
        await payPayrollRun(q, finance, payroll.id, { bankAccountId: bank, effectiveDate: end, reference: `DEMO-GAJI-${ym}` }, REQUEST)
      }))
    }
    const sorted = events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    for (const [i, event] of sorted.entries()) {
      await event.run()
      if (i % 40 === 0) options.log?.(`Demo ${i + 1}/${sorted.length}: ${event.date}`)
    }
    if (reimbursedEmployee) {
      await source(q => recordExpenseClaim(q, finance, { employeeId: reimbursedEmployee.id, category: 'office', amountMinor: MONEY(4n * MILLION), spentOn: '2026-10-15', evidenceRef: 'DEMO-REIMBURSE-OKTOBER', description: 'DEMO perlengkapan dibayar pribadi oleh staf' }, REQUEST))
      await source(q => postStaffCash(q, finance, 'employee_reimbursement', { employeeId: reimbursedEmployee.id, bankAccountId: bank, amountMinor: MONEY(2n * MILLION), effectiveDate: '2026-10-16', memo: 'DEMO pembayaran sebagian reimbursement' }, REQUEST))
    }
    await source(q => runDepreciation(q, finance, { throughPeriod: '2026-09' }, REQUEST))
    await source(q => runPrepaidAmortization(q, finance, { throughPeriod: '2026-09' }, REQUEST))
    const [counts] = await tx.query<{ ci: string; vi: string; cash: string; journals: string; pending: string }>(`select (select count(*) from customer_invoices)::text as ci,(select count(*) from vendor_invoices)::text as vi,(select count(*) from financial_transactions)::text as cash,(select count(*) from accounting_journals)::text as journals,(select count(*) from accounting_posting_registry where status='pending')::text as pending`)
    const summary: OwnerYearSummary = { from: OWNER_YEAR_DEMO.from, asOf: OWNER_YEAR_DEMO.asOf, projects: projects.length, invoices: Number(counts!.ci), supplierInvoices: Number(counts!.vi), cashTransactions: Number(counts!.cash), journals: Number(counts!.journals), pending: Number(counts!.pending), skipped: false }
    if (summary.pending) throw new Error(`Demo contains ${summary.pending} unresolved accounting events; refusing a partial fixture.`)
    await seedOwnerYearStatements(tx, finance)
    await recordAudit(tx, { action: 'demo.owner_year_completed', actorUserId: owner.userId, entityType: 'demo_fixture', entityId: OWNER_YEAR_DEMO.id, requestId: REQUEST, after: summary, reason: 'TEST_ONLY 12 bulan data fiktif; tidak menetapkan kebijakan perusahaan' })
    options.log?.(`Book ${book.id}: ${summary.journals} source-backed journals`)
    return summary
  })
}
