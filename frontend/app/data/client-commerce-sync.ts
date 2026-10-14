import { CLIENT_COMMERCE_STATE, CLIENT_RESERVATIONS } from './client-commerce'
import { CREDIT_NOTES, INVOICES, LEADS, PAYMENTS, QUOTATIONS } from './index'
import type { CreditNote, Invoice, InvoiceStatus, InvoiceType, Payment } from '~/types/finance'
import type { Lead } from '~/types/lead'
import type { Quotation } from '~/types/quotation'
import type { ClientInvoiceDto, ClientInvoicesDto, ClientQuotationDto, ClientReservationDto } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { isApiError } from '~/lib/api/errors'

/**
 * Client portal commercial data from the server (S12a-2): sent quotations, reservations without money, and the
 * client's own invoices. Loaded only for role client (the endpoints refuse every other role). The client session sees
 * only its own party, so the local lists the portal reads are replaced with the server's view.
 */

type CoreApi = Pick<ManovaApi, 'core'>
const idr = (minor: string | null | undefined) => (minor === null || minor === undefined ? undefined : Number(minor))
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/* ---------- quotations ---------- */

export const quotationFromClientServer = (d: ClientQuotationDto): Quotation => clean({
  id: d.id,
  leadId: d.lead.id,
  amountIdr: Number(d.amountMinor),
  createdAt: d.createdOn,
  accepted: d.accepted,
  version: d.version,
  supersededAmountIdr: idr(d.previousAmountMinor),
  // Only approved & sent quotations reach the client.
  approvalStatus: 'approved' as const,
  discountIdr: idr(d.discountMinor),
  taxIdr: idr(d.taxMinor),
  currency: d.currency,
  paymentTerms: opt(d.paymentTerms),
  validUntil: opt(d.validUntil),
  termsAndConditions: opt(d.termsAndConditions),
  inclusions: opt(d.inclusions),
  exclusions: opt(d.exclusions),
  cancellationPolicy: opt(d.cancellationPolicy),
  proposedItineraryNote: opt(d.proposedItineraryNote),
  sentToClientAt: d.sentToClientOn,
  preparedByName: opt(d.preparedByName),
  serviceBreakdown: d.serviceBreakdown.map(line => clean({ service: line.service, description: opt(line.description), amountIdr: Number(line.amountMinor) })) as Quotation['serviceBreakdown']
})

/** The client party's quotations become exactly the sent ones from the server; leads are created or updated to match. */
export function mergeClientQuotations (partyId: string, list: ClientQuotationDto[]): void {
  for (const d of list) {
    const lead = LEADS.find(l => l.id === d.lead.id)
    const view = clean({
      partyId,
      title: opt(d.lead.title),
      companyName: opt(d.lead.companyName),
      name: d.lead.name,
      destination: opt(d.lead.destination),
      travelStartDate: opt(d.lead.travelStartDate),
      travelEndDate: opt(d.lead.travelEndDate),
      travelerEstimate: opt(d.lead.travelerEstimate),
      serviceScope: d.lead.serviceScope,
      projectId: opt(d.projectId),
      quotationId: d.id
    }) as Partial<Lead>
    if (lead) { Object.assign(lead, view) } else {
      LEADS.push({ id: d.lead.id, source: 'client-portal', stage: 'qualified', ownerId: '', createdAt: d.createdOn, lastUpdatedAt: d.sentToClientOn, archived: false, ...view } as Lead)
    }
  }
  const partyLeads = new Set(LEADS.filter(l => l.partyId === partyId).map(l => l.id))
  for (let i = QUOTATIONS.length - 1; i >= 0; i--) {
    if (partyLeads.has(QUOTATIONS[i]!.leadId)) { QUOTATIONS.splice(i, 1) }
  }
  QUOTATIONS.push(...list.map(quotationFromClientServer))
}

/* ---------- reservations ---------- */

export function mergeClientReservations (list: ClientReservationDto[]): void {
  CLIENT_RESERVATIONS.splice(0, CLIENT_RESERVATIONS.length, ...list)
  CLIENT_COMMERCE_STATE.reservationsLoaded = true
}

/**
 * A booking-shaped view of a server reservation for the client confirmation preview — only the fields that page
 * shows (schedule, reference, travellers), never prices.
 */
