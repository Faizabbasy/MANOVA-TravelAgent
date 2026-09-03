import type { ID, GeoPoint } from './common'

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
  /** Group Trip B2C (`Project.isGroupTrip`) — tab tambahan, tab value lama di atas tetap dipakai (direlabel) untuk sisanya. */
  | 'bookings'
  | 'reservations'
  | 'payments'

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
 * Closure checklist (Section 09 shell, Wajib "Closure checklist shell untuk dipenuhi section akhir") —
 * 4 item awal dapat ditoggle PM/Super Admin (mock), `financeSettled` digerbangi NYATA sejak Section 20
 * (`evaluateFinanceClosureGate`/`closeProjectFinance`, JANGAN ditoggle manual lagi).
 *
 * Section 24 (final section) EXTENDS additif — `servicesCompleted`/`unresolvedIssuesHandled`/
 * `documentsComplete` adalah derivasi READ-ONLY yang ditulis HANYA oleh `evaluateProjectClosureGate`
 * sesaat sebelum `closeProject` berhasil (bukan checkbox manual seperti 4 item lama, karena ketiganya
 * sudah punya sumber kebenaran sendiri — service/booking status, Incident/ChangeRequest, Document expiry
 * — men-toggle manual akan membuatnya bisa stale/bohong). `clientFeedback`/`finalNote` diisi manusia
 * (Management/PM) saat mengeksekusi `closeProject` — Wajib literal Section 24 "client feedback/final
 * note". `Project.closedAt`/`closedBy` (bukan field di sini, lihat interface `Project` di bawah) TETAP
 * satu-satunya sumber kebenaran "Closed" via `getProjectOrderStatus()` (D-066) — tidak diduplikasi di sini.
 */
export interface ProjectClosureChecklist {
  financeSettled: boolean
  documentsArchived: boolean
  feedbackCollected: boolean
  assetsReturned: boolean
  /** Section 24 — snapshot hasil `evaluateProjectClosureGate` saat `closeProject` terakhir berhasil dipanggil. */
  servicesCompleted: boolean
  unresolvedIssuesHandled: boolean
  documentsComplete: boolean
  clientFeedback?: string
  finalNote?: string
}

export interface Project {
  id: ID
  name: string
  partyId: ID
  /** Group Trip B2C (`createProject`/`joinLeadToGroupProject`, `app/data/index.ts`) — Project dibuat lebih
   * dulu tanpa customer nyata (`partyId` menunjuk Party placeholder sistem), banyak Lead individual berbeda
   * bisa "gabung" belakangan sebagai `Traveler` masing-masing, tiap gabung otomatis jadi Customer sendiri.
   * `false`/kosong = Project B2B biasa, `partyId` adalah customer sungguhan. */
  isGroupTrip?: boolean
  /** Lead asal (Won) — referensi, bukan duplikasi. */
  leadId?: ID
  /** Quotation yang di-Won-kan, referensi (docs/route-and-role-matrix.md bagian 2.2 item 6). */
  sourceQuotationId?: ID
  destination: string
  /** Lokasi terstruktur hasil resolusi `destination` (`resolveDestinationGeo`, `app/data/geo.ts`) — di-set otomatis saat Project dibuat dari Opportunity Won. Kosong bila teks destinasi tidak cocok referensi. */
  destinationGeo?: GeoPoint
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
  /**
   * Fase 3.2 (Poros Project Order + Jurnal Finance, Penyederhanaan 7-Role/Menu) — field seed/override mock
   * lama, TIDAK PERNAH diperbarui mutator apa pun setelah project dibuat (selalu `0` untuk project baru,
   * lihat `createProject`). Seluruh tampilan WAJIB memanggil `getProjectActualCostIdr(projectId)`
   * (`app/data/finance-ext.ts`) — turunan Σ SupplierInvoice (di luar rejected) + Σ Opex ber-project, sumber
   * yang sama dengan `getJournalEntries()` — BUKAN field mentah ini.
   */
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
  /** Section 24 — actor yang mengeksekusi `closeProject` (pola sama `handoverAcceptedBy`). Aditif, sengaja TIDAK menduplikasi `closedAt` ke dalam `ProjectClosureChecklist` — satu sumber kebenaran saja. */
  closedBy?: ID
  closureChecklist?: ProjectClosureChecklist

  /**
   * Trip Center kontak (Repair Phase Section 5 — Execution & Changes, Master Prompt bagian 10). Opsional —
   * project lama tanpa nilai ini tetap tampil wajar (Trip Center menampilkan "Belum ditugaskan"), pola sama
   * `handoverAcceptedBy` dkk. `emergencyContactName`/`Phone` adalah kontak darurat 24 jam Project Order
   * (level project, BUKAN duplikasi `Traveler.emergencyContactName`/`Phone` yang per-traveler).
   */
  tourLeaderName?: string
  tourLeaderPhone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  /** Default meeting point pra-keberangkatan (mis. titik kumpul bandara) — dipakai Trip Center bila hari berjalan belum punya `ItineraryItem.location` sendiri. */
  meetingPoint?: string
  /** Foto cover trip — hanya dipakai Group Trip B2C (`isGroupTrip`), tampil di header Project Detail dan list "Sales Order". Project B2B tetap pakai icon polos. Mock upload (data URL lokal), bukan file storage nyata (D-006). */
  photoUrl?: string
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
  /** Alokasi budget untuk baris layanan ini (tab Finance, "Pengeluaran per Layanan") — input manual per baris, dijumlahkan per `type` di `getServiceTypeSpendBreakdown` (`app/data/finance-ext.ts`). Opsional — belum tentu seluruh layanan sudah dialokasikan. */
  budgetIdr?: number
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
  /** Meeting point/lokasi hari ini (Repair Phase Section 5 — Trip Center, Master Prompt bagian 10). Opsional, teks bebas mis. "Lobi Hotel, pukul 08:00". */
  location?: string
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
  /** Link balik ke customer/billing asal roster row ini — diisi hanya untuk traveler yang bergabung lewat
   * "Group Trip" B2C (`joinLeadToGroupProject`, `app/data/index.ts`); traveler yang ditambah manual (roster
   * B2B biasa) tidak punya ini. */
  partyId?: ID
  leadId?: ID
  salesOrderId?: ID
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

  /**
   * Repair Phase Section 4 (Core Project) — "Mark VIP"/"Replace"/"Cancel" (Master Prompt bagian G.7).
   * Aditif murni, tidak mengubah field existing. `cancelled`/`replacedByTravelerId` TIDAK menghapus baris
   * (pola sama seluruh entitas lain di codebase — append-only, status berubah, bukan dihapus), agar riwayat
   * (invoice/rooming/dokumen yang sudah menaut ke traveler ini) tetap konsisten.
   */
  isVip?: boolean
  cancelled?: boolean
  cancelReason?: string
  /** Terisi pada traveler LAMA begitu digantikan — menaut ke traveler BARU hasil "Replace". */
  replacedByTravelerId?: ID
  /** Terisi pada traveler BARU hasil "Replace" — menaut balik ke traveler LAMA yang digantikannya. */
  replacesTravelerId?: ID
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
