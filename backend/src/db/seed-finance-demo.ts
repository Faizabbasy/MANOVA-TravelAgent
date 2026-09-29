import type { AppEnv } from '../config/env'
import type { Actor, RoleId } from '../auth/rbac'
import { createAccount, submitOpening, verifyOpening } from '../modules/finance/accounts'
import { todayBusinessDate } from '../modules/finance/common'
import { postManualTransaction, postTransfer, reverseTransaction } from '../modules/finance/postings'
import { createVendorInvoice, postVendorPayment, reviewVendorInvoice } from '../modules/finance/payables'
import {
  createInvoiceDraft,
  createScheduleItem,
  issueCreditNote,
  issueInvoice,
  postReceipt,
  setInvoiceExpectation
} from '../modules/finance/receivables'
import type { Db, Queryable } from './client'
import { SeedRefusedError } from './seed-demo'

/**
 * Finance demo scenario (`bun run db:seed:finance-demo`), layered on the core demo seed.
 *
 * Everything goes through the real finance services — the same validation, triggers, idempotency-free
 * posting paths and audit trail as the API — so the demo can never contain a state the app itself could
 * not produce. Every bank account and cash-book row is stamped `provenance = 'demo-fixture'` (migration
 * 0010) so demo money is never mistaken for real cash. Dates are relative to today (Asia/Jakarta), so the
 * scenario always shows something overdue, something due soon and something to review.
 *
 * Runs once: when any finance record already exists it does nothing.
 */

export interface FinanceSeedResult {
  skipped: boolean
  accounts: number
  customerInvoices: number
  vendorInvoices: number
  transactions: number
}

const REQUEST_ID = 'seed-finance-demo'
const jt = (millions: number) => String(Math.round(millions * 1_000_000))

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A Db whose every transaction is tagged demo-fixture (read by the provenance column defaults). */
function demoTagged(db: Db): Db {
  return {
    ...db,
    query: (text, params) => db.query(text, params),
    exec: sql => db.exec(sql),
    transaction: fn => db.transaction(async tx => {
      await tx.query("select set_config('manova.provenance', 'demo-fixture', true)")
      return fn(tx)
    })
  }
}

async function loadActor(db: Db, id: string, role: RoleId): Promise<Actor> {
  const [u] = await db.query<{ id: string; name: string; email: string; role: string }>('select id, name, email, role from users where id = $1', [id])
  if (!u || u.role !== role) throw new SeedRefusedError(`Demo user ${id} (${role}) is missing — run \`bun run db:seed:demo\` first.`)
  return { userId: u.id, name: u.name, email: u.email, role, partyId: null, vendorId: null, sessionId: REQUEST_ID }
}

