import type { AppEnv } from '../config/env'
import { createAccount, submitOpening, verifyOpening } from '../modules/finance/accounts'
import { todayBusinessDate } from '../modules/finance/common'
import { postManualTransaction, postTransfer } from '../modules/finance/postings'
import { createVendorInvoice, postVendorPayment, reviewVendorInvoice } from '../modules/finance/payables'
import { createInvoiceDraft, createScheduleItem, issueInvoice, postReceipt, setInvoiceExpectation } from '../modules/finance/receivables'
import type { Db, Queryable } from './client'
import { SeedRefusedError } from './seed-demo'
import { type FinanceSeedResult, demoTagged, loadActor, seedPolicies, shiftDays } from './seed-finance-demo'

/**
 * "Perusahaan berjalan 1 tahun" (`bun run db:seed:year-demo`), pengganti `db:seed:finance-demo` untuk demo ke
 * klien/atasan. Spec: docs/superpowers/specs/2026-10-05-year-demo-data-design.md.
 *
 * Kalender tetap: rekening dibuka 1 Sep 2025, project histori PRJ-301 … PRJ-340 berangkat Nov 2025 – Okt 2026,
 * dan 11 project demo lama meniru keadaan `db:seed:finance-demo` dengan acuan 5 Okt 2026. Semua kejadian
 * dikumpulkan dulu, diurutkan per tanggal, lalu dijalankan lewat layanan finance asli (validasi, trigger, audit
 * yang sama dengan API). Kejadian bertanggal setelah hari ini dilewati, karena layanan menolak tanggal masa depan.
 *
 * Tidak ada credit note, reverse, atau refund: layanan itu selalu mencatat tanggal hari ini.
 * Aturan sama dengan seed finance lama: ditolak di production, ditolak bila ada data non-demo, tidak melakukan
 * apa-apa bila data finance sudah ada.
 */

const REQUEST_ID = 'seed-year-demo'
const OPENING_DATE = '2025-09-01'
/** Acuan cerita 11 project demo lama (sama dengan "hari ini" saat spec disusun). */
const ANCHOR = '2026-10-05'
const TRANSFER_FEE = '6500'

const jt = (millions: number) => String(Math.round(millions * 1_000_000))
const rp = (minor: string) => Number(minor)
/** Dibulatkan ke ribuan rupiah supaya nominal di layar terlihat wajar. */
const roundRibu = (n: number) => String(Math.round(n / 1000) * 1000)

/** Pelunasan yang dibayar terlambat (hari setelah jatuh tempo). */
const LATE_DAYS: Record<string, number> = { 'PRJ-302': 12, 'PRJ-306': 20, 'PRJ-313': 7, 'PRJ-318': 25, 'PRJ-324': 15, 'PRJ-331': 9 }
/** Pelunasan yang belum dibayar sampai hari ini (porsi yang sudah dibayar). */
const UNPAID_SHARE: Record<string, number> = { 'PRJ-329': 0.5, 'PRJ-335': 0, 'PRJ-337': 0, 'PRJ-340': 0 }
/** Bobot porsi biaya vendor per jenis layanan (dinormalkan per project). */
const SERVICE_WEIGHT: Record<string, number> = { flight: 0.45, hotel: 0.4, transportation: 0.15, mice: 0.4, additional: 0.05 }
const VENDOR_PREFIX: Record<string, string> = { 'VND-001': 'TMN', 'VND-002': 'HPM', 'VND-003': 'TWL', 'VND-004': 'CMO', 'VND-005': 'WKE', 'VND-007': 'EFG' }

interface Event {
  date: string
  /** Urutan di hari yang sama: tagihan dulu, lalu uang masuk, lalu uang keluar. */
  order: number
  run: () => Promise<unknown>
}

