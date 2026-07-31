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
  /** Section 09 (roadmap Section 00–24 baru) — task ditandai sebagai milestone, bukan entitas paralel ("Milestones, tasks" Wajib dipenuhi lewat satu model yang sama). */
  isMilestone?: boolean
  /** Dependency sederhana single-link (Section 09) — task ini baru relevan/dapat dimulai setelah `dependsOnTaskId` selesai. Bukan DAG penuh, cukup untuk mendemokan konsep "dependencies". */
  dependsOnTaskId?: ID
  assignedTo?: ID
  /** "Blocker" (Section 12 — roadmap Section 00–24 baru, Wajib "Tasks, checklist, owner, deadline, blocker, dependency"). Terpisah dari `status` — task bisa `in-progress` TAPI blocked (menunggu sesuatu di luar kendali assignee), bukan status baru yang menimpa `status` existing (LOCKED, dipakai luas). */
  isBlocked?: boolean
  blockedReason?: string
}

/** Risk severity/status (Section 09 — roadmap Section 00–24 baru, Wajib "risks"). */
export type ProjectRiskSeverity = 'low' | 'medium' | 'high'
export type ProjectRiskStatus = 'open' | 'mitigated' | 'closed'

/** Project-level risk tracking (Section 09) — entitas baru, tidak ada model existing yang cocok (`Opportunity.requirementDetail.riskNotes` adalah teks bebas satu kali di tahap AE, bukan daftar risk yang bisa dilacak per-Project sepanjang lifecycle). */
export interface ProjectRisk {
  id: ID
  projectId: ID
  title: string
  description?: string
  severity: ProjectRiskSeverity
  status: ProjectRiskStatus
  raisedBy: ID
  createdAt: string
}

/** Shift identifier (Section 12) — pola kerja shift umum operasional travel (bukan jam presisi). */
export type ShiftPeriod = 'pagi' | 'siang' | 'malam'

/**
 * "On-trip updates dan shift notes mock" (Section 12 — roadmap Section 00–24 baru, Wajib) — log operasional
 * ringkas selama trip berlangsung, TERPISAH dari `ActivityEntry` (tab "Activity & Changes", berorientasi
 * governance/approval perubahan) — shift note murni catatan serah-terima antar staf lapangan, tidak
 * memerlukan status approval/review. Entitas baru karena semantiknya (siapa jaga shift apa, catatan
 * kondisi lapangan) tidak cocok dipaksakan ke `ActivityEntry` yang sudah punya flag `isChange`/`approvalStatus`.
 */
export interface ShiftNote {
  id: ID
  projectId: ID
  authorId: ID
  shift: ShiftPeriod
  note: string
  createdAt: string
}

/**
 * System event (Prompt 19 — Change Request, Activity Center Super Admin). Log lintas-modul level-atas
 * (lead/opportunity/quotation/client/project-order/vendor/finance/user), BERBEDA dari `ActivityEntry`
 * yang scoped ke satu Project — dipakai `/activity-center`, bukan menggantikan tab "Activity & Changes"
 * Project Detail (LOCKED sejak Section 05/14, tidak disentuh). Bukan event bus nyata (D-005/D-006) —
 * murni log mock, entri ditambahkan langsung oleh mutator terkait (mis. `qualifyLead`, `approveQuotation`).
 */
export type SystemEventModule = 'lead' | 'opportunity' | 'quotation' | 'client' | 'project-order' | 'vendor' | 'finance' | 'user'

export interface SystemEvent {
  id: ID
  module: SystemEventModule
  type: string
  message: string
  entityId?: ID
  userId?: ID
  createdAt: string
}
