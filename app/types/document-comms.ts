import type { ID } from './common'

/**
 * Documents, Communication dan Notifications (Section 21 — roadmap Section 00–24 baru, D-078). Modul
 * konsolidasi-style FULLY ADDITIVE, MENDAMPINGI (bukan menggantikan) `ProjectDocument`/`getDocumentsByProject`/
 * `getDocumentsByParty` (Section 14 lama/Prompt 19, `app/types/activity.ts`) dan `VendorDocument` (Section 17,
 * `app/types/vendor.ts`) — pola arsitektur mengikuti preseden D-075/D-076 (consolidation/orchestration layer
 * lintas-domain, seperti Section 21 adalah turunan KETIGA): entitas baru menautkan ke entitas existing lewat
 * ID, tidak pernah memutasi/menggantikan apa yang ditautnya.
 *
 * `Document` (baru) menggeneralisasi konsep dokumen lintas seluruh entitas (project/party/vendor/traveler/
 * quotation/flight/hotel/transport/mice/invoice/change-request/incident) dengan category/version/expiry/
 * access-level yang belum dimiliki `ProjectDocument` (hanya id/projectId/name/uploadedAt, tetap dipakai apa
 * adanya — TIDAK diubah shape-nya). Dokumen `sourceType: 'generated'` MENAUTKAN (lewat `previewRoute`, bukan
 * menduplikasi) ke salah satu dari 9 halaman preview existing (Section 05/13-16/09) yang sudah memproduksi
 * dokumen tsb — Section 21 TIDAK PERNAH membuat generator dokumen baru.
 */

/** Visibilitas dokumen/pesan (Wajib "Internal/client/supplier visibility") — acceptance literal "tidak bocor lintas role" digerbangi field ini di SETIAP titik render. */
export type DocumentAccessLevel = 'internal' | 'client' | 'supplier'

export type DocumentSourceType = 'uploaded' | 'generated'

/** Entitas yang dapat memiliki dokumen — mencakup entitas lintas-domain existing (Section 05/09/13-16/19/Foundation), bukan daftar tertutup fiktif. */
export type DocumentEntityType =
  | 'project'
  | 'party'
  | 'vendor'
  | 'traveler'
  | 'quotation'
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'mice'
  | 'invoice'
  | 'change-request'
  | 'incident'

export interface Document {
  id: ID
  entityType: DocumentEntityType
  entityId: ID
  /** Convenience field cross-project filtering (Wajib "Document folders per entity/project") — opsional, hanya terisi bila dokumen punya konteks project langsung (mayoritas kasus). */
  projectId?: ID
  name: string
  category: string
  version: number
  /** Terisi untuk `sourceType: 'uploaded'`. */
  uploadedAt?: string
  /** Terisi untuk `sourceType: 'generated'`. */
  generatedAt?: string
  expiresAt?: string
  accessLevel: DocumentAccessLevel
  sourceType: DocumentSourceType
  /** Hanya untuk `sourceType: 'generated'` — menautkan ke salah satu dari 9 route preview existing yang SUDAH ADA di codebase (Section 05/09/13-16), TIDAK PERNAH route baru/fiktif. */
  previewRoute?: string
  uploadedBy?: ID
}

/** "Internal notes, client messages, supplier messages" (Wajib) — tiga channel eksplisit, masing-masing digerbangi visibilitas berbeda di UI (client/supplier TIDAK PERNAH melihat `internal-note`). */
export type MessageChannel = 'internal-note' | 'client-message' | 'supplier-message'

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed'

/**
 * `Message` — internal notes/client messages/supplier messages terstruktur per entity (Wajib). `deliveryStatus`/
 * `deliveryChannel` MURNI label mock (D-006, "Email/WhatsApp delivery status simulation tanpa klaim integrasi")
 * — menggeneralisasi preseden `Quotation.sentToClientAt` (Section 05, satu timestamp flip, `app/pages/crm/
 * opportunities/[id]/index.vue` baris ~257) menjadi status lebih kaya (queued/sent/delivered/failed) TANPA
 * queue/webhook/integrasi nyata apa pun.
 */
export interface Message {
  id: ID
  entityType: DocumentEntityType
  entityId: ID
  projectId?: ID
  channel: MessageChannel
  senderId: ID
  body: string
  /** Mentions (Wajib) — userId yang di-mention, memicu `Notification` type `mention` lewat `sendMessage`. */
  mentions?: ID[]
  sentAt: string
  deliveryStatus: MessageDeliveryStatus
  /** Label mock SAJA — TIDAK ADA integrasi email/WhatsApp nyata (larangan protokol eksplisit). */
  deliveryChannel?: 'email' | 'whatsapp'
}

/** "Mentions, assignments, reminders, escalation" (Wajib) + `change`/`incident`/`document` sebagai perluasan wajar cakupan notifikasi in-app. */
export type NotificationType = 'mention' | 'assignment' | 'reminder' | 'escalation' | 'change' | 'incident' | 'document' | 'message'

/**
 * `Notification` — in-app notification center (Wajib). Dipicu HANYA dari titik pemicu KURASI (bukan seluruh
 * mutator lintas codebase) — mengikuti preseden Section 18 "hanya 3 dari 4 booking-create flow dihook untuk
 * duplicate-prevention" (D-075): representatif, bukan menyeluruh. Lihat `docs/mockup-change-impact-log.md`
 * CI-051 untuk daftar 4 hook point yang diizinkan eksplisit di section ini.
 */
export interface Notification {
  id: ID
  /** Target recipient — SATU user per notifikasi (bukan broadcast), pola sama `escalatedTo`/`ownerId` section lain. */
  userId: ID
  type: NotificationType
  title: string
  body: string
  entityType?: DocumentEntityType
  entityId?: ID
  createdAt: string
  read: boolean
}

export type UnifiedTimelineEntryKind = 'activity' | 'system-event' | 'message' | 'document'

/**
 * "Unified activity timeline dengan filtering akses" (Wajib) — derived view-model DIHITUNG oleh
 * `getUnifiedActivityTimeline` (`app/data/index.ts`), pola sama `BookingTimelineEntry` (D-075)/
 * `getServiceReadinessMatrix` (Section 12) — BUKAN entitas tersimpan, tidak bisa stale. Menggabungkan
 * `ActivityEntry` (Section 14 lama) + `SystemEvent` (Prompt 19) + `Message` + `Document` (generate/upload)
 * satu entitas, terurut kronologis. `internalOnly` men-gate entri yang TIDAK boleh terlihat viewer
 * non-internal (client/supplier) — acceptance literal "tidak bocor lintas role".
 */
export interface UnifiedTimelineEntry {
  id: ID
  at: string
  kind: UnifiedTimelineEntryKind
  label: string
  detail: string
  internalOnly: boolean
}
