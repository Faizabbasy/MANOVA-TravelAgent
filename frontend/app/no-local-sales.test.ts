import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Leads, their activities and client quotations live on the server (S6a): screens never call the local mutators. */
const FORBIDDEN = [
  'createLead(', 'updateLeadContact(', 'updateLeadQualification(', 'archiveLead(', 'reopenLead(', 'markLeadUnqualified(', 'mergeLeadAsDuplicate(',
  'createLeadActivity(', 'qualifyLeadForQuotation(', 'ensureCustomerForLead(', 'createQuotation(', 'reviseQuotation(', 'duplicateQuotationVersion(',
  'updateQuotationDetails(', 'submitQuotationForApproval(', 'withdrawQuotationSubmission(', 'approveQuotation(', 'rejectQuotation(', 'sendQuotationToClient('
]
const ROOTS = ['pages', 'components', 'composables', 'layouts']
/**
 * The public Lead Intake form (no login, `layout: false`) still writes locally: a server endpoint for anonymous
 * submissions needs its own design (spam protection, owner assignment) — out of S6a. Shrink, never grow.
 */
const KNOWN_PUBLIC = [/^pages\/lead-intake\//]
const appDir = __dirname
const used = (source: string, name: string) => new RegExp(`(?<![.\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source)

function sources (dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) { return sources(path) }
    return /\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('no local sales mutators in screens (leads & quotations come from the server)', () => {
  const files = ROOTS.flatMap(root => sources(join(appDir, root))).map(file => ({ name: relative(appDir, file).replace(/\\/g, '/'), file }))
    .filter(({ name }) => !KNOWN_PUBLIC.some(pattern => pattern.test(name)))

  it('ignores server calls with the same name', () => {
    expect(used('await api.sales.createQuotation(id, body)', 'createQuotation(')).toBe(false)
    expect(used('createQuotationOnServer(api, id, x)', 'createQuotation(')).toBe(false)
    expect(used('createQuotation(id, 5)', 'createQuotation(')).toBe(true)
  })

  it.each(files.map(({ name, file }) => [name, file]))('%s', (_name, file) => {
    expect(FORBIDDEN.filter(name => used(readFileSync(file, 'utf8'), name))).toEqual([])
  })
})
