import type { StatusOption } from '~/types/common'
import type { OpportunityStage } from '~/types/opportunity'
import type { ProjectStatus, ProjectCharacteristic, ServiceStatus, ServiceTypeKey } from '~/types/project'
import type { InvoiceStatus } from '~/types/finance'
import type { PartyActivityType } from '~/types/party'

/**
 * Source of truth untuk seluruh status/enum MANOVA (Prompt 5-G, menggeneralisasi D-038).
 * Setiap status punya value/label/tone(badge)/order — jangan hardcode label status di halaman manapun.
 */

export const OPPORTUNITY_STAGES: StatusOption<OpportunityStage>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'qualification', label: 'Qualification', tone: 'info', order: 2 },
  { value: 'requirement-gathering', label: 'Requirement Gathering', tone: 'info', order: 3 },
  { value: 'proposal', label: 'Proposal / Quotation', tone: 'primary', order: 4 },
  { value: 'negotiation', label: 'Negotiation', tone: 'primary', order: 5 },
  { value: 'won-requested', label: 'Won (Menunggu Approval)', tone: 'warning', order: 6 },
  { value: 'won', label: 'Won', tone: 'success', order: 7 },
  { value: 'lost', label: 'Lost', tone: 'destructive', order: 8 },
  { value: 'on-hold', label: 'On Hold', tone: 'warning', order: 9 },
]

export const PROJECT_STATUSES: StatusOption<ProjectStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral', order: 1 },
  { value: 'planning', label: 'Planning', tone: 'info', order: 2 },
  { value: 'confirmed', label: 'Confirmed', tone: 'primary', order: 3 },
  { value: 'in-progress', label: 'In Progress', tone: 'warning', order: 4 },
  { value: 'ongoing-trip', label: 'Ongoing Trip', tone: 'purple', order: 5 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 6 },
  { value: 'on-hold', label: 'On Hold', tone: 'warning', order: 7 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 8 },
]

export const PROJECT_CHARACTERISTICS: StatusOption<ProjectCharacteristic>[] = [
  { value: 'normal', label: 'Normal Project', tone: 'success', order: 1 },
  { value: 'high-change', label: 'High-Change Project', tone: 'warning', order: 2 },
  { value: 'complex', label: 'Complex Project', tone: 'purple', order: 3 },
]

export const SERVICE_STATUSES: StatusOption<ServiceStatus>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral', order: 1 },
  { value: 'sourcing', label: 'Sourcing', tone: 'info', order: 2 },
  { value: 'quoted', label: 'Quoted', tone: 'info', order: 3 },
  { value: 'pending-confirmation', label: 'Pending Confirmation', tone: 'warning', order: 4 },
  { value: 'confirmed', label: 'Confirmed', tone: 'success', order: 5 },
  { value: 'changed', label: 'Changed', tone: 'warning', order: 6 },
  { value: 'completed', label: 'Completed', tone: 'success', order: 7 },
  { value: 'cancelled', label: 'Cancelled', tone: 'destructive', order: 8 },
]

export const SERVICE_TYPES: StatusOption<ServiceTypeKey>[] = [
  { value: 'flight', label: 'Flight', tone: 'info', order: 1 },
  { value: 'hotel', label: 'Hotel', tone: 'purple', order: 2 },
  { value: 'transportation', label: 'Transportation', tone: 'warning', order: 3 },
  { value: 'mice', label: 'MICE', tone: 'primary', order: 4 },
]

/** Kategori Activity level-Party (Section 07) — dipakai tab "Activities" Party Detail. */
export const PARTY_ACTIVITY_TYPES: StatusOption<PartyActivityType>[] = [
  { value: 'call', label: 'Telepon', tone: 'info', order: 1 },
  { value: 'meeting', label: 'Meeting', tone: 'primary', order: 2 },
  { value: 'email', label: 'Email', tone: 'neutral', order: 3 },
  { value: 'note', label: 'Catatan', tone: 'neutral', order: 4 },
  { value: 'follow-up', label: 'Follow-up', tone: 'warning', order: 5 },
]

export const INVOICE_STATUSES: StatusOption<InvoiceStatus>[] = [
  { value: 'unpaid', label: 'Belum Dibayar', tone: 'warning', order: 1 },
  { value: 'partially-paid', label: 'Dibayar Sebagian', tone: 'info', order: 2 },
  { value: 'paid', label: 'Lunas', tone: 'success', order: 3 },
]

export const ATTENTION_SEVERITIES: StatusOption<'low' | 'medium' | 'high'>[] = [
  { value: 'low', label: 'Rendah', tone: 'info', order: 1 },
  { value: 'medium', label: 'Sedang', tone: 'warning', order: 2 },
  { value: 'high', label: 'Tinggi', tone: 'destructive', order: 3 },
]

export const TASK_STATUSES: StatusOption<'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'>[] = [
  { value: 'not-started', label: 'Not Started', tone: 'neutral', order: 1 },
  { value: 'in-progress', label: 'In Progress', tone: 'info', order: 2 },
  { value: 'pending-confirmation', label: 'Pending Confirmation', tone: 'warning', order: 3 },
  { value: 'done', label: 'Done', tone: 'success', order: 4 },
  { value: 'overdue', label: 'Overdue', tone: 'destructive', order: 5 },
]

export function findStatusOption<T extends string>(list: StatusOption<T>[], value: T): StatusOption<T> {
  const found = list.find(option => option.value === value)
  if (found) return found
  return { value, label: value, tone: 'neutral', order: 0 }
}
