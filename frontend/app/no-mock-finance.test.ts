import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Money lives on the server (Finance API). The client-side mock finance helpers from the V2 prototype must
 * never come back into a page, component, composable or layout. Operational data (projects, bookings,
 * tasks…) is still client-side; only money is guarded here.
 */
const FORBIDDEN = [
  'getInvoicesByProject', 'getPaymentsByInvoice', 'getProjectOutstandingIdr', 'getProjectCollectedIdr', 'getInvoiceOutstandingIdr',
  'getInvoiceMilestoneOutstandingIdr', 'getInvoiceMilestoneStatus', 'recordPayment(', 'createInvoice(',
  'getCreditNotesByProject', 'getDebitNotesByProject', 'getSupplierInvoicesByProject', 'getSupplierInvoicesByServiceOrder',
  'evaluateFinanceClosureGate(', 'recordVendorPaymentDirect', 'paySupplierInvoice',
  'getProjectActualCostIdr', 'getProjectExpenses', 'createProjectExpense', 'getServiceTypeSpendBreakdown',
  'getRevenueByPeriod', 'getOpexTotalIdr', 'getOpexPeriods', 'OPEX_ENTRIES', 'getPayables(',
  'getSalesOrderOutstandingIdr', 'confirmGroupTripDp(', 'getClientFinanceSummary', 'getClientInvoices',
  'getRefundRequestsByProject', 'createRefundRequest', "from '~/data/finance-ext'", "from '~/data/finance'"
]
const ROOTS = ['pages', 'components', 'composables', 'layouts']
const appDir = __dirname

/**
 * Mock money that already existed in the monorepo before the V2 merge and lives in screens outside this
 * change: the client and vendor portals (switched off, ADR-006) and the procurement service-order detail
 * (supplier invoices of the procurement mock). Listed so the guard stays strict everywhere else; shrink it,
 * never grow it.
 */
const KNOWN_PRE_V2 = [
  /^pages\/client\//, /^components\/client\//, /^pages\/supplier\//, /^pages\/procurement\/service-orders\//
]

/** A forbidden helper used as a bare call/import — not `api.finance.someName(` (a server call). */
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

function sources (dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { return sources(path) }
    return /\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('no mock finance in the app (money comes from the server)', () => {
  const files = ROOTS.flatMap(root => sources(join(appDir, root)))
    .map(file => ({ name: relative(appDir, file).replace(/\\/g, '/'), file }))
    .filter(({ name }) => !KNOWN_PRE_V2.some(pattern => pattern.test(name)))

  it('scans the app', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('catches a bare helper call and ignores a server call with the same name', () => {
    expect(used('const x = getInvoicesByProject(id)', 'getInvoicesByProject')).toBe(true)
    expect(used('await api.finance.confirmGroupTripDp(id, body)', 'confirmGroupTripDp(')).toBe(false)
    expect(used("import { getPayables } from '~/data/finance-ext'", "from '~/data/finance-ext'")).toBe(true)
  })

  it.each(files.map(({ name, file }) => [name, file]))('%s', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    expect(FORBIDDEN.filter(name => used(source, name))).toEqual([])
  })
})
