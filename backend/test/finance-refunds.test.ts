import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { todayBusinessDate } from '../src/modules/finance/common'
import { applyTier, tierFor, validateTiers } from '../src/modules/finance/policies'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Finance Phase 5 — cancellation policies, cancellation cases, refunds (docs/.../08).
 * Acceptance: H-7, DP posted Rp 20 jt (of Rp 30 jt billed), policy 70/30 at H-7 → refund Rp 6 jt, retained
 * Rp 14 jt; no money moves before settlement; settlement posts once; a policy v2 never changes the case.
 */

let t: TestApp
const who: Record<string, string> = {}
let keySeq = 0
const newKey = () => `rf-${Date.now()}-${++keySeq}`
const TODAY = todayBusinessDate()
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const req = (method: string, as: string, path: string, body?: unknown, key?: string) =>
  t.call(method, `/api/v1${path}`, { cookie: who[as], body, headers: key ? { 'idempotency-key': key } : {} })
const get = (as: string, path: string) => req('GET', as, path)
const post = (as: string, path: string, body?: unknown) => req('POST', as, path, body ?? {})
const money = (as: string, path: string, body: unknown, key = newKey()) => req('POST', as, path, body, key)

const STANDARD_TIERS = [
  { minDays: 30, maxDays: null, refundBp: 10_000 },
  { minDays: 14, maxDays: 30, refundBp: 5_000 },
  { minDays: 7, maxDays: 14, refundBp: 3_000 },
  { minDays: 1, maxDays: 7, refundBp: 0 },
  { minDays: null, maxDays: 1, refundBp: 0 }
]

let bank: string
let policyId: string
const balance = async () => (await get('finance', `/finance/accounts/${bank}`)).json.data.balance.currentMinor

beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries({ finance: DEMO.finance, superAdmin: DEMO.superAdmin, admin: DEMO.admin })) who[k] = await t.login(email)
  const acc = await post('finance', '/finance/accounts', { code: 'BCA-RF', bankName: 'BCA', holderName: 'PT MANOVA', accountNumber: '1234567890' })
  bank = acc.json.data.id
  await post('finance', `/finance/accounts/${bank}/opening`, { amountMinor: '500000000', openingDate: addDays(TODAY, -60) })
  await post('superAdmin', `/finance/accounts/${bank}/opening/verify`, { balanceMinor: '500000000', openingDate: addDays(TODAY, -60) })
  // Departure today for FLT-1021 (so any H is reachable with a past cancel date); project PRJ-104 in 20 days.
  await t.db.query("update booking_refs set departure_date = $1 where booking_type = 'flight' and booking_id = 'FLT-1021'", [TODAY])
  await t.db.query("update projects set travel_start_date = $1 where id = 'PRJ-104'", [addDays(TODAY, 20)])
})
afterAll(() => t.cleanup())

describe('tier rules (pure)', () => {
  const tiers = validateTiers(STANDARD_TIERS)
  test('boundaries are inclusive at the lower bound: H-30, H-14, H-7, H-1, H0 and after departure', () => {
    expect(tierFor(tiers, 30).refundBp).toBe(10_000)
    expect(tierFor(tiers, 29).refundBp).toBe(5_000)
    expect(tierFor(tiers, 14).refundBp).toBe(5_000)
    expect(tierFor(tiers, 13).refundBp).toBe(3_000)
    expect(tierFor(tiers, 7).refundBp).toBe(3_000)
    expect(tierFor(tiers, 6).refundBp).toBe(0)
    expect(tierFor(tiers, 1).refundBp).toBe(0)
    expect(tierFor(tiers, 0).minDays).toBeNull()
    expect(tierFor(tiers, -5).minDays).toBeNull()
  })
  test('refund is floored to whole rupiah; retained is the exact remainder', () => {
    expect(applyTier(20_000_000n, tierFor(tiers, 7))).toEqual({ refund: 6_000_000n, retained: 14_000_000n })
    expect(applyTier(10_001n, tierFor(tiers, 7))).toEqual({ refund: 3_000n, retained: 7_001n })
  })
  test('gaps, overlaps and missing open ends are refused', () => {
    expect(() => validateTiers([{ minDays: 7, maxDays: null, refundBp: 5000 }, { minDays: null, maxDays: 5, refundBp: 0 }])).toThrow()
    expect(() => validateTiers([{ minDays: 5, maxDays: null, refundBp: 5000 }, { minDays: null, maxDays: 7, refundBp: 0 }])).toThrow()
    expect(() => validateTiers([{ minDays: 7, maxDays: null, refundBp: 5000 }])).toThrow() // nothing for H<7
    expect(() => validateTiers([{ minDays: null, maxDays: 7, refundBp: 0 }])).toThrow() // nothing for H≥7
    expect(() => validateTiers([{ minDays: null, maxDays: null, refundBp: 10_001 }])).toThrow()
  })
})

