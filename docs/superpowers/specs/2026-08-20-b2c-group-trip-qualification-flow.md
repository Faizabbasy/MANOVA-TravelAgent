# B2C Group Trip Qualification Flow (DP-gated)

Status: implemented. Melengkapi fitur Group Trip B2C sebelumnya (`Project.isGroupTrip`, `createProject`)
dengan alur qualification yang lebih akurat secara bisnis travel: Lead yang Qualified TIDAK langsung jadi
Participant — ada jeda "Awaiting DP" sampai down payment benar-benar dikonfirmasi.

## Kenapa

Versi sebelumnya (`joinLeadToGroupProject`, sudah dihapus) membuat Customer + SalesOrder + Traveler
(participant) sekaligus dalam satu langkah begitu Qualify diklik. Ini tidak merepresentasikan alur nyata
travel agency: booking baru "confirmed" setelah DP masuk, bukan begitu qualification selesai. Kalau seat
sudah habis (termasuk yang masih menunggu DP), Lead berikutnya seharusnya masuk Waitlist, bukan tetap
dipaksa Qualified (overbooking).

## State machine

```
Lead B2C dibuka → pilih Project B2C (dropdown, opsional)
  → kosong  → flow lama TIDAK BERUBAH: Dialog "Qualify & Create Sales Order", booking standalone langsung.
  → dipilih → data Project tampil read-only (destination, dates, duration, price/pax, capacity,
              booked/confirmed pax, available seat, meeting point).
              Isi Adult/Child/Infant + Price Acceptance + Booking Readiness + Special Requirement
              (`Lead.specialRequestNote`, field lama) + Qualification Result:

  Result "Qualified"      + seat cukup  → Party (dedup by name) + SalesOrder(status 'draft') dibuat,
                                           `order.projectId`/`lead.projectId` di-set. Ditampilkan "Awaiting DP".
                                           TIDAK ada Traveler/Participant dibuat di titik ini.
  Result "Qualified"      + seat KURANG → dipaksa jadi "Waitlist" (bukan Qualified) — tidak ada
                                           SalesOrder/Party yang dibuat.
  Result "Waitlist"       (manual)      → sama seperti di atas — Lead tetap terlihat/aktif.
  Result "Follow Up"                    → draft disimpan + `LeadActivity` dengan `dueAt` (Next Follow-up
                                           Date), Lead tetap aktif, tidak archived.
  Result "Not Qualified"                → reuse `markLeadUnqualified` (fungsi lama, tidak diubah) — sama
                                           persis behavior B2B.

[Aksi terpisah — tab "Bookings" pada Project B2C detail] "Konfirmasi DP" pada baris Awaiting DP
  → `updateSalesOrderStatus(orderId, 'paid')` (fungsi generic, dipakai order standalone lama JUGA — tidak
     diubah behaviornya untuk order tanpa `projectId`)
  → kalau `order.projectId` terisi: OTOMATIS buat N `Traveler` (N = `order.travelerCount`, pax booking ini)
  → Traveler inilah yang jadi sumber "Confirmed Participants"/manifest DAN "seat terisi" (`getProjectSeatsFilled`)
```

## Field baru

**`app/types/lead.ts`** (semua opsional, non-breaking):
- `groupTripProjectId?: ID` — Project B2C dipilih di form. Beda dari `Lead.projectId` (existing) yang baru
  terisi begitu benar-benar Qualified — `groupTripProjectId` adalah superset (termasuk Waitlist/Follow-up).
- `b2cAdultCount?`, `b2cChildCount?`, `b2cInfantCount?: number`
- `b2cPriceAcceptance?: 'accept' | 'need-discussion' | 'not-suitable'`
- `b2cBookingReadiness?: 'ready' | 'need-follow-up' | 'still-considering'`
- `b2cQualificationResult?: 'qualified' | 'follow-up' | 'waitlist' | 'not-qualified'`
- `b2cNextFollowUpDate?: string`

**`app/types/sales-order.ts`**: `SalesOrder.projectId?: ID` — terisi hanya untuk booking Group Trip B2C.
Order standalone lama (dibuat lewat `createSalesOrder`, halaman `/sales-orders`) tetap kosong, tidak berubah.

## Fungsi data layer (`app/data/index.ts`)

| Fungsi | Status | Catatan |
|---|---|---|
| `qualifyLeadAndCreateSalesOrder` | **tidak diubah** | Tetap dipakai apa adanya untuk Party dedup + SalesOrder(draft) + tandai Lead won. |
| `updateSalesOrderStatus` | **diperkaya** | Tambahan blok: transisi ke `'paid'` + `order.projectId` terisi → auto-buat Traveler (idempotent). Order tanpa `projectId` tidak terpengaruh. |
| `markLeadUnqualified` | **tidak diubah** | Reuse untuk hasil "Not Qualified". |
| `qualifyGroupTripLead` (baru) | — | Ganti `joinLeadToGroupProject` (dihapus). Guard kapasitas (Confirmed + Awaiting DP), downgrade paksa ke Waitlist kalau pax > seat tersisa. |
| `getProjectSeatsPending` (baru) | — | Total pax dari SalesOrder `draft` yang terhubung ke Project — ikut menahan seat (Available Seat = kapasitas − Confirmed − Pending). |
| `getProjectSeatsAvailable` | **diperbarui** | Sekarang juga mengurangi `getProjectSeatsPending`, bukan cuma `getProjectSeatsFilled`. |
| `getSalesOrdersByProject`, `getLeadsLinkedToGroupProject` (baru) | — | Getter untuk tab Bookings Project detail. |

## UI

- **`app/components/sales/SalesLeadsPanel.vue`** — dropdown "Project B2C" + ringkasan read-only + field
  qualification B2C baru muncul di tab Qualification saat `serviceCategory === 'individual-travel'`. Tombol
  "Submit Qualification" (bukan Dialog) menggantikan Dialog Qualify hanya saat Project dipilih; Lead B2C
  tanpa Project tetap pakai Dialog lama (booking standalone, tidak berubah).
- **`app/pages/project-orders/[id]/index.vue`** — tab "Bookings" pada Project Group Trip menampilkan 5
  bucket: Linked Leads, Awaiting DP (dengan tombol "Konfirmasi DP"), Confirmed Bookings, Confirmed
  Participants, Available Seats.

## Yang TIDAK berubah

Flow B2B (`markLeadWon`, Quotation, Project 8-tab lama), Sales Order standalone (`createSalesOrder`,
halaman `/sales-orders/[id]`), filter "Won" di Leads list (`isLeadWon` — masih `projectId || salesOrderId`,
tidak disentuh).