export function clientBookingFor (type: string, id: string): Record<string, unknown> | undefined {
  const r = CLIENT_RESERVATIONS.find(x => x.type === type && x.id === id)
  if (!r) { return undefined }
  const d = r.details as Record<string, unknown>
  const base = { id: r.id, projectId: r.projectId, status: r.status, travelerIds: (d.travelerIds as string[] | undefined) ?? [] }
  if (type === 'flight') { return { ...base, pnr: opt(r.reference), segments: d.segments ?? [], ticketingDeadline: opt(d.ticketingDeadline as string | null) } }
  if (type === 'hotel') {
    return { ...base, confirmationNumber: opt(r.reference), checkInDate: d.checkInDate, checkOutDate: d.checkOutDate, roomsBlocked: d.roomsBlocked ?? 0, voucherIssuedAt: opt(d.voucherIssuedAt as string | null) }
  }
  if (type === 'transport') {
    return { ...base, legs: d.legs ?? [], assignedVehiclePlateNumber: opt(d.assignedVehiclePlateNumber as string | null), driverName: opt(d.driverName as string | null), driverPhone: opt(d.driverPhone as string | null) }
  }
  return { ...base, venueName: opt(d.venueName as string | null), venueAddress: opt(d.venueAddress as string | null), sessions: d.sessions ?? [] }
}

/* ---------- invoices ---------- */

const INVOICE_TYPES: InvoiceType[] = ['dp', 'progress', 'final']

function invoiceStatusOf (d: ClientInvoiceDto): InvoiceStatus {
  if (d.status === 'void') { return 'void' }
  if (d.isDisputed) { return 'disputed' }
  if (d.settlement === 'paid' || d.settlement === 'credited') { return 'paid' }
  if (d.settlement === 'partial') { return 'partially-paid' }
  return 'unpaid'
}

export const invoiceFromClientServer = (d: ClientInvoiceDto, partyId: string): Invoice => clean({
  id: d.id,
  projectId: d.project.id,
  billedPartyId: partyId,
  label: d.number ?? d.id,
  amountIdr: Number(d.totalMinor),
  issuedAt: d.issueDate ?? '',
  dueAt: d.dueDate ?? '',
  status: invoiceStatusOf(d),
  currency: d.currency as Invoice['currency'],
  invoiceType: (INVOICE_TYPES.includes(d.invoiceType as InvoiceType) ? d.invoiceType : 'progress') as InvoiceType,
  voidReason: opt(d.voidReason),
  disputeReason: opt(d.disputeReason)
})

/** The client session's invoices, payments and credit notes become the server's (they are all of its own party). */
export function mergeClientInvoices (partyId: string, data: ClientInvoicesDto): void {
  const invoices = data.invoices.map(d => invoiceFromClientServer(d, partyId))
  const payments: Payment[] = data.invoices.flatMap(d => d.payments.map((p, i) => clean({
    id: `PAY-${d.id}-${i + 1}`, invoiceId: d.id, amountIdr: Number(p.amountMinor), receivedAt: p.effectiveDate ?? '', recordedBy: '', reference: opt(p.reference)
  })))
  // Void credit notes no longer reduce the bill; the local status set has no 'void'.
  const notes: CreditNote[] = data.invoices.flatMap(d => d.creditNotes.filter(n => n.status !== 'void').map(n => ({
    id: n.id, invoiceId: d.id, amountIdr: Number(n.amountMinor), issuedAt: n.issuedAt, reason: n.reason ?? '', status: 'issued' as const
  })))
  INVOICES.splice(0, INVOICES.length, ...invoices)
  PAYMENTS.splice(0, PAYMENTS.length, ...payments)
  CREDIT_NOTES.splice(0, CREDIT_NOTES.length, ...notes)
}

/* ---------- loading ---------- */

export async function loadClientCommerce (api: CoreApi, partyId: string): Promise<void> {
  const [quotations, reservations, invoices] = await Promise.all([
    api.core.listClientQuotations(), api.core.listClientReservations(), api.core.listClientInvoices()
  ])
  mergeClientQuotations(partyId, quotations.data)
  mergeClientReservations(reservations.data)
  mergeClientInvoices(partyId, invoices.data)
}

export interface ClientCommerceSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the client portal's quotations, reservations and invoices once per signed-in client. */
export function useClientCommerceSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ClientCommerceSyncState>('manova-client-commerce-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const user = currentUser.value
    if (user.role !== 'client' || !user.clientPartyId) { return }
    if (!force && state.value.userId === user.id && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId: user.id, message: null }
    try {
      await session.ensure()
      await loadClientCommerce(api, user.clientPartyId)
      state.value = { status: 'ready', userId: user.id, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId: user.id, message: isApiError(error) ? error.message : 'Data quotation, reservasi & tagihan belum bisa dimuat.' }
    }
  }

  return { state, load }
}
