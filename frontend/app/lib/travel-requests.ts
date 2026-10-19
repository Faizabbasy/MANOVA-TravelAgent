import type { TravelRequestStatus } from '~/types/travel-request'

/** S12c-3: what sales may do with a travel request in each status — mirrors the server's transitions. */
const OPEN: TravelRequestStatus[] = ['submitted', 'under-review', 'need-clarification', 'proposal-preparation']

export function travelRequestActions (status: TravelRequestStatus) {
  const reviewing = status === 'submitted' || status === 'under-review'
  return {
    review: status === 'submitted',
    clarify: reviewing,
    convert: reviewing || status === 'proposal-preparation',
    close: OPEN.includes(status)
  }
}
