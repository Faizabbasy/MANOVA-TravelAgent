import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Project, ProjectStatus } from '~/types/project'
import type {
  ProjectMilestone,
  ProjectNote,
  ProjectOrderGateResult,
  ProjectOrderStepDef,
  ProjectOrderStepKey,
  ProjectOrderStepView
} from '~/types/project-order'
import { PROJECT_MILESTONES, PROJECT_NOTES } from './project-orders'
import { areProjectAssetsReturned, getAssetById } from './inventory'
import {
  getProjectById,
  getProjectServices,
  getItineraryItems,
  getTravelers,
  getInvoicesByProject,
  getPaymentsByInvoice,
  getTravelerReadiness,
  getDepartureReadiness,
  getIncidentsByProject,
  getChangeRequestsByProject,
  evaluateProjectClosureGate,
  getProjectStatusTransitions,
  updateProjectStatus,
  markProjectReady,
  closeProject
} from './index'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'

/**
 * Mesin alur 6 step Project Order (Revisi 9-Modul).
 *
 * SENGAJA tidak diekspor ulang lewat `app/data/index.ts` — file ini mengimpor dari barrel tersebut, jadi
 * re-export akan membentuk import melingkar. Halaman mengimpor langsung dari `~/data/project-order-workflow`.
 *
 * Seluruh gerbang di bawah menggunakan selector yang SUDAH ADA (`getDepartureReadiness`,
 * `getTravelerReadiness`, `evaluateProjectClosureGate`, dst.) — tidak ada perhitungan kesiapan yang
 * diduplikasi di sini, sehingga workspace baru dan halaman lama tidak mungkin memberi jawaban berbeda.
 */

function isOnOrAfter (dateIso: string, referenceIso = DEMO_REFERENCE_DATE): boolean {
  return differenceInCalendarDays(parseISO(referenceIso), parseISO(dateIso)) >= 0
}

