import type { Actor } from '../../auth/rbac'
import type { Db, Queryable } from '../../db/client'
import { postCashSource } from '../accounting/cash-source'
import { postFulfillmentSource, postSupplierClaimSource } from '../accounting/recognition'
import { getBook } from '../accounting/setup'
import { standaloneSupplierOrder,assertOrderBillable } from './order-scope'
import { voidSupplierMatchesForSource } from './supplier-matching'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { nextId } from '../../shared/ids'
import { parseMovementAmount, rule, todayBusinessDate } from './common'
import { lockPostableAccount, trimOrNull, validateEffectiveDate, validateReason } from './postings'

/**
 * Service fulfillment facts (owner accounting F3): "Jasa diberikan" to a customer and "Jasa supplier diterima".
 * Recorded once here; ledger effects derive from it. Not an invoice, not a payment, not a project status.
 */

export interface FulfillmentInput {
  side: string
  projectId?: string
  salesOrderId?: string
  serviceId?: string
  booking?: { type: string; id: string }
  serviceOrderId?: string
  vendorId?: string
  amountMinor: string
  fulfilledOn: string
  basis?: string
  isFinal?: boolean
  evidence: string
}

const BOOKING_TYPES = ['flight', 'hotel', 'transport', 'mice']
const id = (v: string | undefined, field: string) => {
  if (v === undefined || v === '') return null
  if (!ID_PATTERN.test(v)) throw errors.validation({ [field]: ['Referensi tidak valid.'] })
  return v
}

