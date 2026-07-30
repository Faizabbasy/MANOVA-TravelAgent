import type { ID } from './common'

/** Klasifikasi dampak perubahan (Section 14) — entitas yang terdampak oleh satu Change entry. */
export type ChangeCategory = 'traveler' | 'itinerary' | 'service' | 'vendor' | 'budget' | 'other'

/** Status approval mock (Section 14) — terpisah dari `reviewed` (LOCKED sejak Section 06, dipakai `isProjectNeedingAttention`). */
export type ChangeApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ActivityEntry {
  id: ID
  projectId: ID
  message: string
  isChange: boolean
  reviewed: boolean
  createdAt: string
  /** Field Section 14 di bawah ini opsional — hanya relevan/terisi untuk entry dengan `isChange: true`. */
  category?: ChangeCategory
  reason?: string
  requestedBy?: ID
  beforeValue?: string
  afterValue?: string
  impactNote?: string
  approvalStatus?: ChangeApprovalStatus
  approvedBy?: ID
}

export interface ProjectDocument {
  id: ID
  projectId: ID
  name: string
  uploadedAt: string
}

export interface ProjectTask {
  id: ID
  projectId: ID
  title: string
  status: 'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'
  dueAt?: string
}