export const PROJECT_ORDER_STEPS: ProjectOrderStepDef[] = [
  {
    key: 'drafting',
    index: 1,
    label: 'Drafting',
    description: 'Menyusun kebutuhan, itinerary awal, dan manifest sebelum project dikonfirmasi.',
    targetStatus: 'confirmed',
    nextActionLabel: 'Konfirmasi Project Order',
    completedAt: project => project.handoverAcceptedAt,
    gates: [
      {
        id: 'handover-accepted',
        label: 'Handover dari Sales sudah diterima',
        evaluate: project => project.handoverAcceptedAt ? undefined : 'Handover dari Sales belum diterima — terima handover lebih dulu di Project Workspace.'
      },
      {
        id: 'quotation-linked',
        label: 'Quotation sumber tertaut',
        evaluate: project => project.sourceQuotationId ? undefined : 'Belum ada Quotation yang tertaut ke Project Order ini.'
      },
      {
        id: 'has-service',
        label: 'Minimal satu service terdefinisi',
        evaluate: (project) => {
          const count = getProjectServices(project.id).length
          return count > 0 ? undefined : 'Belum ada service (flight/hotel/transport/MICE) yang didefinisikan.'
        }
      },
      {
        id: 'has-itinerary',
        label: 'Itinerary sudah terisi',
        evaluate: (project) => {
          const count = getItineraryItems(project.id).length
          return count > 0 ? undefined : 'Itinerary masih kosong — isi minimal satu hari perjalanan.'
        }
      },
      {
        id: 'manifest-filled',
        label: 'Manifest traveler terisi',
        evaluate: (project) => {
          const registered = getTravelers(project.id).length
          if (registered === 0) { return `Manifest traveler masih kosong (dibutuhkan ${project.travelerCount} orang).` }
          if (registered < project.travelerCount) { return `Manifest baru terisi ${registered} dari ${project.travelerCount} traveler.` }
          return undefined
        }
      }
    ]
  },
  {
    key: 'confirmed',
    index: 2,
    label: 'Confirmed',
    description: 'Project sudah dikonfirmasi klien. Menunggu DP masuk dan seluruh service dikunci.',
    sideEffect: 'markReady',
    nextActionLabel: 'Mulai Persiapan (Start)',
    completedAt: project => project.readyAt,
    gates: [
      {
        id: 'dp-invoice-issued',
        label: 'Invoice DP sudah terbit',
        evaluate: (project) => {
          const hasDp = getInvoicesByProject(project.id).some(invoice => invoice.invoiceType === 'dp' && invoice.status !== 'void')
          return hasDp ? undefined : 'Invoice Down Payment belum diterbitkan oleh Finance.'
        }
      },
      {
        id: 'dp-received',
        label: 'Pembayaran DP sudah diterima',
        evaluate: (project) => {
          const dpInvoices = getInvoicesByProject(project.id).filter(invoice => invoice.invoiceType === 'dp' && invoice.status !== 'void')
          const paidIdr = dpInvoices.reduce((sum, invoice) => sum + getPaymentsByInvoice(invoice.id).reduce((s, payment) => s + payment.amountIdr, 0), 0)
          return paidIdr > 0 ? undefined : 'Pembayaran DP belum tercatat — Finance harus memverifikasi penerimaan dana lebih dulu.'
        }
      },
      {
        id: 'services-confirmed',
        label: 'Seluruh service sudah Confirmed',
        evaluate: (project) => {
          const pending = getProjectServices(project.id).filter(service => service.status !== 'confirmed' && service.status !== 'completed')
          return pending.length === 0 ? undefined : `${pending.length} service belum berstatus Confirmed/Completed.`
        }
      }
    ]
  },
  {
    key: 'start',
    index: 3,
    label: 'Start',
    description: 'Persiapan operasional: booking dikunci, dokumen traveler dilengkapi, tim lapangan disiapkan.',
    targetStatus: 'in-progress',
    nextActionLabel: 'Tandai Siap Berangkat',
    completedAt: project => project.readyAt,
    gates: [
      {
        id: 'departure-readiness',
        label: 'Departure readiness bersih',
        evaluate: (project) => {
          const readiness = getDepartureReadiness(project.id)
          if (!readiness || readiness.isReady) { return undefined }
          return `Departure readiness belum bersih: ${readiness.blockingReasons.join('; ')}.`
        }
      },
      {
        id: 'traveler-documents',
        label: 'Dokumen traveler terverifikasi',
        evaluate: (project) => {
          const readiness = getTravelerReadiness(project.id)
          if (readiness.total === 0) { return 'Belum ada traveler yang terdaftar.' }
          if (readiness.verifiedCount < readiness.total) {
            return `${readiness.total - readiness.verifiedCount} dokumen traveler belum diverifikasi.`
          }
          return undefined
        }
      },
      {
        id: 'field-contacts',
        label: 'Tour leader & kontak darurat terisi',
        evaluate: (project) => {
          if (!project.tourLeaderName?.trim()) { return 'Tour leader belum ditunjuk.' }
          if (!project.emergencyContactPhone?.trim()) { return 'Kontak darurat belum diisi.' }
          return undefined
        }
      }
    ]
  },
  {
    key: 'departure',
    index: 4,
    label: 'Departure',
    description: 'Hari keberangkatan. Trip resmi dimulai setelah rombongan berangkat.',
    targetStatus: 'ongoing-trip',
    nextActionLabel: 'Tandai Trip Berjalan',
    completedAt: project => project.travelStartDate,
    gates: [
      {
        id: 'departure-date-reached',
        label: 'Tanggal keberangkatan sudah tiba',
        evaluate: (project) => {
          if (isOnOrAfter(project.travelStartDate)) { return undefined }
          const days = differenceInCalendarDays(parseISO(project.travelStartDate), parseISO(DEMO_REFERENCE_DATE))
          return `Keberangkatan masih ${days} hari lagi (${project.travelStartDate}).`
        }
      },
      {
        id: 'no-open-incident',
        label: 'Tidak ada incident terbuka',
        evaluate: (project) => {
          const open = getIncidentsByProject(project.id).filter(incident => incident.status === 'open' || incident.status === 'escalated')
          return open.length === 0 ? undefined : `${open.length} incident masih terbuka dan harus ditangani sebelum berangkat.`
        }
      }
    ]
  },
  {
    key: 'on-progress',
    index: 5,
    label: 'On Progress',
    description: 'Trip sedang berjalan. Perubahan dan insiden ditangani real-time sampai perjalanan selesai.',
    targetStatus: 'completed',
    nextActionLabel: 'Tandai Trip Selesai',
    completedAt: project => project.travelEndDate,
    gates: [
      {
        id: 'trip-ended',
        label: 'Tanggal selesai perjalanan sudah lewat',
        evaluate: (project) => {
          if (isOnOrAfter(project.travelEndDate)) { return undefined }
          const days = differenceInCalendarDays(parseISO(project.travelEndDate), parseISO(DEMO_REFERENCE_DATE))
          return `Perjalanan baru berakhir ${days} hari lagi (${project.travelEndDate}).`
        }
      },
      {
        id: 'no-pending-change',
        label: 'Tidak ada change request menggantung',
        evaluate: (project) => {
          const pending = getChangeRequestsByProject(project.id).filter(request => request.status === 'submitted' || request.status === 'under-review')
          return pending.length === 0 ? undefined : `${pending.length} change request masih menunggu keputusan.`
        }
      },
      {
        id: 'services-finished',
        label: 'Seluruh service sudah selesai',
        evaluate: (project) => {
          const pending = getProjectServices(project.id).filter(service => service.status !== 'completed' && service.status !== 'cancelled')
          return pending.length === 0 ? undefined : `${pending.length} service belum berstatus Completed/Cancelled.`
        }
      }
    ]
  },
  {
    key: 'done',
    index: 6,
    label: 'Done',
    description: 'Penutupan: pelunasan, laporan akhir, berita acara, dan review klien.',
    sideEffect: 'closeProject',
    nextActionLabel: 'Tutup Project Order',
    completedAt: project => project.closedAt,
    gates: [
      {
        id: 'closure-gate',
        label: 'Closure checklist terpenuhi',
        /** Gate penutupan penuh sudah tersedia sebagai satu fungsi — jangan dihitung ulang di sini. */
        evaluate: project => evaluateProjectClosureGate(project.id).blockers.join(' ') || undefined
      },
      {
        id: 'assets-returned',
        label: 'Seluruh aset MANOVA sudah dikembalikan',
        /**
         * `ProjectClosureChecklist.assetsReturned` sudah lama ada sebagai field tapi tidak pernah punya
         * sumber data. Sejak modul Inventory dibangun (Revisi 9-Modul), pengembalian aset menjadi fakta
         * yang bisa diperiksa — jadi gerbang ini akhirnya bermakna.
         */
        evaluate: (project) => {
          const { returned, outstanding } = areProjectAssetsReturned(project.id)
          if (returned) { return undefined }
          const names = outstanding.map(checkout => getAssetById(checkout.assetId)?.name ?? checkout.assetId)
          return `${outstanding.length} aset belum dikembalikan: ${names.join(', ')}.`
        }
      }
    ]
  }
]

