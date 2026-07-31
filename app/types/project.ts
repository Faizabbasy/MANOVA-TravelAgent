import type { ID } from './common'

/** `additional` (Section 12) — layanan ad-hoc di luar 4 kombinasi tipe project resmi (Prompt 0-B); tidak
 * pernah dimasukkan ke `Project.serviceScope`, visibilitasnya murni data-driven (ada/tidaknya baris service
 * bertipe ini), bukan bagian klasifikasi "4 kombinasi tipe project" yang tetap flight/hotel/transportation/mice. */
export type ServiceTypeKey = 'flight' | 'hotel' | 'transportation' | 'mice' | 'additional'

export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'in-progress'
  | 'ongoing-trip'
  | 'completed'
  | 'on-hold'
  | 'cancelled'

export type ProjectCharacteristic = 'normal' | 'high-change' | 'complex'

export type ServiceStatus =
  | 'not-started'
  | 'sourcing'
  | 'quoted'
  | 'pending-confirmation'
  | 'confirmed'
  | 'changed'
  | 'completed'
  | 'cancelled'

/** Tab identifiers for the Project Detail workspace (docs/mockup-information-architecture.md bagian 4). */
export type ProjectDetailTab =
  | 'overview'
  | 'itinerary-services'
  | 'travelers'
  | 'vendors'
  | 'finance'
  | 'tasks'
  | 'documents'
  | 'activity-changes'

/**
 * "Project Order Status" (Section 09 — roadmap Section 00–24 baru, D-066) — 10 nilai literal Wajib
 * (Created/Handover Pending/Planning/Confirmed/Ready/In Progress/Completed/Closed/On Hold/Cancelled),
 * DIRIVASI dari kombinasi `Project.status` (8 nilai, LOCKED D-028) + field handover/ready/closure baru di
 * bawah — BUKAN pengganti/restrukturisasi `ProjectStatus`, mengikuti pola D-049/D-053/D-056 (lihat
 * `getProjectOrderStatus`, `app/data/index.ts`). `'created'` secara praktik tidak pernah persisten (mirip
 * `OpportunityStage.won-requested`) — project selalu lahir langsung sebagai `draft`/Handover Pending.
 */
export type ProjectOrderStatus =
  | 'created'
  | 'handover-pending'
  | 'planning'
  | 'confirmed'
  | 'ready'
  | 'in-progress'
  | 'completed'
  | 'closed'
  | 'on-hold'
  | 'cancelled'

/**
 * Closure checklist SHELL (Section 09, Wajib "Closure checklist shell untuk dipenuhi section akhir") —
 * seluruh item dapat ditoggle PM/Super Admin sekarang (mock, tidak menggerbangi apa pun), TIDAK ada logic
 * yang menghubungkannya ke transisi status/Closed secara otomatis — pemenuhan penuh (gating, dst.) sengaja
 * diserahkan ke section akhir (Section 24) sesuai instruksi literal.
 */
export interface ProjectClosureChecklist {
  financeSettled: boolean
  documentsArchived: boolean
  feedbackCollected: boolean
  assetsReturned: boolean
}

export interface Project {
  id: ID
  name: string
  partyId: ID
  opportunityId?: ID
  /** Quotation yang di-Won-kan, referensi (Section 09 — docs/route-and-role-matrix.md bagian 2.2 item 6). */
  sourceQuotationId?: ID
  destination: string
  travelStartDate: string
  travelEndDate: string
  characteristic: ProjectCharacteristic
  serviceScope: ServiceTypeKey[]
  travelerCount: number
  ownerId: ID
  teamUserIds: ID[]
  status: ProjectStatus
  quotationAmountIdr: number
  budgetIdr: number
  actualCostIdr: number

