import type { ID } from './common'
import type { Project, ProjectStatus } from './project'

/**
 * Alur 6 step Project Order (Revisi 9-Modul) — satu halaman workspace menjalankan project dari awal
 * sampai Review tanpa berpindah halaman.
 *
 * Step DIDERIVASI dari `Project.status` yang sudah ada, mengikuti preseden D-066 (`getProjectOrderStatus`):
 * `ProjectStatus` (8 nilai, LOCKED sejak D-028) TIDAK direstrukturisasi. Yang ditambahkan hanya lapisan
 * penyajian + gerbang per step di atasnya.
 */
export type ProjectOrderStepKey =
  | 'drafting'
  | 'confirmed'
  | 'start'
  | 'departure'
  | 'on-progress'
  | 'done'

export type ProjectOrderStepState = 'completed' | 'current' | 'future' | 'blocked'

/** Bentuk hasil gerbang yang seragam — sama persis dengan `evaluateProjectClosureGate` yang sudah ada. */
export interface ProjectOrderGateResult {
  ready: boolean
  blockers: string[]
}

export interface ProjectOrderStepGate {
  id: string
  label: string
  /** Mengembalikan `undefined` bila terpenuhi, atau kalimat blocker yang siap ditampilkan bila belum. */
  evaluate: (project: Project) => string | undefined
}

export interface ProjectOrderStepDef {
  key: ProjectOrderStepKey
  index: number
  label: string
  description: string
  /** Status yang dituju saat step ini dilanjutkan. `undefined` bila kemajuan dijalankan `sideEffect`. */
  targetStatus?: ProjectStatus
  /** Mutator tambahan/pengganti di luar `updateProjectStatus`. */
  sideEffect?: 'markReady' | 'closeProject'
  nextActionLabel: string
  gates: ProjectOrderStepGate[]
  /** Tanggal yang ditampilkan di bawah step yang sudah selesai pada stepper. */
  completedAt: (project: Project) => string | undefined
}

export interface ProjectOrderStepView {
  def: ProjectOrderStepDef
  state: ProjectOrderStepState
  completedAt?: string
  gate: ProjectOrderGateResult
}

export type ProjectMilestoneStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'cancelled'

export interface ProjectMilestone {
  id: ID
  projectId: ID
  /** Menautkan milestone ke step workflow agar Gantt dan stepper bercerita hal yang sama. */
  stepKey?: ProjectOrderStepKey
  name: string
  plannedDate: string
  actualDate?: string
  ownerId?: ID
  status: ProjectMilestoneStatus
  note?: string
}

export interface ProjectNote {
  id: ID
  projectId: ID
  authorId: ID
  body: string
  createdAt: string
  pinned?: boolean
}