export function getProjectOrderStepDef (stepKey: ProjectOrderStepKey): ProjectOrderStepDef | undefined {
  return PROJECT_ORDER_STEPS.find(step => step.key === stepKey)
}

/**
 * Step aktif, diturunkan dari `Project.status` + field milestone (`readyAt`, `closedAt`) — pola sama
 * dengan `getProjectOrderStatus()` yang sudah ada, sehingga tidak ada state ganda yang bisa berbeda.
 */
export function getProjectOrderStep (project: Project): ProjectOrderStepKey {
  switch (project.status) {
    case 'draft':
    case 'planning':
      return 'drafting'
    case 'confirmed':
      return project.readyAt ? 'start' : 'confirmed'
    case 'in-progress':
      return 'departure'
    case 'ongoing-trip':
      return 'on-progress'
    case 'completed':
      return 'done'
    /** On Hold / Cancelled adalah transisi lateral — step terakhir yang dicapai tetap ditampilkan. */
    case 'on-hold':
    case 'cancelled':
      return project.readyAt ? 'start' : 'drafting'
    default:
      return 'drafting'
  }
}

export function evaluateProjectOrderStepGate (projectId: string, stepKey: ProjectOrderStepKey): ProjectOrderGateResult {
  const project = getProjectById(projectId)
  if (!project) { return { ready: false, blockers: ['Project Order tidak ditemukan.'] } }

  const step = getProjectOrderStepDef(stepKey)
  if (!step) { return { ready: false, blockers: ['Step tidak dikenal.'] } }

  const blockers = step.gates
    .map(gate => gate.evaluate(project))
    .filter((blocker): blocker is string => Boolean(blocker))

  return { ready: blockers.length === 0, blockers }
}