describe('policies: draft → published (frozen) → new version', () => {
  test('a draft with a gap is refused with a clear message; a complete one is saved', async () => {
    const bad = await post('finance', '/finance/policies', { code: 'STD', name: 'Standar', effectiveFrom: addDays(TODAY, -10), tiers: STANDARD_TIERS.slice(0, 3) })
    expect(bad.status).toBe(400)
    expect(bad.json.error.fieldErrors.tiers[0]).toContain('keberangkatan')
    const ok = await post('finance', '/finance/policies', { code: 'STD', name: 'Standar DP', effectiveFrom: addDays(TODAY, -10), tiers: STANDARD_TIERS })
    expect(ok.status).toBe(201)
    expect(ok.json.data).toMatchObject({ code: 'STD', version: 1, status: 'draft' })
    expect(ok.json.data.tiers.map((x: { refundBp: number }) => x.refundBp)).toEqual([0, 0, 3000, 5000, 10000])
    policyId = ok.json.data.id
  })

  test('only Finance manages policies; Admin can read them', async () => {
    expect((await post('admin', '/finance/policies', { code: 'X', name: 'X', effectiveFrom: TODAY, tiers: STANDARD_TIERS })).status).toBe(403)
    expect((await get('admin', `/finance/policies/${policyId}`)).status).toBe(200)
  })

  test('a new version of an expired policy starts today without the old end date (no 500)', async () => {
    const old = await post('finance', '/finance/policies', { code: 'OLD', name: 'Lama', effectiveFrom: addDays(TODAY, -200), effectiveTo: addDays(TODAY, -100), tiers: STANDARD_TIERS })
    await post('finance', `/finance/policies/${old.json.data.id}/publish`)
    const v2 = await post('finance', `/finance/policies/${old.json.data.id}/new-version`)
    expect(v2.status).toBe(201)
    expect(v2.json.data).toMatchObject({ version: 2, effectiveFrom: TODAY, effectiveTo: null })
  })

  test('publishing freezes it, even against raw SQL', async () => {
    expect((await post('finance', `/finance/policies/${policyId}/publish`)).json.data.status).toBe('published')
    expect((await req('PATCH', 'finance', `/finance/policies/${policyId}`, { name: 'Ubah' })).status).toBe(422)
    await expect(t.db.query("update cancellation_policy_tiers set refund_bp = 10000 where policy_id = $1", [policyId])).rejects.toThrow('frozen')
    await expect(t.db.query("update cancellation_policies set name = 'x' where id = $1", [policyId])).rejects.toThrow('new version')
    const draft = await post('finance', '/finance/policies', { code: 'TMP', name: 'Sementara', effectiveFrom: TODAY, tiers: STANDARD_TIERS })
    await expect(t.db.query('update cancellation_policy_tiers set policy_id = $2 where policy_id = $1', [policyId, draft.json.data.id])).rejects.toThrow('frozen')
    await req('DELETE', 'finance', `/finance/policies/${draft.json.data.id}`)
  })
})

