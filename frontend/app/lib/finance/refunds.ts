import { SUBJECT_LABEL } from './policy'
import type { ApiRefundSettlement, ApiRefundStatus, ApiSubjectType } from '~/types/api'
import type { BadgeTone } from '~/types/common'

/** One badge for a refund case: decision first, then payment progress. */
export function refundTag (r: { status: ApiRefundStatus; settlement: ApiRefundSettlement }): { label: string; tone: BadgeTone } {
  if (r.status === 'requested') { return { label: 'Menunggu persetujuan', tone: 'info' } }
  if (r.status === 'rejected') { return { label: 'Ditolak', tone: 'neutral' } }
  if (r.settlement === 'none') { return { label: 'Tanpa refund', tone: 'neutral' } }
  if (r.settlement === 'settled') { return { label: 'Refund lunas', tone: 'success' } }
  if (r.settlement === 'partial') { return { label: 'Dibayar sebagian', tone: 'warning' } }
  return { label: 'Perlu dibayar', tone: 'primary' }
}

/** "Project" or "Tiket pesawat FLT-1021". */
export function subjectLabel (s: { type: ApiSubjectType; id: string }): string {
  return s.type === 'project' ? 'Seluruh project' : `${SUBJECT_LABEL[s.type]} ${s.id}`
}