/** Seluruh step beserta state tampilannya — sumber tunggal untuk stepper dan panel Status Workflow. */
export function getProjectOrderStepViews (projectId: string): ProjectOrderStepView[] {
  const project = getProjectById(projectId)
  if (!project) { return [] }

  const currentKey = getProjectOrderStep(project)
  const currentIndex = getProjectOrderStepDef(currentKey)?.index ?? 1
  const isClosed = Boolean(project.closedAt)

  return PROJECT_ORDER_STEPS.map((def) => {
    const gate = evaluateProjectOrderStepGate(projectId, def.key)
    let state: ProjectOrderStepView['state']

    if (def.index < currentIndex || (def.key === 'done' && isClosed)) {
      state = 'completed'
    } else if (def.index === currentIndex) {
      state = gate.ready ? 'current' : 'blocked'
    } else {
      state = 'future'
    }

    return {
      def,
      state,
      completedAt: state === 'completed' ? def.completedAt(project) : undefined,
      gate
    }
  })
}

export interface AdvanceProjectOrderResult {
  success: boolean
  blockers: string[]
  stepKey?: ProjectOrderStepKey
}

export interface AdvanceProjectOrderOptions {
  /** Wajib saat menutup Project Order pada step Done. */
  finalNote?: string
  clientFeedback?: string
}

/**
 * Menjalankan satu langkah maju. Gerbang dievaluasi ULANG di sini (bukan sekadar percaya tombol di UI
 * sudah disabled), sehingga aksi tetap aman bila datanya berubah sejak halaman ter-render.
 */
export function advanceProjectOrder (projectId: string, actorId: string, options: AdvanceProjectOrderOptions = {}): AdvanceProjectOrderResult {
  const project = getProjectById(projectId)
  if (!project) { return { success: false, blockers: ['Project Order tidak ditemukan.'] } }

  const stepKey = getProjectOrderStep(project)
  const step = getProjectOrderStepDef(stepKey)
  if (!step) { return { success: false, blockers: ['Step tidak dikenal.'] } }

  const gate = evaluateProjectOrderStepGate(projectId, stepKey)
  if (!gate.ready) { return { success: false, blockers: gate.blockers, stepKey } }

  if (step.sideEffect === 'closeProject') {
    const finalNote = options.finalNote?.trim()
    if (!finalNote) { return { success: false, blockers: ['Final note wajib diisi sebelum menutup Project Order.'], stepKey } }
    const result = closeProject(projectId, actorId, finalNote, options.clientFeedback)
    return { success: result.success, blockers: result.blockers, stepKey }
  }

  if (step.sideEffect === 'markReady') {
    const updated = markProjectReady(projectId)
    return updated
      ? { success: true, blockers: [], stepKey }
      : { success: false, blockers: ['Project Order tidak dapat ditandai siap dari status saat ini.'], stepKey }
  }

  if (!step.targetStatus) { return { success: false, blockers: ['Step ini tidak punya aksi lanjut.'], stepKey } }

  /**
   * Step Drafting mencakup dua status (`draft` dan `planning`), sedangkan `PROJECT_STATUS_TRANSITIONS`
   * hanya mengizinkan satu lompatan per panggilan. Rantai perantaranya dijalankan otomatis agar dari sisi
   * pengguna tetap satu klik.
   */
  const chain: ProjectStatus[] = []
  if (project.status === 'draft' && step.targetStatus === 'confirmed') { chain.push('planning') }
  chain.push(step.targetStatus)

  for (const status of chain) {
    if (!getProjectStatusTransitions(project.status).includes(status)) {
      return { success: false, blockers: [`Transisi ke "${status}" tidak diizinkan dari status "${project.status}".`], stepKey }
    }
    updateProjectStatus(projectId, status, actorId)
  }

  return { success: true, blockers: [], stepKey }
}

/** Transisi lateral yang tersedia (On Hold / Cancel) — di luar alur maju 6 step. */
export function getProjectOrderLateralTransitions (projectId: string): ProjectStatus[] {
  const project = getProjectById(projectId)
  if (!project) { return [] }
  return getProjectStatusTransitions(project.status).filter(status => status === 'on-hold' || status === 'cancelled')
}