export async function seedFinanceDemo(rawDb: Db, options: { appEnv: AppEnv }): Promise<FinanceSeedResult> {
  if (options.appEnv === 'production') throw new SeedRefusedError('Finance demo seed is disabled in production (APP_ENV=production).')
  const [real] = await rawDb.query<{ n: string }>(
    `select (select count(*) from users where provenance <> 'demo-fixture')
          + (select count(*) from projects where provenance <> 'demo-fixture') as n`
  )
  if (Number(real?.n ?? 0) > 0) throw new SeedRefusedError('This database holds non-demo data; the finance demo seed only runs on a demo/dev database.')

  const [existing] = await rawDb.query<{ n: string }>(
    `select (select count(*) from bank_accounts) + (select count(*) from customer_invoices)
          + (select count(*) from vendor_invoices) + (select count(*) from billing_schedule_items) as n`
  )
  if (Number(existing?.n ?? 0) > 0) return { skipped: true, accounts: 0, customerInvoices: 0, vendorInvoices: 0, transactions: 0 }

  const db = demoTagged(rawDb)
  const finance = await loadActor(db, 'USR-008', 'finance')
  const superAdmin = await loadActor(db, 'USR-010', 'super-admin')
  const T = todayBusinessDate()
  const d = (offset: number) => shiftDays(T, offset)
  const tx = <R>(fn: (q: Queryable) => Promise<R>) => db.transaction(fn)

  // ── Accounts: two verified (maker Finance → checker Super Admin), one still awaiting the checker ─────────
  const bca = await createAccount(db, finance, { code: 'BCA-OPS', bankName: 'BCA', holderName: 'PT MANOVA Wisata Indonesia', accountNumber: '8720415566' }, REQUEST_ID)
  const mandiri = await createAccount(db, finance, { code: 'MDR-VENDOR', bankName: 'Mandiri', holderName: 'PT MANOVA Wisata Indonesia', accountNumber: '1370012345678' }, REQUEST_ID)
  const bri = await createAccount(db, finance, { code: 'BRI-CADANGAN', bankName: 'BRI', holderName: 'PT MANOVA Wisata Indonesia', accountNumber: '002101005566307' }, REQUEST_ID)
  for (const [acc, amount] of [[bca, jt(750)], [mandiri, jt(320)]] as const) {
    await submitOpening(db, finance, acc.id, { amountMinor: amount, openingDate: d(-60), note: 'Saldo rekening koran per awal pencatatan' }, REQUEST_ID)
    await verifyOpening(db, superAdmin, acc.id, { balanceMinor: amount, openingDate: d(-60) }, REQUEST_ID, true)
  }
  await submitOpening(db, finance, bri.id, { amountMinor: jt(45), openingDate: d(-30), note: 'Rekening cadangan, menunggu verifikasi' }, REQUEST_ID)

  // ── Customer invoices ─────────────────────────────────────────────────────────────────────────────────
  async function scheduled(projectId: string, label: string, invoiceType: string, amount: string, plannedDate: string) {
    return (await tx(q => createScheduleItem(q, finance, { projectId, label, invoiceType, amountMinor: amount, plannedDate }, REQUEST_ID))).id as string
  }
  async function invoiceFrom(scheduleId: string, issueDate: string, dueDate: string) {
    const draft = await tx(q => createInvoiceDraft(q, finance, { billingScheduleItemId: scheduleId, dueDate }, REQUEST_ID))
    await tx(q => issueInvoice(q, finance, draft.id, { issueDate, dueDate }, REQUEST_ID))
    return draft.id as string
  }
  async function invoice(projectId: string, invoiceType: string, description: string, amount: string, issueDate: string | null, dueDate: string) {
    const draft = await tx(q => createInvoiceDraft(q, finance, { projectId, invoiceType, lines: [{ description, amountMinor: amount }], dueDate }, REQUEST_ID))
    if (issueDate) await tx(q => issueInvoice(q, finance, draft.id, { issueDate, dueDate }, REQUEST_ID))
    return draft.id as string
  }
  async function receipt(partyId: string, projectId: string | undefined, amount: string, date: string, reference: string, allocations: { invoiceId: string; amountMinor: string }[]) {
    return tx(q => postReceipt(q, finance, { bankAccountId: bca.id, amountMinor: amount, effectiveDate: date, partyId, projectId, reference, allocations: allocations.length ? allocations : undefined }, REQUEST_ID))
  }

  // PRJ-203 Manila Corporate Meeting (Rp 165 jt, selesai): lunas penuh.
  const m1 = await invoiceFrom(await scheduled('PRJ-203', 'DP 50%', 'dp', jt(82.5), d(-58)), d(-58), d(-50))
  await receipt('PTY-005', 'PRJ-203', jt(82.5), d(-52), 'BCA/TRF/0452', [{ invoiceId: m1, amountMinor: jt(82.5) }])
  const m2 = await invoiceFrom(await scheduled('PRJ-203', 'Pelunasan 50%', 'final', jt(82.5), d(-30)), d(-30), d(-16))
  await receipt('PTY-005', 'PRJ-203', jt(82.5), d(-18), 'BCA/TRF/0871', [{ invoiceId: m2, amountMinor: jt(82.5) }])

  // PRJ-202 Abu Dhabi Business Delegation (Rp 460 jt): DP lunas, pelunasan baru dibayar sebagian dan terlambat.
  const a1 = await invoiceFrom(await scheduled('PRJ-202', 'DP 50%', 'dp', jt(230), d(-40)), d(-40), d(-26))
  await receipt('PTY-005', 'PRJ-202', jt(230), d(-27), 'BCA/TRF/0633', [{ invoiceId: a1, amountMinor: jt(230) }])
  const a2 = await invoiceFrom(await scheduled('PRJ-202', 'Pelunasan 50%', 'final', jt(230), d(-14)), d(-14), d(-4))
  await receipt('PTY-005', 'PRJ-202', jt(80), d(-6), 'BCA/TRF/0990', [{ invoiceId: a2, amountMinor: jt(80) }])

  // PRJ-103 Palu MICE Conference (Rp 1,4 M): DP lunas, termin progres berjalan.
  const p1 = await invoice('PRJ-103', 'dp', 'DP 30% Palu MICE Conference 2026', jt(420), d(-45), d(-35))
  await receipt('PTY-003', 'PRJ-103', jt(420), d(-36), 'BCA/TRF/0588', [{ invoiceId: p1, amountMinor: jt(420) }])
  await invoice('PRJ-103', 'progress', 'Termin 2 — 40% setelah registrasi peserta', jt(560), d(-10), d(10))

  // PRJ-201 Korea Incentive Trip (Rp 980 jt): DP terbit dengan janji bayar, pelunasan masih rencana.
  const k1 = await invoiceFrom(await scheduled('PRJ-201', 'DP 30%', 'dp', jt(294), d(-12)), d(-12), d(3))
  await tx(q => setInvoiceExpectation(q, finance, k1, { expectedDate: d(5), reason: 'Customer: menunggu approval direksi, transfer dijadwalkan' }, REQUEST_ID))
  await scheduled('PRJ-201', 'Pelunasan 70%', 'final', jt(686), d(25))

  // PRJ-101 Manila Business Trip (Rp 95 jt): terlambat, dengan kompensasi credit note.
  const mb = await invoice('PRJ-101', 'final', 'Paket Manila Business Trip — pelunasan', jt(95), d(-25), d(-10))
  await tx(q => issueCreditNote(q, finance, { invoiceId: mb, amountMinor: jt(5), reason: 'Kompensasi perubahan jadwal penerbangan' }, REQUEST_ID))

  // PRJ-102 Abu Dhabi Corporate Gathering: draft, belum terbit (bukan piutang).
  await invoice('PRJ-102', 'dp', 'DP 30% Abu Dhabi Corporate Gathering', jt(103.5), null, d(14))

  // Uang muka customer untuk PRJ-204 — diterima, belum ada invoice.
  await receipt('PTY-005', 'PRJ-204', jt(50), d(-3), 'BCA/TRF/1024', [])

  // ── Vendor invoices ───────────────────────────────────────────────────────────────────────────────────
  async function vendorInvoice(input: { vendorId: string; number: string; projectId?: string; serviceOrderId?: string; invoiceDate: string; dueDate: string; amount: string; approve: boolean }) {
    const inv = await tx(q => createVendorInvoice(q, finance, {
      vendorId: input.vendorId, vendorInvoiceNumber: input.number, projectId: input.projectId, serviceOrderId: input.serviceOrderId,
      invoiceDate: input.invoiceDate, dueDate: input.dueDate, totalMinor: input.amount
    }, REQUEST_ID))
    if (input.approve) await tx(q => reviewVendorInvoice(q, finance, inv.id, { action: 'approve', matchStatus: 'matched', note: 'Sesuai service order dan rooming list' }, REQUEST_ID))
    return inv.id as string
  }
  async function vendorPayment(vendorId: string, projectId: string | undefined, amount: string, date: string, reference: string, vendorInvoiceId: string) {
    return tx(q => postVendorPayment(q, finance, { bankAccountId: mandiri.id, amountMinor: amount, effectiveDate: date, vendorId, projectId, reference, allocations: [{ vendorInvoiceId, amountMinor: amount }] }, REQUEST_ID))
  }

  // Top up the vendor account first (BCA → Mandiri), with a bank fee.
  await tx(q => postTransfer(q, finance, { fromAccountId: bca.id, toAccountId: mandiri.id, amountMinor: jt(250), feeMinor: '2500', effectiveDate: d(-40), memo: 'Top up rekening pembayaran vendor' }, REQUEST_ID))

  const hp = await vendorInvoice({ vendorId: 'VND-002', number: 'HPM-7781', projectId: 'PRJ-203', invoiceDate: d(-45), dueDate: d(-35), amount: jt(58.5), approve: true })
  await vendorPayment('VND-002', 'PRJ-203', jt(58.5), d(-36), 'MDR/OUT/0311', hp)
  const cm = await vendorInvoice({ vendorId: 'VND-004', number: 'CMO-INV-221', projectId: 'PRJ-103', invoiceDate: d(-40), dueDate: d(-20), amount: jt(312), approve: true })
  await vendorPayment('VND-004', 'PRJ-103', jt(312), d(-21), 'MDR/OUT/0402', cm)
  const abc = await vendorInvoice({ vendorId: 'VND-006', number: 'ABC/INV/0912', projectId: 'PRJ-202', invoiceDate: d(-30), dueDate: d(-5), amount: jt(186), approve: true })
  await vendorPayment('VND-006', 'PRJ-202', jt(100), d(-8), 'MDR/OUT/0477', abc)
  await vendorInvoice({ vendorId: 'VND-001', number: 'TMN-2026-0418', projectId: 'PRJ-201', invoiceDate: d(-6), dueDate: d(9), amount: jt(245), approve: true })
  await vendorInvoice({ vendorId: 'VND-003', number: 'TWL/0917/88', serviceOrderId: 'SO-001', invoiceDate: d(-2), dueDate: d(12), amount: jt(64.8), approve: false })

  // ── Operating income & expenses (BCA) ───────────────────────────────────────────────────────────────
  const expense = (category: string, amount: string, date: string, counterparty: string, memo: string) =>
    tx(q => postManualTransaction(q, finance, { bankAccountId: bca.id, kind: 'expense', category, amountMinor: amount, effectiveDate: date, counterparty, memo }, REQUEST_ID))
  await expense('office', jt(42), d(-45), 'PT Graha Perkantoran', 'Sewa kantor bulan berjalan')
  await expense('payroll', jt(180), d(-30), 'Karyawan MANOVA', 'Gaji bulanan')
  await expense('marketing', jt(15), d(-20), 'Meta Ads', 'Kampanye corporate travel Q4')
  await expense('technology', jt(8.9), d(-10), 'Google Workspace & Zoom', 'Langganan software')
  const wrong = await expense('office', jt(12.5), d(-15), 'Toko ATK Sentosa', 'Perlengkapan kantor')
  await tx(q => reverseTransaction(q, finance, wrong.transactionId, 'Salah rekening — dibayar dari kas kecil, bukan BCA', REQUEST_ID))
  await tx(q => postManualTransaction(q, finance, { bankAccountId: bca.id, kind: 'other_income', amountMinor: jt(7.25), effectiveDate: d(-5), counterparty: 'Korean Air', memo: 'Komisi penjualan tiket grup' }, REQUEST_ID))

  const [counts] = await rawDb.query<{ ci: string; vi: string; ft: string }>(
    'select (select count(*) from customer_invoices) as ci, (select count(*) from vendor_invoices) as vi, (select count(*) from financial_transactions) as ft'
  )
  return { skipped: false, accounts: 3, customerInvoices: Number(counts!.ci), vendorInvoices: Number(counts!.vi), transactions: Number(counts!.ft) }
}
