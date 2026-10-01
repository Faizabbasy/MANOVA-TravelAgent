import type { VendorInvoiceDto } from '~/types/api'

/**
 * Whether the vendor of one project service still has to be paid, from the approved vendor invoices in the
 * server project summary: `none` (nothing approved yet), `open` (money still owed) or `paid`.
 */
export function vendorPaymentState (vendorInvoices: VendorInvoiceDto[], vendorId: string | undefined): 'none' | 'open' | 'paid' {
  if (!vendorId) { return 'none' }
  const approved = vendorInvoices.filter(inv => inv.vendor.id === vendorId && inv.status === 'approved')
  if (!approved.length) { return 'none' }
  return approved.some(inv => BigInt(inv.outstandingMinor) > 0n) ? 'open' : 'paid'
}