export async function recordFulfillment(tx: Queryable, actor: Actor, input: FulfillmentInput, requestId: string) {
  await getBook(tx, true)
  if (input.side !== 'customer' && input.side !== 'supplier') throw errors.validation({ side: ['Pilih jasa diberikan ke customer atau diterima dari supplier.'] })
  const customer = input.side === 'customer'
  const amount = parseMovementAmount(input.amountMinor)
  const fulfilledOn = validateEffectiveDate(input.fulfilledOn, 'fulfilledOn')
  if (fulfilledOn > todayBusinessDate()) throw errors.validation({ fulfilledOn: ['Jasa yang belum terjadi dicatat sebagai rencana, bukan pemenuhan.'] })
  const evidence = input.evidence?.trim() ?? ''
  if (evidence.length < 5 || evidence.length > 500) throw errors.validation({ evidence: ['Sebutkan bukti/keterangan pemenuhan (5–500 karakter).'] })
  const basis = input.basis ?? 'actual'
  if (!['actual', 'estimate'].includes(basis) || (customer && basis !== 'actual')) throw errors.validation({ basis: ['Estimasi hanya untuk biaya supplier yang belum ditagih.'] })

  let projectId = id(input.projectId, 'projectId'), salesOrderId = id(input.salesOrderId, 'salesOrderId')
  let partyId: string | null = null, vendorId: string | null = null
  const serviceOrderId = customer ? null : id(input.serviceOrderId, 'serviceOrderId')
  let serviceId = id(input.serviceId, 'serviceId')
  if (customer) {
    if (salesOrderId) {
      await assertOrderBillable(tx,salesOrderId)
      const [o] = await tx.query<{ project_id: string | null; party_id: string; status: string }>('select project_id, party_id, status from sales_order_refs where id = $1 for update', [salesOrderId])
      if (!o) throw errors.validation({ salesOrderId: ['Order tidak ditemukan.'] })
      if (o.status === 'cancelled') throw rule('Order ini dibatalkan; gunakan alur pembatalan/refund.')
      if (projectId && o.project_id !== projectId) throw errors.validation({ salesOrderId: ['Order ini bukan milik project tersebut.'] })
      projectId = o.project_id; partyId = o.party_id
    } else {
      if (!projectId) throw errors.validation({ projectId: ['Pilih project atau order yang jasanya diberikan.'] })
      const [p] = await tx.query<{ party_id: string; status: string }>('select party_id, status from projects where id = $1 for update', [projectId])
      if (!p) throw errors.validation({ projectId: ['Project tidak ditemukan.'] })
      if (p.status === 'cancelled') throw rule('Project ini dibatalkan; gunakan alur pembatalan/refund.')
      partyId = p.party_id
    }
  } else {
    salesOrderId=await standaloneSupplierOrder(tx,input.salesOrderId,projectId)
    if (!projectId && !salesOrderId) throw errors.validation({ projectId: ['Pilih project atau order mandiri tempat jasa supplier diterima.'] })
    if (salesOrderId && (serviceOrderId || serviceId || input.booking)) throw errors.validation({salesOrderId:['Order mandiri tidak memakai booking/layanan project.']})
    if (serviceOrderId) {
      const [so] = await tx.query<{ vendor_id: string; project_id: string; service_id: string; status: string }>('select vendor_id, project_id, service_id, status from service_orders where id = $1', [serviceOrderId])
      if (!so || so.project_id !== projectId) throw errors.validation({ serviceOrderId: ['Service order tidak ditemukan pada project ini.'] })
      if (so.status === 'cancelled') throw rule('Service order ini dibatalkan.')
      vendorId = so.vendor_id; serviceId = serviceId ?? so.service_id
    } else {
      vendorId = id(input.vendorId, 'vendorId')
      if (!vendorId && serviceId) vendorId = (await tx.query<{ vendor_id: string | null }>('select vendor_id from project_services where id = $1', [serviceId]))[0]?.vendor_id ?? null
      if (!vendorId) throw errors.validation({ vendorId: ['Pilih supplier yang memberikan jasa.'] })
      if (!(await tx.query('select 1 from vendors where id = $1', [vendorId])).length) throw errors.validation({ vendorId: ['Vendor tidak ditemukan.'] })
    }
    if (input.vendorId && input.vendorId !== vendorId) throw errors.validation({ vendorId: ['Vendor berbeda dari service order.'] })
  }
  if (serviceId && !(await tx.query('select 1 from project_services where id = $1 and project_id = $2', [serviceId, projectId])).length) {
    throw errors.validation({ serviceId: ['Layanan bukan milik project ini.'] })
  }
  let bookingType: string | null = null, bookingId: string | null = null
  if (input.booking) {
    if (!BOOKING_TYPES.includes(input.booking.type) || !ID_PATTERN.test(input.booking.id)) throw errors.validation({ booking: ['Referensi booking tidak valid.'] })
    const [b] = await tx.query<{ project_id: string; service_id: string | null }>('select project_id, service_id from booking_refs where booking_type = $1 and booking_id = $2', [input.booking.type, input.booking.id])
    if (!b || b.project_id !== projectId) throw errors.validation({ booking: ['Booking bukan milik project ini.'] })
    bookingType = input.booking.type; bookingId = input.booking.id; serviceId = serviceId ?? b.service_id
  }

  // Serialise the cumulative-right check per contract (also enforced by the table guard).
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`fulfill:${salesOrderId ?? `${projectId}:${partyId ?? vendorId}`}`])
  if (customer) {
    const right = await recognitionRight(tx, { projectId, salesOrderId, partyId: partyId! })
    if (right.recognizedMinor + amount > right.limitMinor) {
      throw errors.validation({ amountMinor: [`Melebihi hak kontrak yang belum dipenuhi (${right.limitMinor - right.recognizedMinor}). Catat perubahan kontrak/tagihan dulu.`] })
    }
  }
  const fid = await nextId(tx, 'SFL-')
  await tx.query(`insert into service_fulfillments (id, side, project_id, sales_order_id, service_id, booking_type, booking_id, service_order_id, party_id, vendor_id,
      amount_minor, fulfilled_on, basis, is_final, evidence, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
  [fid, input.side, projectId, salesOrderId, serviceId, bookingType, bookingId, serviceOrderId, partyId, vendorId, amount.toString(), fulfilledOn, basis,
    !customer && input.isFinal === true, evidence, actor.userId])
  await recordAudit(tx, { action: 'finance.fulfillment_recorded', actorUserId: actor.userId, entityType: 'service_fulfillment', entityId: fid, requestId,
    after: { side: input.side, projectId, salesOrderId, vendorId, amountMinor: amount.toString(), fulfilledOn, basis, isFinal: !customer && input.isFinal === true } })
  const posting = await postFulfillmentSource(tx, actor, fid, requestId)
  return { id: fid, accountingStatus: posting?.status ?? 'off' }
}

export async function voidFulfillment(tx: Queryable, actor: Actor, fid: string, reasonInput: unknown, requestId: string) {
  await getBook(tx, true)
  const reason = validateReason(reasonInput)
  if (!ID_PATTERN.test(fid)) throw errors.notFound('Pemenuhan jasa')
  const [f] = await tx.query<{ status: string }>('select status from service_fulfillments where id = $1 for update', [fid])
  if (!f) throw errors.notFound('Pemenuhan jasa')
  if (f.status === 'void') throw rule('Catatan pemenuhan ini sudah dibatalkan.')
  await voidSupplierMatchesForSource(tx,actor,'fulfillment',fid,reason,requestId)
  await tx.query("update service_fulfillments set status = 'void', void_reason = $2, voided_by = $3, voided_at = now() where id = $1", [fid, reason, actor.userId])
  await recordAudit(tx, { action: 'finance.fulfillment_voided', actorUserId: actor.userId, entityType: 'service_fulfillment', entityId: fid, requestId, reason })
  await postFulfillmentSource(tx, actor, fid, requestId, reason, todayBusinessDate())
  return { id: fid }
}

/** Contractual right: the contract/order value or what was validly billed, whichever is higher (same rule as the DB guard). */
async function recognitionRight(q: Queryable, k: { projectId: string | null; salesOrderId: string | null; partyId: string }) {
  const [r] = k.salesOrderId
    ? await q.query<{ limit_minor: string; recognized_minor: string }>(`select greatest(s.price_minor, coalesce((select sum(i.total_minor) from customer_invoices i where i.sales_order_id = s.id and i.status = 'issued'), 0)) as limit_minor,
        coalesce((select sum(amount_minor) from service_fulfillments f where f.side = 'customer' and f.status = 'recorded' and f.sales_order_id = s.id), 0) as recognized_minor
        from sales_order_refs s where s.id = $1`, [k.salesOrderId])
    : await q.query<{ limit_minor: string; recognized_minor: string }>(`select greatest(coalesce(p.contract_value_minor, 0), coalesce((select sum(i.total_minor) from customer_invoices i
          where i.project_id = p.id and i.party_id = $2 and i.sales_order_id is null and i.status = 'issued'), 0)) as limit_minor,
        coalesce((select sum(amount_minor) from service_fulfillments f where f.side = 'customer' and f.status = 'recorded' and f.project_id = p.id
          and f.sales_order_id is null and f.party_id = $2), 0) as recognized_minor
        from projects p where p.id = $1`, [k.projectId, k.partyId])
  return { limitMinor: BigInt(r?.limit_minor ?? '0'), recognizedMinor: BigInt(r?.recognized_minor ?? '0') }
}

function fulfillmentDto(f: Record<string, any>) {
  return { id: f.id as string, side: f.side as 'customer' | 'supplier', projectId: f.project_id ?? null, salesOrderId: f.sales_order_id ?? null,
    serviceId: f.service_id ?? null, booking: f.booking_id ? { type: f.booking_type, id: f.booking_id } : null, serviceOrderId: f.service_order_id ?? null,
    partyId: f.party_id ?? null, vendorId: f.vendor_id ?? null, vendorName: f.vendor_name ?? null, amountMinor: f.amount_minor as string,
    fulfilledOn: f.fulfilled_on as string, basis: f.basis as 'actual' | 'estimate', isFinal: f.is_final as boolean, evidence: f.evidence as string,
    status: f.status as 'recorded' | 'void', voidReason: f.void_reason ?? null }
}

/**
 * One read for the project/order workspace: what was delivered/received, and prefills taken from existing
 * bookings and service orders so the owner confirms facts instead of retyping them.
 */
export async function fulfillmentOverview(db: Db, filter: { projectId?: string; salesOrderId?: string }) {
  const projectId = id(filter.projectId, 'projectId'), salesOrderId = id(filter.salesOrderId, 'salesOrderId')
  if (!projectId && !salesOrderId) throw errors.validation({ projectId: ['Pilih project atau order.'] })
  return db.transaction(async q => {
    let partyId: string, contractProject = projectId
    if (salesOrderId) {
      const [o] = await q.query<{ party_id: string; project_id: string | null }>('select party_id, project_id from sales_order_refs where id = $1', [salesOrderId])
      if (!o) throw errors.notFound('Order')
      partyId = o.party_id; contractProject = o.project_id
    } else {
      const [p] = await q.query<{ party_id: string }>('select party_id from projects where id = $1', [projectId])
      if (!p) throw errors.notFound('Project')
      partyId = p.party_id
    }
    const right = await recognitionRight(q, { projectId: contractProject, salesOrderId, partyId })
    const rows = await q.query<Record<string, any>>(`select f.*, v.name as vendor_name from service_fulfillments f left join vendors v on v.id = f.vendor_id
      where ${salesOrderId ? 'f.sales_order_id = $1' : 'f.project_id = $1'} order by f.fulfilled_on, f.id`, [salesOrderId ?? projectId])
    const bookings = contractProject && !salesOrderId ? await q.query<Record<string, any>>(`select b.booking_type, b.booking_id, b.status, b.sell_amount_minor, b.net_cost_minor,
        b.service_id, s.vendor_id, v.name as vendor_name from booking_refs b left join project_services s on s.id = b.service_id left join vendors v on v.id = s.vendor_id
        where b.project_id = $1 order by b.booking_type, b.booking_id`, [contractProject]) : []
    const serviceOrders = contractProject && !salesOrderId ? await q.query<Record<string, any>>(`select so.id, so.vendor_id, v.name as vendor_name, so.service_id, so.status, so.net_cost_minor,
        coalesce((select sum(f.amount_minor) from service_fulfillments f where f.service_order_id = so.id and f.status = 'recorded'), 0) as received_minor
        from service_orders so join vendors v on v.id = so.vendor_id where so.project_id = $1 and so.status <> 'cancelled' order by so.id`, [contractProject]) : []
    const supplierReceived = rows.filter(r => r.side === 'supplier' && r.status === 'recorded').reduce((s, r) => s + BigInt(r.amount_minor), 0n)
    return {
      contract: { limitMinor: right.limitMinor.toString(), recognizedMinor: right.recognizedMinor.toString(), remainingMinor: (right.limitMinor - right.recognizedMinor).toString() },
      supplierReceivedMinor: supplierReceived.toString(),
      items: rows.map(fulfillmentDto),
      // Status is evidence for the owner to confirm, never an automatic recognition (policy D04 unknown).
      bookingPrefills: bookings.map(b => ({ booking: { type: b.booking_type, id: b.booking_id }, status: b.status, serviceId: b.service_id ?? null,
        sellAmountMinor: b.sell_amount_minor ?? null, netCostMinor: b.net_cost_minor ?? null, vendorId: b.vendor_id ?? null, vendorName: b.vendor_name ?? null,
        operationallyDone: ['issued', 'reissued', 'completed'].includes(b.status) })),
      serviceOrderPrefills: serviceOrders.map(s => ({ serviceOrderId: s.id, vendorId: s.vendor_id, vendorName: s.vendor_name, serviceId: s.service_id, status: s.status,
        netCostMinor: s.net_cost_minor ?? null, receivedMinor: s.received_minor,
        remainingMinor: s.net_cost_minor === null ? null : (BigInt(s.net_cost_minor) - BigInt(s.received_minor)).toString() }))
    }
  })
}

// ── Supplier recovery claims ─────────────────────────────────────────────────────────────────────────

export interface SupplierClaimInput {
  vendorId: string
  projectId?: string
  salesOrderId?: string
  basis: string
  sourcePaymentId?: string
  amountMinor: string
  recognizedOn: string
  reason: string
}

export async function createSupplierClaim(tx: Queryable, actor: Actor, input: SupplierClaimInput, requestId: string) {
  await getBook(tx, true)
  if (!['cost-recovery', 'deposit-recovery'].includes(input.basis)) throw errors.validation({ basis: ['Pilih pemulihan biaya atau pengembalian deposit.'] })
  const vendorId = id(input.vendorId, 'vendorId')
  if (!vendorId || !(await tx.query('select 1 from vendors where id = $1', [vendorId])).length) throw errors.validation({ vendorId: ['Vendor tidak ditemukan.'] })
  const projectId = id(input.projectId, 'projectId')
  const salesOrderId=await standaloneSupplierOrder(tx,input.salesOrderId,projectId)
  if (projectId && !(await tx.query('select 1 from projects where id = $1', [projectId])).length) throw errors.validation({ projectId: ['Project tidak ditemukan.'] })
  const amount = parseMovementAmount(input.amountMinor)
  const recognizedOn = validateEffectiveDate(input.recognizedOn, 'recognizedOn')
  if (recognizedOn > todayBusinessDate()) throw errors.validation({ recognizedOn: ['Tanggal klaim tidak boleh di masa depan.'] })
  const reason = trimOrNull(input.reason, 500) ?? ''
  if (reason.length < 5) throw errors.validation({ reason: ['Jelaskan dasar klaim (minimal 5 karakter).'] })
  let sourcePaymentId: string | null = null
  if (input.basis === 'deposit-recovery') {
    sourcePaymentId = id(input.sourcePaymentId, 'sourcePaymentId')
    if (!sourcePaymentId) throw errors.validation({ sourcePaymentId: ['Pilih deposit supplier yang dikembalikan.'] })
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`alloc:${sourcePaymentId}`])
    const [d] = await tx.query<{ vendor_id: string; unallocated_minor: string; effective_date: string }>(`select vendor_id, unallocated_minor, effective_date from v_unallocated_payments
      where transaction_id = $1 and kind = 'vendor_payment'`, [sourcePaymentId])
    if (!d || d.vendor_id !== vendorId) throw errors.validation({ sourcePaymentId: ['Deposit vendor ini tidak ditemukan atau sudah dibatalkan.'] })
    if (amount > BigInt(d.unallocated_minor)) throw errors.validation({ amountMinor: [`Melebihi deposit yang belum terpakai (${d.unallocated_minor}).`] })
    if (recognizedOn < d.effective_date) throw errors.validation({ recognizedOn: ['Klaim tidak boleh sebelum tanggal deposit.'] })
  }
  const cid = await nextId(tx, 'SCL-')
  await tx.query(`insert into supplier_claims (id, vendor_id, project_id, basis, source_payment_id, amount_minor, recognized_on, reason, created_by,sales_order_id)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [cid, vendorId, projectId, input.basis, sourcePaymentId, amount.toString(), recognizedOn, reason, actor.userId,salesOrderId])
  if (sourcePaymentId) {
    await tx.query(`insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by, effective_date)
      values ($1, 'supplier_claim', $2, $3, $4, $5)`, [sourcePaymentId, cid, amount.toString(), actor.userId, recognizedOn])
  }
  await recordAudit(tx, { action: 'finance.supplier_claim_recorded', actorUserId: actor.userId, entityType: 'supplier_claim', entityId: cid, requestId, reason,
    after: { vendorId, projectId, basis: input.basis, sourcePaymentId, amountMinor: amount.toString(), recognizedOn } })
  const posting = await postSupplierClaimSource(tx, actor, cid, requestId)
  return { id: cid, accountingStatus: posting?.status ?? 'off' }
}

