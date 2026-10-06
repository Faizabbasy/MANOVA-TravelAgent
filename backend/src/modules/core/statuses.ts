/**
 * Project status transitions — the same map as the frontend `PROJECT_STATUS_TRANSITIONS`. Shared by the
 * Project Order commands and by Finance (a whole-project cancellation also cancels the project).
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['planning', 'on-hold', 'cancelled'],
  planning: ['confirmed', 'on-hold', 'cancelled'],
  confirmed: ['in-progress', 'on-hold', 'cancelled'],
  'in-progress': ['ongoing-trip', 'completed', 'on-hold', 'cancelled'],
  'ongoing-trip': ['completed', 'on-hold', 'cancelled'],
  completed: [],
  'on-hold': ['planning', 'confirmed', 'in-progress', 'cancelled'],
  cancelled: []
}