  /**
   * AE-to-PM Handover (Section 09 — roadmap Section 00–24 baru). Diisi lewat `acceptProjectHandover`/
   * `returnProjectHandover` (`app/data/index.ts`) — PM menerima atau mengembalikan handover Project Order
   * baru dengan alasan (Wajib "PM Accept/Return Handover dengan reason"). Sebelum di-`accept`, Project
   * Order tetap tampil "Handover Pending" di `getProjectOrderStatus` — TIDAK kehilangan data komersial
   * apa pun (quotation/budget sudah terisi penuh sejak `approveOpportunityWon`, Section 05/06).
   */
  handoverAcceptedAt?: string
  handoverAcceptedBy?: ID
  handoverReturnedAt?: string
  handoverReturnReason?: string
  /** PM menandai Project Order siap keberangkatan (dari status `confirmed`) — `getProjectOrderStatus` mengembalikan `'ready'`. */
  readyAt?: string
  /** Diisi saat closure checklist (lihat `ProjectClosureChecklist`) dianggap tuntas — `getProjectOrderStatus` mengembalikan `'closed'` alih-alih `'completed'`. */
  closedAt?: string
  closureChecklist?: ProjectClosureChecklist
}

export interface ProjectService {
  id: ID
  projectId: ID
  type: ServiceTypeKey
  label: string
  status: ServiceStatus
  vendorId?: ID
  /** Booking/reference mock (Section 12) — nomor referensi/PNR/konfirmasi, bukan hasil integrasi API nyata (D-006). */
  bookingReference?: string
}

/** Daily itinerary (Section 12 lama) — jadwal harian per project, tab "Itinerary & Services". */
export interface ItineraryItem {
  id: ID
  projectId: ID
  date: string
  time?: string
  title: string
  description?: string
  serviceType?: ServiceTypeKey
  /** Referensi ke `TravelerGroup` (Section 11) — harus memakai ID group yang sudah ada, bukan dibuat baru. */
  groupId?: ID
  /** "Timezone-aware schedule" (Section 12 baru, roadmap Section 00–24) — label IANA zona waktu lokasi item ini, mis. "Asia/Manila". Teks murni untuk ditampilkan berdampingan `time` — bukan konversi timezone otomatis (tidak ada integrasi/library kalender nyata, D-006). */
  timezone?: string
  /** "Internal vs client-shared itinerary" (Section 12 baru, Wajib) — default `true` bila kosong (item lama tetap tampil ke Client tanpa migrasi). `false` = catatan operasional internal, disaring dari `/client/project-orders/[id]`. */
  visibleToClient?: boolean
}

export interface TravelerGroup {
  id: ID
  projectId: ID
  name: string
  paxCount: number
  /** Ringkasan rooming list per group (Section 11), mis. "5 kamar twin (10 pax)" — teks, bukan breakdown kamar granular. */
  roomingNote?: string
}

export interface Traveler {
  id: ID
  projectId: ID
  groupId?: ID
  name: string
  passportNumber?: string
  passportExpiryDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  specialRequest?: string

  /** Section 11 (roadmap Section 00–24 baru) — "Passport/ID/visa metadata". ID = KTP/national ID, terpisah dari paspor. */
  idNumber?: string
  visaNumber?: string
  /** Bila `visaNumber` terisi, `visaExpiryDate` ikut dinilai oleh `isTravelerDocumentMissing` (`app/utils/attention.ts`) — visa opsional (tidak seluruh destinasi butuh visa), tapi bila sudah diisi harus lengkap/valid. */
  visaExpiryDate?: string
  /** "Dietary, accessibility" (Wajib) — dipisah dari `specialRequest` (freeform "lainnya") agar dapat ditampilkan sebagai kategori sendiri di manifest/rooming list export. */
  dietaryRestrictions?: string
  accessibilityNeeds?: string
  /** "Companion" (Wajib "Group, rooming, companion") — traveler ini mendampingi traveler lain (mis. anak/pasangan), referensi ke `Traveler.id` lain di project yang sama. */
  companionOfTravelerId?: ID
  /** "Internal verification" (Wajib) — dicatat lewat `verifyTravelerDocuments`/`unverifyTravelerDocuments` (`app/data/index.ts`), terpisah dari `isTravelerDocumentMissing` (computed kelengkapan) — verification adalah tindakan manusia (staf internal mengonfirmasi dokumen sudah diperiksa), bukan hasil derivasi otomatis. */
  documentsVerifiedAt?: string
  documentsVerifiedBy?: ID
}

export type RoomType = 'single' | 'twin' | 'suite'

/** Rooming list (Section 11) — penugasan traveler bernama ke kamar spesifik dalam satu group. */
export interface RoomAssignment {
  id: ID
  projectId: ID
  groupId: ID
  roomLabel: string
  roomType: RoomType
  travelerIds: ID[]
}