export async function voidSupplierClaim(tx: Queryable, actor: Actor, cid: string, reasonInput: unknown, requestId: string) {
  await getBook(tx, true)
  const reason = validateReason(reasonInput)
  if (!ID_PATTERN.test(cid)) throw errors.notFound('Klaim supplier')
  const [c] = await tx.query<{ status: string }>('select status from supplier_claims where id = $1 for update', [cid])
  if (!c) throw errors.notFound('Klaim supplier')
  if (c.status === 'void') throw rule('Klaim ini sudah dibatalkan.')
  const [b] = await tx.query<{ settled_minor: string }>('select settled_minor from v_supplier_claim_balances where claim_id = $1', [cid])
  if (BigInt(b!.settled_minor) > 0n) throw rule('Supplier sudah mengembalikan dana untuk klaim ini. Batalkan penerimaannya dulu di Mutasi Rekening.')
  await tx.query("update supplier_claims set status = 'void', void_reason = $2, voided_by = $3, voided_at = now() where id = $1", [cid, reason, actor.userId])
  await recordAudit(tx, { action: 'finance.supplier_claim_voided', actorUserId: actor.userId, entityType: 'supplier_claim', entityId: cid, requestId, reason })
  await postSupplierClaimSource(tx, actor, cid, requestId, reason, todayBusinessDate())
  return { id: cid }
}