describe('acceptance: H-7, DP posted Rp 20 jt, 70/30 → refund Rp 6 jt', () => {
  let dpInvoice: string
  let caseId: string
  let settlementTx: string
  let dpReceipt: string

  test('setup: DP invoice Rp 30 jt on FLT-1021, only Rp 20 jt received; policy assigned (snapshot v1)', async () => {
    const draft = await post('finance', '/finance/customer-invoices', {
      projectId: 'PRJ-102', booking: { type: 'flight', id: 'FLT-1021' }, invoiceType: 'dp', lines: [{ description: 'DP tiket', amountMinor: '30000000' }], dueDate: TODAY
    })
    dpInvoice = draft.json.data.id
    await post('finance', `/finance/customer-invoices/${dpInvoice}/issue`, { issueDate: addDays(TODAY, -20), dueDate: addDays(TODAY, -10) })
    const receipt = await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '20000000', effectiveDate: addDays(TODAY, -15), partyId: 'PTY-002', allocations: [{ invoiceId: dpInvoice, amountMinor: '20000000' }] })
    dpReceipt = receipt.json.data.transactionId
    const assigned = await req('PUT', 'finance', '/finance/cancellation-policy/flight/FLT-1021', { policyId })
    expect(assigned.status).toBe(200)
    expect(assigned.json.data).toMatchObject({ policyId, version: 1 })
  })

  test('preview at H-30/H-14/H-7/H-1/H0 follows the tiers and changes nothing', async () => {
    const before = await balance()
    const at = async (h: number) => (await post('finance', '/finance/cancellations/preview', { subjectType: 'flight', subjectId: 'FLT-1021', cancelDate: addDays(TODAY, -h) })).json.data
    expect((await at(30)).policyRefundMinor).toBe('20000000')
    expect((await at(14)).policyRefundMinor).toBe('10000000')
    const h7 = await at(7)
    expect(h7).toMatchObject({ daysBefore: 7, basisMinor: '20000000', policyRefundMinor: '6000000', retainedMinor: '14000000', writeOffMinor: '10000000', canCalculate: true })
    expect(h7.sourcePayments).toEqual([expect.objectContaining({ invoiceId: dpInvoice, amountMinor: '20000000' })])
    expect((await at(1)).policyRefundMinor).toBe('0')
    expect((await at(0)).tier.minDays).toBeNull()
    expect(await balance()).toBe(before)
    expect((await get('finance', `/finance/customer-invoices/${dpInvoice}`)).json.data.outstandingMinor).toBe('10000000')
  })

  test('Admin sees the policy, H-x and percentages — never an amount', async () => {
    const res = await post('admin', '/finance/cancellations/preview', { subjectType: 'flight', subjectId: 'FLT-1021', cancelDate: addDays(TODAY, -7) })
    expect(res.status).toBe(200)
    expect(res.json.data).toMatchObject({ view: 'status', daysBefore: 7, tier: { refundBp: 3000 } })
    expect(JSON.stringify(res.json.data)).not.toMatch(/Minor|amount/)
  })

  test('recording the cancellation: once (idempotent), unpaid DP written off, still no money out', async () => {
    const key = newKey()
    const body = { subjectType: 'flight', subjectId: 'FLT-1021', cancelDate: addDays(TODAY, -7), reason: 'Customer membatalkan perjalanan' }
    const res = await money('finance', '/finance/cancellations', body, key)
    expect(res.status).toBe(201)
    const replay = await money('finance', '/finance/cancellations', body, key)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    expect(replay.json.data.id).toBe(res.json.data.id)
    caseId = res.json.data.id
    expect(res.json.data).toMatchObject({ status: 'requested', refundableMinor: '6000000', retainedMinor: '14000000', writtenOffMinor: '10000000', outstandingMinor: '6000000' })
    const inv = (await get('finance', `/finance/customer-invoices/${dpInvoice}`)).json.data
    expect(inv).toMatchObject({ outstandingMinor: '0', creditedMinor: '10000000' })
    const statement = (await get('finance', `/finance/statement?from=${addDays(TODAY, -30)}&kind=refund_settlement`)).json.data
    expect(statement).toHaveLength(0)
    expect((await money('finance', '/finance/cancellations', { ...body, reason: 'Kedua kali' })).status).toBe(409)
    // The booking now reads "Dibatalkan" everywhere, including for Admin.
    expect((await get('admin', '/bookings/flight/FLT-1021/finance-summary')).json.data).toMatchObject({ paymentStatus: 'cancelled', label: 'Dibatalkan', cancellation: { status: 'requested' } })
  })

  test('a whole-project cancellation stays possible but leaves the cancelled booking to its own case (no double count)', async () => {
    const preview = (await post('finance', '/finance/cancellations/preview', { subjectType: 'project', subjectId: 'PRJ-102' })).json.data
    expect(preview.blockers.map((b: { code: string }) => b.code)).not.toContain('OVERLAPPING_CASE')
    expect(preview.basisMinor).toBe('0')
    expect(preview.sourcePayments).toEqual([])
    // …and a booking cannot be billed again once cancelled.
    const draft = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', booking: { type: 'flight', id: 'FLT-1021' }, invoiceType: 'final', lines: [{ description: 'x', amountMinor: '1000' }] })
    expect(draft.status).toBe(422)
  })

  test('money cannot go out before approval; Admin cannot approve or pay', async () => {
    expect((await money('finance', `/finance/refunds/${caseId}/settlements`, { bankAccountId: bank, amountMinor: '6000000', effectiveDate: TODAY })).status).toBe(422)
    expect((await post('admin', `/finance/refunds/${caseId}/approve`)).status).toBe(403)
    expect((await money('admin', `/finance/refunds/${caseId}/settlements`, { bankAccountId: bank, amountMinor: '1', effectiveDate: TODAY })).status).toBe(403)
  })

  test('approval books the refund against revenue — outstanding untouched, still no money out', async () => {
    const before = await balance()
    const res = await post('finance', `/finance/refunds/${caseId}/approve`, { note: 'Sesuai kebijakan' })
    expect(res.json.data).toMatchObject({ status: 'approved', settlement: 'unpaid', outstandingMinor: '6000000' })
    expect(res.json.data.creditNotes.map((c: { effect: string; amountMinor: string }) => [c.effect, c.amountMinor]))
      .toEqual([['reduce_receivable', '10000000'], ['refund_liability', '6000000']])
    expect((await get('finance', `/finance/customer-invoices/${dpInvoice}`)).json.data.outstandingMinor).toBe('0')
    expect(await balance()).toBe(before)
    const cn = res.json.data.creditNotes[1].id
    expect((await post('finance', `/finance/credit-notes/${cn}/void`, { reason: 'Coba void' })).status).toBe(422)
    // The refund is based on this payment: it cannot be reversed while the case stands.
    const rev = await money('finance', `/finance/transactions/${dpReceipt}/reverse`, { reason: 'Transfer ditolak bank' })
    expect(rev.status).toBe(422)
    expect(rev.json.error.message).toContain(caseId)
  })

  test('settlement moves Rp 6 jt out once; replay does not post twice', async () => {
    const before = BigInt(await balance())
    const key = newKey()
    const body = { bankAccountId: bank, amountMinor: '6000000', effectiveDate: TODAY, recipient: 'PT Alam Raya Group', reference: 'BCA/OUT/RF1' }
    expect((await money('finance', `/finance/refunds/${caseId}/settlements`, { ...body, amountMinor: '6000001' })).status).toBe(400)
    const res = await money('finance', `/finance/refunds/${caseId}/settlements`, body, key)
    expect(res.status).toBe(201)
    const replay = await money('finance', `/finance/refunds/${caseId}/settlements`, body, key)
    expect(replay.headers.get('idempotent-replayed')).toBe('true')
    settlementTx = res.json.data.transactionId
    expect(BigInt(await balance())).toBe(before - 6_000_000n)
    const rf = (await get('finance', `/finance/refunds/${caseId}`)).json.data
    expect(rf).toMatchObject({ settlement: 'settled', outstandingMinor: '0', settledMinor: '6000000' })
    expect(rf.settlements).toEqual([expect.objectContaining({ transactionId: settlementTx, amountMinor: '6000000', reversed: false })])
    const moved = (await get('finance', `/finance/transactions/${settlementTx}`)).json.data
    expect(moved).toMatchObject({ kind: 'refund_settlement', direction: 'out', party: { id: 'PTY-002' }, booking: { type: 'flight', id: 'FLT-1021' } })
    expect((await money('finance', `/finance/refunds/${caseId}/settlements`, { ...body, amountMinor: '1' })).status).toBe(422)
    expect((await post('finance', `/finance/refunds/${caseId}/reject`, { reason: 'Coba batalkan kasus' })).status).toBe(422)
  })

  test('reversing the settlement reopens the refund and restores the balance', async () => {
    const before = BigInt(await balance())
    await money('finance', `/finance/transactions/${settlementTx}/reverse`, { reason: 'Transfer ditolak bank penerima' })
    expect(BigInt(await balance())).toBe(before + 6_000_000n)
    expect((await get('finance', `/finance/refunds/${caseId}`)).json.data).toMatchObject({ settlement: 'unpaid', outstandingMinor: '6000000' })
  })

  test('policy v2 never changes the recorded case', async () => {
    const v2 = await post('finance', `/finance/policies/${policyId}/new-version`)
    expect(v2.json.data).toMatchObject({ code: 'STD', version: 2, status: 'draft' })
    await req('PATCH', 'finance', `/finance/policies/${v2.json.data.id}`, { tiers: STANDARD_TIERS.map(x => ({ ...x, refundBp: 10_000 })) })
    await post('finance', `/finance/policies/${v2.json.data.id}/publish`)
    const rf = (await get('finance', `/finance/refunds/${caseId}`)).json.data
    expect(rf).toMatchObject({ policy: { version: 1 }, refundableMinor: '6000000', tier: { refundBp: 3000 } })
  })

  test('the case is frozen once decided, and never deleted', async () => {
    await expect(t.db.query("update refunds set refundable_minor = 1 where id = $1", [caseId])).rejects.toThrow('frozen')
    await expect(t.db.query('delete from refunds where id = $1', [caseId])).rejects.toThrow('never deleted')
  })
})

