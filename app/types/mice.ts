import type { ID } from './common'

/**
 * MICE dan Event (Section 16 — roadmap Section 00–24 baru). Entitas baru `MiceEvent`, TERPISAH dari
 * `ProjectService` (Foundation/Section 12 lama) — pola arsitektur IDENTIK D-070/D-071/D-072 (Section
 * 13/Ticketing, 14/Accommodation, 15/Transportation): `ProjectService` (tipe `mice`) tetap ringkasan baris
 * generik di tab "Itinerary & Services" (label/status/vendor/bookingReference), sedangkan `MiceEvent` adalah
 * model lifecycle detail KHUSUS event (brief/venue/sessions/BOQ/staffing/checklist/approval/deliverables)
 * yang tidak bisa dipaksakan ke model generik itu. `serviceId` (opsional) menautkan balik ke `ProjectService`
 * bila baris generiknya sudah ada.
 *
 * Berbeda dari Section 13-15, satu project biasanya hanya memiliki SATU event MICE utama (bukan banyak
 * booking terpisah per traveler/group) — struktur internal event (sessions/BOQ/staffing/checklist) yang
 * kaya, bukan jumlah baris fixture, yang merepresentasikan skala acara.
 *
 * "Staffing/PIC" (Wajib) direuse dari `User` existing (Section 02, `app/types/user.ts`) lewat `userId` —
 * tidak ada entitas staff internal paralel. "Vendor packages" (Wajib) direuse dari `Vendor` existing
 * (Section 13 lama) lewat `vendorId` opsional per baris BOQ — tidak ada entitas Supplier paralel.
 */

export type MiceEventStatus = 'planning' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled'

/** "Client approval states" (Wajib) — terpisah dari `MiceEventStatus` (pola sama `QuotationApprovalStatus` terpisah dari `OpportunityStage`, D-049). Perubahan pasca-`approved` ditangani lewat "Change order" (`hasChangeOrder`), BUKAN kembali ke `submitted`. */
export type MiceApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

/** "Rooms/sessions, agenda/rundown" (Wajib) — embedded array, juga sumber deteksi "Capacity and schedule conflicts". */
export interface MiceSession {
  roomName: string
  sessionTitle: string
  startAt: string
  endAt: string
  capacity: number
  /** Staffing/PIC penanggung jawab sesi ini — reuse `User.id`. */
  picUserId?: ID
  /** Venue/sesi ini sudah final atau masih tentatif (mis. menunggu konfirmasi venue alternatif). */
  isConfirmed?: boolean
}

/** "Participant categories" (Wajib) — juga sumber "Attendance" (`actualCount`, diisi pasca-sesi berlangsung). */
export interface MiceParticipantCategory {
  category: string
  expectedCount: number
  actualCount?: number
}

export type MiceBoqCategory = 'catering' | 'av' | 'staging' | 'equipment' | 'booth' | 'other'

/** "Catering, AV, staging, equipment, booths" + "Vendor packages dan BOQ" (Wajib) — embedded Bill of Quantities. */
export interface MiceBoqItem {
  category: MiceBoqCategory
  description: string
  quantity: number
  unit: string
  /** Vendor package (Wajib) — opsional, reuse `Vendor.id` existing (Section 13 lama), bukan entitas Supplier baru. */
  vendorId?: ID
  /** Internal cost isolation (hard rule protokol) — `netCostIdr` TIDAK BOLEH terlihat Client. Opsional — belum terisi bila baris masih estimasi kasar. */
  netCostIdr?: number
  sellPriceIdr?: number
}

/** "Staffing/PIC" (Wajib) — reuse `User` existing, bukan entitas staff paralel. */
export interface MiceStaffAssignment {
  userId: ID
  roleLabel: string
}

export type MiceChecklistTask = 'setup' | 'teardown' | 'rehearsal' | 'permit'

/** "Setup/teardown/rehearsal/permit checklist" (Wajib). */
export interface MiceChecklistItem {
  task: MiceChecklistTask
  label: string
  isDone: boolean
}

/** "Deliverables" (Wajib) — output pasca-event (dokumentasi, laporan, dst.). */
export interface MiceDeliverable {
  label: string
  isDelivered: boolean
}

export interface MiceEvent {
  id: ID
  projectId: ID
  /** Opsional — referensi balik ke `ProjectService` (tipe `mice`) bila baris generiknya sudah ada. */
  serviceId?: ID
  /** "Brief" (Wajib) — tujuan/latar belakang event. */
  brief?: string
  /** "Venue" (Wajib). */
  venueName?: string
  venueAddress?: string
  status: MiceEventStatus
  clientApprovalStatus: MiceApprovalStatus
  sessions: MiceSession[]
  participantCategories: MiceParticipantCategory[]
  boqItems: MiceBoqItem[]
  staffAssignments: MiceStaffAssignment[]
  checklist: MiceChecklistItem[]
  deliverables: MiceDeliverable[]
  /** "Change order" (Wajib) — perubahan pasca-approval (mis. venue/rundown berubah), pola sama `TransportBooking.hasChange`. */
  hasChangeOrder?: boolean
  changeOrderNote?: string
  /** "Incident" (Wajib) — insiden operasional selama event berlangsung, pola sama `TransportBooking.hasIncident`. */
  hasIncident?: boolean
  incidentNote?: string
  /** Alasan wajib untuk transisi `cancelled` (pola sama section lain, D-070/D-071/D-072) — dicatat di sini DAN sebagai `ActivityEntry` di project terkait. */
  statusReason?: string
  createdAt: string
  updatedAt?: string
}