export interface VendorRefundInput { bankAccountId: string; claimId: string; amountMinor: string; effectiveDate: string; reference?: string; memo?: string }

/** Money in from a supplier against a recorded claim. Settles the claim; never revenue and never a second cost reversal. */
export async function postVendorRefund(tx: Queryable, actor: Actor, input: VendorRefundInput, requestId: string) {
  await getBook(tx, true)
  const amount = parseMovementAmount(input.amountMinor)
  const effectiveDate = validateEffectiveDate(input.effectiveDate)
  const cid = id(input.claimId, 'claimId')
  if (!cid) throw errors.validation({ claimId: ['Pilih klaim supplier yang dibayar kembali.'] })
  const [c] = await tx.query<{ vendor_id: string; project_id: string | null; sales_order_id:string|null; status: string; recognized_on: string }>('select vendor_id, project_id, sales_order_id,status, recognized_on from supplier_claims where id = $1 for update', [cid])
  if (!c || c.status !== 'recorded') throw errors.validation({ claimId: ['Klaim supplier tidak ditemukan atau sudah dibatalkan.'] })
  if (effectiveDate < c.recognized_on) throw errors.validation({ effectiveDate: ['Penerimaan tidak boleh sebelum tanggal klaim.'] })
  const [b] = await tx.query<{ amount_minor: string; settled_minor: string }>('select amount_minor, settled_minor from v_supplier_claim_balances where claim_id = $1', [cid])
  const outstanding = BigInt(b!.amount_minor) - BigInt(b!.settled_minor)
  if (amount > outstanding) throw errors.validation({ amountMinor: [`Melebihi sisa klaim (${outstanding}).`] })
  const account = await lockPostableAccount(tx, input.bankAccountId, effectiveDate)
  const [row] = await tx.query<{ id: string }>(
    `insert into financial_transactions (bank_account_id, direction, amount_minor, currency, kind, effective_date, project_id, vendor_id, reference, memo, created_by,sales_order_id)
     values ($1, 'in', $2, $3, 'vendor_refund', $4, $5, $6, $7, $8, $9,$10) returning id`,
    [account.id, amount.toString(), account.currency, effectiveDate, c.project_id, c.vendor_id, trimOrNull(input.reference, 120), trimOrNull(input.memo) ?? `Pengembalian ${cid}`, actor.userId,c.sales_order_id])
  await postCashSource(tx, actor, row!.id, requestId)
  await tx.query(`insert into payment_allocations (transaction_id, target_type, target_id, amount_minor, created_by, effective_date)
    values ($1, 'supplier_claim', $2, $3, $4, $5)`, [row!.id, cid, amount.toString(), actor.userId, effectiveDate])
  await recordAudit(tx, { action: 'finance.vendor_refund_posted', actorUserId: actor.userId, entityType: 'financial_transaction', entityId: row!.id, requestId,
    after: { claimId: cid, accountId: account.id, amountMinor: amount.toString(), effectiveDate } })
  return { transactionId: row!.id, claimId: cid, outstandingMinor: (outstanding - amount).toString() }
}