export async function seedYearDemo(rawDb: Db, options: { appEnv: AppEnv }): Promise<FinanceSeedResult> {
  if (options.appEnv === 'production') throw new SeedRefusedError('Year demo seed is disabled in production (APP_ENV=production).')
  const [real] = await rawDb.query<{ n: string }>(
    `select (select count(*) from users where provenance <> 'demo-fixture')
          + (select count(*) from projects where provenance <> 'demo-fixture') as n`
  )
  if (Number(real?.n ?? 0) > 0) throw new SeedRefusedError('This database holds non-demo data; the year demo seed only runs on a demo/dev database.')
  const [history] = await rawDb.query<{ n: string }>("select count(*) as n from projects where id between 'PRJ-301' and 'PRJ-399'")
  if (Number(history?.n ?? 0) === 0) throw new SeedRefusedError('History projects PRJ-301… are missing — run `bun run db:seed:demo` first (demo-core.json from `seed:extract`).')

  const [existing] = await rawDb.query<{ n: string }>(
    `select (select count(*) from bank_accounts) + (select count(*) from customer_invoices)
          + (select count(*) from vendor_invoices) + (select count(*) from billing_schedule_items) as n`
  )
  const db = demoTagged(rawDb)
  const finance = await loadActor(db, 'USR-008', 'finance')
  const superAdmin = await loadActor(db, 'USR-010', 'super-admin')
  if (Number(existing?.n ?? 0) > 0) {
    return { skipped: true, accounts: 0, customerInvoices: 0, vendorInvoices: 0, transactions: 0, policies: await seedPolicies(db, finance) }
  }
  const today = todayBusinessDate()
  const tx = <R>(fn: (q: Queryable) => Promise<R>) => db.transaction(fn)

  // ── Rekening: dibuka 1 Sep 2025, diajukan Finance, diverifikasi Super Admin ───────────────────────────────
  const holder = 'PT MANOVA Wisata Indonesia'
  const bca = await createAccount(db, finance, { code: 'BCA-OPS', bankName: 'BCA', holderName: holder, accountNumber: '8720415566' }, REQUEST_ID)
  const mandiri = await createAccount(db, finance, { code: 'MDR-VENDOR', bankName: 'Mandiri', holderName: holder, accountNumber: '1370012345678' }, REQUEST_ID)
  const bri = await createAccount(db, finance, { code: 'BRI-CADANGAN', bankName: 'BRI', holderName: holder, accountNumber: '002101005566307' }, REQUEST_ID)
  const balance = { bca: rp(jt(1500)), mandiri: rp(jt(400)) }
  for (const [acc, amount] of [[bca, jt(1500)], [mandiri, jt(400)], [bri, jt(250)]] as const) {
    await submitOpening(db, finance, acc.id, { amountMinor: amount, openingDate: OPENING_DATE, note: 'Saldo rekening koran per awal pencatatan di sistem' }, REQUEST_ID)
    await verifyOpening(db, superAdmin, acc.id, { balanceMinor: amount, openingDate: OPENING_DATE }, REQUEST_ID, true)
  }

  const events: Event[] = []
  const at = (date: string, order: number, run: () => Promise<unknown>) => { events.push({ date, order, run }) }

  // ── Pembantu kejadian ───────────────────────────────────────────────────────────────────────────────────
  async function issueDirect(projectId: string, invoiceType: string, description: string, amount: string, issueDate: string, dueDate: string) {
    const draft = await tx(q => createInvoiceDraft(q, finance, { projectId, invoiceType, lines: [{ description, amountMinor: amount }], dueDate }, REQUEST_ID))
    await tx(q => issueInvoice(q, finance, draft.id, { issueDate, dueDate }, REQUEST_ID))
    return draft.id as string
  }
  async function issueScheduled(projectId: string, label: string, invoiceType: string, amount: string, issueDate: string, dueDate: string) {
    const item = await tx(q => createScheduleItem(q, finance, { projectId, label, invoiceType, amountMinor: amount, plannedDate: issueDate }, REQUEST_ID))
    const draft = await tx(q => createInvoiceDraft(q, finance, { billingScheduleItemId: item.id, dueDate }, REQUEST_ID))
    await tx(q => issueInvoice(q, finance, draft.id, { issueDate, dueDate }, REQUEST_ID))
    return draft.id as string
  }
  async function receipt(partyId: string, projectId: string, amount: string, date: string, reference: string, invoiceId?: string) {
    await tx(q => postReceipt(q, finance, {
      bankAccountId: bca.id, amountMinor: amount, effectiveDate: date, partyId, projectId, reference,
      allocations: invoiceId ? [{ invoiceId, amountMinor: amount }] : undefined
    }, REQUEST_ID))
    balance.bca += rp(amount)
  }
  async function vendorInvoice(input: { vendorId: string; number: string; projectId?: string; serviceOrderId?: string; invoiceDate: string; dueDate: string; amount: string; approve: boolean }) {
    const inv = await tx(q => createVendorInvoice(q, finance, {
      vendorId: input.vendorId, vendorInvoiceNumber: input.number, projectId: input.projectId, serviceOrderId: input.serviceOrderId,
      invoiceDate: input.invoiceDate, dueDate: input.dueDate, totalMinor: input.amount
    }, REQUEST_ID))
    if (input.approve) await tx(q => reviewVendorInvoice(q, finance, inv.id, { action: 'approve', matchStatus: 'matched', note: 'Sesuai service order dan konfirmasi booking' }, REQUEST_ID))
    return inv.id as string
  }
  /** Bayar vendor dari Mandiri; bila saldonya kurang, top up dari BCA lebih dulu di hari yang sama. */
  async function vendorPayment(vendorId: string, projectId: string | undefined, amount: string, date: string, reference: string, vendorInvoiceId: string) {
    const need = rp(amount) - balance.mandiri
    if (need > 0) {
      const step = rp(jt(250))
      const topUp = Math.ceil((need + rp(jt(50))) / step) * step
      await tx(q => postTransfer(q, finance, { fromAccountId: bca.id, toAccountId: mandiri.id, amountMinor: String(topUp), feeMinor: TRANSFER_FEE, effectiveDate: date, memo: 'Top up rekening pembayaran vendor' }, REQUEST_ID))
      balance.bca -= topUp + rp(TRANSFER_FEE)
      balance.mandiri += topUp
    }
    await tx(q => postVendorPayment(q, finance, { bankAccountId: mandiri.id, amountMinor: amount, effectiveDate: date, vendorId, projectId, reference, allocations: [{ vendorInvoiceId, amountMinor: amount }] }, REQUEST_ID))
    balance.mandiri -= rp(amount)
  }
  async function expense(category: string, amount: string, date: string, counterparty: string, memo: string) {
    await tx(q => postManualTransaction(q, finance, { bankAccountId: bca.id, kind: 'expense', category, amountMinor: amount, effectiveDate: date, counterparty, memo }, REQUEST_ID))
    balance.bca -= rp(amount)
  }
  async function otherIncome(amount: string, date: string, counterparty: string, memo: string) {
    await tx(q => postManualTransaction(q, finance, { bankAccountId: bca.id, kind: 'other_income', amountMinor: amount, effectiveDate: date, counterparty, memo }, REQUEST_ID))
    balance.bca += rp(amount)
  }

  // ── Project histori PRJ-301 … PRJ-340 ───────────────────────────────────────────────────────────────────
  const projects = await rawDb.query<{ id: string; name: string; party_id: string; start: string; contract: string }>(
    `select id, name, party_id, to_char(travel_start_date, 'YYYY-MM-DD') as start, contract_value_minor::text as contract
       from projects where id between 'PRJ-301' and 'PRJ-399' order by id`
  )
  const services = await rawDb.query<{ id: string; project_id: string; service_type: string; vendor_id: string | null }>(
    "select id, project_id, service_type, vendor_id from project_services where project_id between 'PRJ-301' and 'PRJ-399' order by id"
  )
  for (const p of projects) {
    const n = Number(p.id.slice(4))
    const contract = rp(p.contract)
    const dpShare = [0.3, 0.4, 0.5][n % 3]!
    const dp = roundRibu(contract * dpShare)
    const final = String(contract - rp(dp))
    const ref = (kind: string, date: string) => `BCA/${kind}/${date.slice(2, 4)}${date.slice(5, 7)}/${n}`
    const state: { dp?: string; final?: string } = {}

    // DP: terbit H-60, jatuh tempo +7 hari, dibayar 5 hari setelah terbit.
    const dpIssue = shiftDays(p.start, -60)
    at(dpIssue, 0, async () => { state.dp = await issueDirect(p.id, 'dp', `DP ${Math.round(dpShare * 100)}% ${p.name}`, dp, dpIssue, shiftDays(dpIssue, 7)) })
    at(shiftDays(dpIssue, 5), 2, () => receipt(p.party_id, p.id, dp, shiftDays(dpIssue, 5), ref('DP', shiftDays(dpIssue, 5)), state.dp))

    // Pelunasan: terbit H-21, jatuh tempo H-14.
    const finalIssue = shiftDays(p.start, -21)
    const finalDue = shiftDays(p.start, -14)
    at(finalIssue, 0, async () => { state.final = await issueDirect(p.id, 'final', `Pelunasan ${p.name}`, final, finalIssue, finalDue) })
    const unpaid = UNPAID_SHARE[p.id]
    if (unpaid === undefined) {
      const paidOn = shiftDays(finalDue, LATE_DAYS[p.id] ?? -2)
      at(paidOn, 2, () => receipt(p.party_id, p.id, final, paidOn, ref('LNS', paidOn), state.final))
    } else if (unpaid > 0) {
      const partial = roundRibu(rp(final) * unpaid)
      const paidOn = shiftDays(finalDue, 10)
      at(paidOn, 2, () => receipt(p.party_id, p.id, partial, paidOn, ref('LNS', paidOn), state.final))
    }

    // Vendor: tagihan H-30 (jatuh tempo H-7), disetujui, dibayar H-10. Total 75–80% kontrak.
    const own = services.filter(s => s.project_id === p.id && s.vendor_id)
    const weight = own.reduce((sum, s) => sum + (SERVICE_WEIGHT[s.service_type] ?? 0.1), 0)
    const cost = contract * (0.75 + (n % 6) * 0.01)
    own.forEach((s, i) => {
      const amount = roundRibu(cost * (SERVICE_WEIGHT[s.service_type] ?? 0.1) / weight)
      const vendorId = s.vendor_id!
      const number = `${VENDOR_PREFIX[vendorId] ?? 'INV'}/${p.start.slice(2, 4)}${p.start.slice(5, 7)}/${n}${i + 1}`
      const invDate = shiftDays(p.start, -30)
      const payDate = shiftDays(p.start, -10)
      const vstate: { id?: string } = {}
      at(invDate, 1, async () => { vstate.id = await vendorInvoice({ vendorId, number, projectId: p.id, invoiceDate: invDate, dueDate: shiftDays(p.start, -7), amount, approve: true }) })
      at(payDate, 3, () => vendorPayment(vendorId, p.id, amount, payDate, `MDR/OUT/${n}${i + 1}`, vstate.id!))
    })
  }

  // ── Biaya operasional bulanan dan komisi maskapai ───────────────────────────────────────────────────────
  for (let m = 0; m < 14; m++) {
    const month = shiftMonth('2025-09-01', m)
    const ym = month.slice(0, 7)
    const day = (d: number) => `${ym}-${String(d).padStart(2, '0')}`
    const peakMarketing = ['2025-10', '2026-01', '2026-05'].includes(ym)
    at(day(3), 4, () => expense('office', jt(35), day(3), 'PT Graha Perkantoran', 'Sewa kantor bulanan'))
    at(day(10), 4, () => expense('office', jt(8), day(10), 'PLN & Indihome', 'Listrik dan internet kantor'))
    at(day(12), 4, () => expense('technology', jt(6), day(12), 'Google Workspace & Zoom', 'Langganan software'))
    at(day(18), 4, () => expense('marketing', jt(peakMarketing ? 30 : 15), day(18), 'Meta & Google Ads', peakMarketing ? 'Kampanye menjelang musim ramai' : 'Iklan digital bulanan'))
    at(day(25), 4, () => expense('payroll', jt(180), day(25), 'Karyawan MANOVA', 'Gaji bulanan'))
    at(day(15), 2, () => otherIncome(jt(2.5 + (m % 4) * 1.5), day(15), 'Garuda Indonesia', 'Komisi penjualan tiket grup'))
  }
  at('2026-03-10', 4, () => expense('payroll', jt(180), '2026-03-10', 'Karyawan MANOVA', 'THR Idul Fitri'))
  at('2026-04-28', 4, () => expense('tax', jt(95), '2026-04-28', 'Kas Negara', 'PPh Badan tahun 2025'))

  // ── 11 project demo lama: keadaan sama dengan db:seed:finance-demo, acuan 5 Okt 2026 ────────────────────
  const d = (offset: number) => shiftDays(ANCHOR, offset)
  const old: Record<string, string> = {}
  at(d(-58), 0, async () => { old.m1 = await issueScheduled('PRJ-203', 'DP 50%', 'dp', jt(82.5), d(-58), d(-50)) })
  at(d(-52), 2, () => receipt('PTY-005', 'PRJ-203', jt(82.5), d(-52), 'BCA/TRF/0452', old.m1))
  at(d(-30), 0, async () => { old.m2 = await issueScheduled('PRJ-203', 'Pelunasan 50%', 'final', jt(82.5), d(-30), d(-16)) })
  at(d(-18), 2, () => receipt('PTY-005', 'PRJ-203', jt(82.5), d(-18), 'BCA/TRF/0871', old.m2))

  at(d(-40), 0, async () => { old.a1 = await issueScheduled('PRJ-202', 'DP 50%', 'dp', jt(230), d(-40), d(-26)) })
  at(d(-27), 2, () => receipt('PTY-005', 'PRJ-202', jt(230), d(-27), 'BCA/TRF/0633', old.a1))
  at(d(-14), 0, async () => { old.a2 = await issueScheduled('PRJ-202', 'Pelunasan 50%', 'final', jt(230), d(-14), d(-4)) })
  at(d(-6), 2, () => receipt('PTY-005', 'PRJ-202', jt(80), d(-6), 'BCA/TRF/0990', old.a2))

  at(d(-45), 0, async () => { old.p1 = await issueDirect('PRJ-103', 'dp', 'DP 30% Palu MICE Conference 2026', jt(420), d(-45), d(-35)) })
  at(d(-36), 2, () => receipt('PTY-003', 'PRJ-103', jt(420), d(-36), 'BCA/TRF/0588', old.p1))
  at(d(-10), 0, () => issueDirect('PRJ-103', 'progress', 'Termin 2 — 40% setelah registrasi peserta', jt(560), d(-10), d(10)))

  at(d(-12), 0, async () => {
    const k1 = await issueScheduled('PRJ-201', 'DP 30%', 'dp', jt(294), d(-12), d(3))
    await tx(q => setInvoiceExpectation(q, finance, k1, { expectedDate: d(5), reason: 'Customer: menunggu approval direksi, transfer dijadwalkan' }, REQUEST_ID))
    await tx(q => createScheduleItem(q, finance, { projectId: 'PRJ-201', label: 'Pelunasan 70%', invoiceType: 'final', amountMinor: jt(686), plannedDate: d(25) }, REQUEST_ID))
  })
  at(d(-25), 0, () => issueDirect('PRJ-101', 'final', 'Paket Manila Business Trip — pelunasan', jt(95), d(-25), d(-10)))
  at(d(-3), 2, () => receipt('PTY-005', 'PRJ-204', jt(50), d(-3), 'BCA/TRF/1024'))

  const ov: Record<string, string> = {}
  at(d(-45), 1, async () => { ov.hp = await vendorInvoice({ vendorId: 'VND-002', number: 'HPM-7781', projectId: 'PRJ-203', invoiceDate: d(-45), dueDate: d(-35), amount: jt(58.5), approve: true }) })
  at(d(-36), 3, () => vendorPayment('VND-002', 'PRJ-203', jt(58.5), d(-36), 'MDR/OUT/0311', ov.hp!))
  at(d(-40), 1, async () => { ov.cm = await vendorInvoice({ vendorId: 'VND-004', number: 'CMO-INV-221', projectId: 'PRJ-103', invoiceDate: d(-40), dueDate: d(-20), amount: jt(312), approve: true }) })
  at(d(-21), 3, () => vendorPayment('VND-004', 'PRJ-103', jt(312), d(-21), 'MDR/OUT/0402', ov.cm!))
  at(d(-30), 1, async () => { ov.abc = await vendorInvoice({ vendorId: 'VND-006', number: 'ABC/INV/0912', projectId: 'PRJ-202', invoiceDate: d(-30), dueDate: d(-5), amount: jt(186), approve: true }) })
  at(d(-8), 3, () => vendorPayment('VND-006', 'PRJ-202', jt(100), d(-8), 'MDR/OUT/0477', ov.abc!))
  at(d(-6), 1, () => vendorInvoice({ vendorId: 'VND-001', number: 'TMN-2026-0418', projectId: 'PRJ-201', invoiceDate: d(-6), dueDate: d(9), amount: jt(245), approve: true }))
  at(d(-2), 1, () => vendorInvoice({ vendorId: 'VND-003', number: 'TWL/0917/88', serviceOrderId: 'SO-001', invoiceDate: d(-2), dueDate: d(12), amount: jt(64.8), approve: false }))

  // PRJ-102: draft, belum terbit — dibuat terakhir agar tidak mengganggu urutan nomor invoice.
  const draft102 = async () => tx(q => createInvoiceDraft(q, finance, { projectId: 'PRJ-102', invoiceType: 'dp', lines: [{ description: 'DP 30% Abu Dhabi Corporate Gathering', amountMinor: jt(103.5) }], dueDate: d(14) }, REQUEST_ID))

  // ── Jalankan berurutan ──────────────────────────────────────────────────────────────────────────────────
  const ordered = events
    .map((e, i) => ({ ...e, i }))
    .filter(e => e.date >= OPENING_DATE && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.i - b.i)
  for (const e of ordered) await e.run()
  await draft102()

  const [counts] = await rawDb.query<{ ci: string; vi: string; ft: string }>(
    'select (select count(*) from customer_invoices) as ci, (select count(*) from vendor_invoices) as vi, (select count(*) from financial_transactions) as ft'
  )
  return { skipped: false, accounts: 3, customerInvoices: Number(counts!.ci), vendorInvoices: Number(counts!.vi), transactions: Number(counts!.ft), policies: await seedPolicies(db, finance) }
}

/** Tanggal 1 pada bulan ke-`months` setelah `iso` (YYYY-MM-01). */
function shiftMonth(iso: string, months: number): string {
  const [y, m] = iso.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}
