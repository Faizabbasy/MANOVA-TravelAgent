/** Lead vocabulary and the qualification gate (S6a) — the same fields the frontend form requires. */

export const LEAD_SOURCES = ['website', 'instagram', 'tiktok', 'whatsapp', 'referral', 'event', 'email', 'sales-outreach', 'client-portal', 'other'] as const
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'unqualified'] as const
export const SERVICE_CATEGORIES = ['corporate-travel', 'group-travel', 'individual-travel', 'mice-event'] as const
export const URGENCIES = ['low', 'medium', 'high'] as const

export interface LeadRow {
  id: string
  name: string
  company_name: string | null
  title: string | null
  stage: string
  owner_user_id: string
  handed_over_to: string | null
  archived: boolean
  party_id: string | null
  service_category: string | null
  destination: string | null
  travel_start_date: string | null
  travel_end_date: string | null
  traveler_estimate: number | null
  service_scope: string[]
  requirement_summary: string | null
}

/** Missing qualification fields, in the form's words. Individual travel (B2C) assigns no Account Executive here. */
export function missingQualification(lead: LeadRow): string[] {
  const missing: string[] = []
  if (!lead.service_category) missing.push('Jenis kebutuhan')
  if (!lead.destination) missing.push('Destinasi belum diisi')
  if (!lead.travel_start_date || !lead.travel_end_date) missing.push('Periode perjalanan belum diisi')
  if (!lead.traveler_estimate) missing.push('Estimasi traveler belum diisi')
  if (!lead.service_scope?.length) missing.push('Service scope belum dipilih')
  if (lead.service_category !== 'individual-travel' && !lead.handed_over_to) missing.push('Account Executive belum dipilih')
  if (!lead.requirement_summary) missing.push('Ringkasan kebutuhan belum diisi')
  return missing
}

/** `select` list for a `LeadRow` with dates as `YYYY-MM-DD`. */
export const LEAD_ROW_SQL = `id, name, company_name, title, stage, owner_user_id, handed_over_to, archived, party_id, service_category, destination,
  travel_start_date::text as travel_start_date, travel_end_date::text as travel_end_date, traveler_estimate, service_scope, requirement_summary`