export async function listSupplierClaims(db: Db, filter: { vendorId?: string; projectId?: string; salesOrderId?:string }) {
  const vendorId = id(filter.vendorId, 'vendorId'), projectId = id(filter.projectId, 'projectId')
  const rows = await db.query<Record<string, any>>(`select c.*, v.name as vendor_name, b.settled_minor from supplier_claims c join vendors v on v.id = c.vendor_id
    join v_supplier_claim_balances b on b.claim_id = c.id where ($1::text is null or c.vendor_id = $1) and ($2::text is null or c.project_id = $2) and ($3::text is null or c.sales_order_id=$3)
    order by c.recognized_on desc, c.id desc limit 200`, [vendorId, projectId,id(filter.salesOrderId,'salesOrderId')])
  return rows.map(c => ({ id: c.id as string, vendorId: c.vendor_id as string, vendorName: c.vendor_name as string, projectId: c.project_id ?? null,salesOrderId:c.sales_order_id ?? null,
    basis: c.basis as 'cost-recovery' | 'deposit-recovery', sourcePaymentId: c.source_payment_id ?? null, amountMinor: c.amount_minor as string,
    settledMinor: c.settled_minor as string,
    outstandingMinor: c.status === 'void' ? '0' : (BigInt(c.amount_minor) - BigInt(c.settled_minor)).toString(),
    recognizedOn: c.recognized_on as string, reason: c.reason as string, status: c.status as 'recorded' | 'void', voidReason: c.void_reason ?? null }))
}