describe('whole-project cancellation with a 0% tier', () => {
  test('PRJ-104 (departure in 20 days, 50% tier) with nothing paid: planned billing cancelled, nothing to refund', async () => {
    await req('PUT', 'finance', '/finance/cancellation-policy/project/PRJ-104', { policyId })
    await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-104', label: 'DP', invoiceType: 'dp', amountMinor: '18000000', plannedDate: addDays(TODAY, 5) })
    const res = await money('admin', '/finance/cancellations', { subjectType: 'project', subjectId: 'PRJ-104', reason: 'Klien menunda program' })
    expect(res.status).toBe(201)
    // Nothing received → nothing to refund → decided by definition; Admin gets the status view.
    expect(res.json.data).toMatchObject({ view: 'status', status: 'approved', settlement: 'none', daysBefore: 20 })
    const plans = (await get('finance', '/finance/billing-schedule?projectId=PRJ-104')).json.data
    expect(plans.every((p: { status: string }) => p.status === 'cancelled')).toBe(true)
    const summary = (await get('finance', '/projects/PRJ-104/finance-summary')).json.data
    expect(summary).toMatchObject({ paymentStatus: 'cancelled', receivable: { uninvoicedMinor: '0', scheduledNotInvoicedMinor: '0' }, refunds: { openCount: 0 } })
  })
})