/* ------------------------------------------------------------------ *
 * Milestone
 * ------------------------------------------------------------------ */

export function getProjectMilestones (projectId: string): ProjectMilestone[] {
  return PROJECT_MILESTONES
    .filter(milestone => milestone.projectId === projectId)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
}

/**
 * Delay dalam hari — POSITIF berarti terlambat, negatif berarti lebih cepat dari rencana.
 * Milestone yang belum punya `actualDate` diukur terhadap tanggal acuan demo, sehingga keterlambatan
 * yang sedang berjalan tetap terlihat, bukan hanya yang sudah selesai.
 */
export function getMilestoneDelayDays (milestone: ProjectMilestone, referenceIso = DEMO_REFERENCE_DATE): number | undefined {
  if (milestone.status === 'cancelled') { return undefined }
  if (milestone.actualDate) {
    return differenceInCalendarDays(parseISO(milestone.actualDate), parseISO(milestone.plannedDate))
  }
  /** Belum selesai: ukur terhadap tanggal acuan, dan hanya laporkan bila sudah lewat jatuh tempo. */
  const running = differenceInCalendarDays(parseISO(referenceIso), parseISO(milestone.plannedDate))
  return running > 0 ? running : undefined
}

export interface MilestoneSummary {
  total: number
  completed: number
  delayed: number
  /** Total hari keterlambatan kumulatif — dipakai sebagai indikator kesehatan jadwal di header. */
  totalDelayDays: number
}

export function getProjectMilestoneSummary (projectId: string): MilestoneSummary {
  const milestones = getProjectMilestones(projectId)
  let delayed = 0
  let totalDelayDays = 0
  for (const milestone of milestones) {
    const delay = getMilestoneDelayDays(milestone)
    if (delay !== undefined && delay > 0) {
      delayed += 1
      totalDelayDays += delay
    }
  }
  return {
    total: milestones.length,
    completed: milestones.filter(milestone => milestone.status === 'completed').length,
    delayed,
    totalDelayDays
  }
}

export function setMilestoneActualDate (milestoneId: string, actualDate: string): ProjectMilestone | undefined {
  const milestone = PROJECT_MILESTONES.find(item => item.id === milestoneId)
  if (!milestone) { return undefined }
  milestone.actualDate = actualDate
  milestone.status = 'completed'
  return milestone
}

export function updateMilestonePlannedDate (milestoneId: string, plannedDate: string): ProjectMilestone | undefined {
  const milestone = PROJECT_MILESTONES.find(item => item.id === milestoneId)
  if (!milestone || !plannedDate) { return undefined }
  milestone.plannedDate = plannedDate
  return milestone
}

export function createProjectMilestone (input: Omit<ProjectMilestone, 'id' | 'status'> & { status?: ProjectMilestone['status'] }): ProjectMilestone {
  const milestone: ProjectMilestone = {
    ...input,
    id: `PMS-${String(PROJECT_MILESTONES.length + 1).padStart(4, '0')}`,
    status: input.status ?? 'not-started'
  }
  PROJECT_MILESTONES.push(milestone)
  return milestone
}

/* ------------------------------------------------------------------ *
 * Catatan
 * ------------------------------------------------------------------ */

export function getProjectNotes (projectId: string): ProjectNote[] {
  return PROJECT_NOTES
    .filter(note => note.projectId === projectId)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt.localeCompare(a.createdAt))
}

export function createProjectNote (projectId: string, authorId: string, body: string): ProjectNote | undefined {
  if (!body.trim()) { return undefined }
  const note: ProjectNote = {
    id: `PNT-${String(PROJECT_NOTES.length + 1).padStart(3, '0')}`,
    projectId,
    authorId,
    body: body.trim(),
    createdAt: DEMO_REFERENCE_DATE
  }
  PROJECT_NOTES.push(note)
  return note
}

export function toggleProjectNotePin (noteId: string): ProjectNote | undefined {
  const note = PROJECT_NOTES.find(item => item.id === noteId)
  if (!note) { return undefined }
  note.pinned = !note.pinned
  return note
}