describe('voiding a cancellation case undoes it', () => {
  test('TRN-1034: written-off DP and cancelled plan come back; the booking is billable again', async () => {
    await req('PUT', 'finance', '/finance/cancellation-policy/project/PRJ-103', { policyId }) // inherited by TRN-1034
    const plan = (await post('finance', '/finance/billing-schedule', { projectId: 'PRJ-103', booking: { type: 'transport', id: 'TRN-1034' }, label: 'Pelunasan transport', invoiceType: 'final', amountMinor: '5000000', plannedDate: addDays(TODAY, 3) })).json.data.id
    const inv = (await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-103', booking: { type: 'transport', id: 'TRN-1034' }, invoiceType: 'dp', lines: [{ description: 'DP transport', amountMinor: '10000000' }], dueDate: TODAY })).json.data.id
    await post('finance', `/finance/customer-invoices/${inv}/issue`, {})
    const cx = await money('admin', '/finance/cancellations', { subjectType: 'transport', subjectId: 'TRN-1034', reason: 'Salah pilih booking' })
    expect(cx.json.data).toMatchObject({ status: 'approved', settlement: 'none' }) // 0% tier (after departure), nothing to refund
    expect((await get('finance', `/finance/customer-invoices/${inv}`)).json.data.outstandingMinor).toBe('0')
    expect((await get('finance', '/finance/billing-schedule?projectId=PRJ-103')).json.data.find((p: { id: string }) => p.id === plan).status).toBe('cancelled')

    const voided = await post('finance', `/finance/refunds/${cx.json.data.id}/reject`, { reason: 'Pembatalan keliru, booking tetap jalan' })
    expect(voided.json.data.status).toBe('rejected')
    expect((await get('finance', `/finance/customer-invoices/${inv}`)).json.data).toMatchObject({ outstandingMinor: '10000000', creditedMinor: '0' })
    expect((await get('finance', '/finance/billing-schedule?projectId=PRJ-103')).json.data.find((p: { id: string }) => p.id === plan).status).toBe('planned')
    expect((await get('finance', '/bookings/transport/TRN-1034/finance-summary')).json.data.cancellation).toBeNull()
    expect((await post('finance', `/finance/refunds/${cx.json.data.id}/reject`, { reason: 'Kedua kali' })).status).toBe(422)
  })
})

describe('a booking inherits its project policy', () => {
  test('FLT-1031 has no policy of its own; PRJ-103 has STD → the booking preview uses it (marked inherited)', async () => {
    await req('PUT', 'finance', '/finance/cancellation-policy/project/PRJ-103', { policyId })
    const res = (await get('admin', '/finance/cancellation-policy/flight/FLT-1031')).json.data
    expect(res).toMatchObject({ inherited: true, assignment: { policyId } })
    const preview = (await post('finance', '/finance/cancellations/preview', { subjectType: 'flight', subjectId: 'FLT-1031' })).json.data
    expect(preview.policy?.id).toBe(policyId)
    expect(preview.blockers.map((b: { code: string }) => b.code)).not.toContain('NO_POLICY')
  })
})

describe('no policy → manual case decided by Finance', () => {
  let caseId: string
  let invoice: string
  test('preview explains why it cannot calculate; Admin records it without amounts', async () => {
    const draft = await post('finance', '/finance/customer-invoices', { projectId: 'PRJ-102', booking: { type: 'hotel', id: 'HTL-1022' }, invoiceType: 'dp', lines: [{ description: 'DP hotel', amountMinor: '40000000' }], dueDate: TODAY })
    invoice = draft.json.data.id
    await post('finance', `/finance/customer-invoices/${invoice}/issue`, {})
    await money('finance', '/finance/receipts', { bankAccountId: bank, amountMinor: '40000000', effectiveDate: TODAY, partyId: 'PTY-002', allocations: [{ invoiceId: invoice, amountMinor: '40000000' }] })
    const preview = (await post('finance', '/finance/cancellations/preview', { subjectType: 'hotel', subjectId: 'HTL-1022' })).json.data
    expect(preview.canCalculate).toBe(false)
    expect(preview.blockers.map((b: { code: string }) => b.code)).toContain('NO_POLICY')
    expect((await money('admin', '/finance/cancellations', { subjectType: 'hotel', subjectId: 'HTL-1022', reason: 'Hotel overbook', calculation: 'policy' })).status).toBe(422)
    expect((await money('admin', '/finance/cancellations', { subjectType: 'hotel', subjectId: 'HTL-1022', reason: 'Hotel overbook', calculation: 'manual', proposedRefundMinor: '100' })).status).toBe(403)
    const res = await money('admin', '/finance/cancellations', { subjectType: 'hotel', subjectId: 'HTL-1022', reason: 'Hotel overbook, customer minta refund', calculation: 'manual' })
    expect(res.status).toBe(201)
    caseId = res.json.data.id
  })

  test('Finance sets the amount at approval, never above what was received', async () => {
    expect((await post('finance', `/finance/refunds/${caseId}/approve`, {})).status).toBe(400)
    expect((await post('finance', `/finance/refunds/${caseId}/approve`, { refundMinor: '40000001' })).status).toBe(409)
    const ok = await post('finance', `/finance/refunds/${caseId}/approve`, { refundMinor: '35000000', note: 'Potong biaya admin' })
    expect(ok.json.data).toMatchObject({ status: 'approved', calculation: 'manual', refundableMinor: '35000000', retainedMinor: '5000000' })
    const list = await get('finance', '/finance/refunds?view=to_pay')
    expect(list.json.meta.summary).toMatchObject({ toPayCount: 2, toPayMinor: '41000000' })
    const project = (await get('finance', '/projects/PRJ-102/finance-summary')).json.data
    expect(project.refunds).toMatchObject({ openCount: 2, outstandingMinor: '41000000', refundCreditedMinor: '41000000' })
  })

  test('Admin can list cases (for the Changes screen) — status only, no amounts', async () => {
    const res = await get('admin', '/finance/refunds?view=all')
    expect(res.status).toBe(200)
    expect(res.json.data.length).toBeGreaterThan(0)
    expect(res.json.data.every((r: { view: string }) => r.view === 'status')).toBe(true)
    expect(JSON.stringify(res.json)).not.toMatch(/Minor/)
  })

  test('a rejected case can be replaced; the rejection needs a reason', async () => {
    const other = await money('finance', '/finance/cancellations', { subjectType: 'flight', subjectId: 'FLT-1023', reason: 'Nama penumpang salah', calculation: 'manual' })
    expect(other.status).toBe(201)
    expect((await post('finance', `/finance/refunds/${other.json.data.id}/reject`, { reason: 'x' })).status).toBe(400)
    expect((await post('finance', `/finance/refunds/${other.json.data.id}/reject`, { reason: 'Diganti reissue, bukan batal' })).json.data.status).toBe('rejected')
    expect((await money('finance', '/finance/cancellations', { subjectType: 'flight', subjectId: 'FLT-1023', reason: 'Batal sungguhan', calculation: 'manual' })).status).toBe(201)
  })
})
