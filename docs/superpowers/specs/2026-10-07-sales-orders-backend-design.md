# Backend sales order B2C & Group Trip (S6b) — desain

Tanggal: 7 Oktober 2026 · Branch: `production` · Status: disetujui di chat, menunggu review spec

Lanjutan S6a. S6b memindahkan seluruh sales order B2C ke server — order standalone (tanpa project) dan booking peserta
Group Trip — termasuk status, hitungan kursi, dan hasil qualify B2C/Group Trip. Konfirmasi DP tetap lewat Finance
(sudah di server sejak S4/Finance), kini sekaligus menandai order `paid`.

## Keputusan

| Topik | Keputusan |
|---|---|
| Lingkup | **Semua sales order**: standalone + peserta Group Trip; kursi dihitung server dari order aktif. Data traveler tetap lokal (S7) |
| Status `paid` | **Group Trip dari DP**: `confirm-dp` Finance menandai order `paid` dalam transaksi yang sama, tidak bisa diklik manual. **Standalone manual** oleh Sales |
| Batal setelah ada invoice | **Boleh, wajib alasan**; kursi bebas; invoice tetap di Finance untuk refund/void. Sales tidak menyentuh uang |
| Tabel | **Perluas `sales_order_refs`** (sudah dirujuk `customer_invoices.sales_order_id` dan konfirmasi DP), bukan tabel baru |
| Hak akses | Tulis: `sales.manage-lead` (admin; super-admin lolos). Finance baca. Portal 403 |
| Tetap lokal | Traveler (dibuat lokal setelah DP, S7), form publik `/lead-intake`, catatan aktivitas lokal yang sudah ada |

## Backend

### Migrasi `0025_sales_orders`

`sales_order_refs` — perubahan:
- `project_id` menjadi nullable (order standalone). Order ber-project harus ke project `is_group_trip` (dicek di
  aplikasi; baris lama tetap).
- Kolom baru: `status text not null default 'draft'` check ∈ `draft, paid, ongoing, done, cancelled`; `status_reason`;
  `destination`, `travel_start_date date`, `travel_end_date date` (check end ≥ start), `note`; `lead_id` FK leads;
  `paid_on date`, `created_on date not null default current_date`, `updated_at timestamptz not null default now()`.
- Index `(lead_id)`; `(project_id)` sudah ada.
- `id_sequences`: `SLO-` dari angka terbesar; `syncIdSequences` mengenalnya. Down migration membalik (baris tanpa
  project dihapus dulu sebelum `project_id` kembali not null).

### Kursi Group Trip

`seats(projectId)` = kapasitas `projects.traveler_count`; `filled` = Σ pax order `paid/ongoing/done`; `held` = Σ pax
order `draft`; `available = max(0, kapasitas − filled − held)`. Order `cancelled` tidak dihitung. Setiap penulisan yang
menambah pax ke project (buat order Group Trip) mengunci baris project (`for update`) lalu menolak 422 bila
`pax > available`.

### Sales order

| Endpoint | Aturan |
|---|---|
| `GET /sales-orders?projectId=`, `GET /sales-orders/:id` | peran internal; portal 403. Bentuk: `{ id, projectId, partyId, partyName, leadId, destination, travelStartDate, travelEndDate, travelerCount, priceMinor, status, statusReason, note, paidOn, createdOn, updatedAt }` |
| `POST /sales-orders` | Idempotency-Key; `sales.manage-lead`; order standalone. Customer: `partyId` (harus ada) **atau** `customerName` → customer individual `client` baru (jalur `createParty` S1). Destinasi, periode (end ≥ start), `travelerCount ≥ 1`, `priceMinor > 0` wajib. Status `draft` |
| `POST /sales-orders/:id/status` `{ to, reason? }` | urutan `draft → paid → ongoing → done`, `cancelled` dari `draft/paid/ongoing`. Group Trip ke `paid` → 422 "Konfirmasi DP di Finance". Batal wajib alasan; bila ada invoice non-void, tetap boleh dan audit mencatat `invoiceIds` |
| `GET /projects/:id/seats` | `{ capacity, filled, held, available }`; project bukan Group Trip → 422 |

### Qualify B2C (perluasan S6a)

- `POST /leads/:id/qualify` untuk lead `individual-travel` menerima `{ priceMinor, travelerCount? }`. Bila
  `priceMinor` dikirim: satu transaksi — qualify (aturan S6a), order standalone dari data lead (destinasi, periode,
  pax = `travelerCount ?? traveler_estimate`), `lead_id` diisi, `b2c.salesOrderId` diset. Tanpa `priceMinor` perilaku
  S6a tetap.
- `POST /leads/:id/group-trip` `{ projectId, adultCount, childCount, infantCount, priceMinor, priceAcceptance,
  bookingReadiness }` (`sales.manage-lead`): lead harus `individual-travel`, belum diarsip/won, project Group Trip.
  Kunci project → bila pax ≤ `available`: qualify (customer individual), order draft ber-project, `b2c` diisi
  (`groupTripProjectId`, jumlah pax, penerimaan harga, kesiapan, `b2cQualificationResult: 'qualified'`,
  `projectId`, `salesOrderId`). Bila tidak cukup: hanya `b2c` (`… 'waitlist'`), stage lead tidak berubah, tanpa order.
  Respons `{ outcome: 'qualified' | 'waitlist', lead, salesOrder? }`. Lead yang sudah punya order aktif → 409.
- Hasil `follow-up` / `not-qualified` tetap lewat PATCH / unqualify S6a.

### Finance

- `POST /finance/sales-orders/:id/confirm-dp`: order harus ber-project dan `draft` (422 bila standalone atau bukan
  draft); dalam transaksi yang sama order → `paid`, `paid_on` = tanggal efektif DP.
- `GET /sales-orders/:id/finance-summary`: tambah `orderStatus`.

### Seed

Seed demo memasukkan 13 order fixture (8 Group Trip + 5 standalone) beserta status, destinasi, periode, lead. Seed ulang
tidak menimpa `status`, `status_reason`, `paid_on`. Customer order standalone memakai party fixture yang sudah diseed.

## Frontend

- Tipe `SalesOrderDto`, `ProjectSeatsDto`, `GroupTripQualifyDto`; endpoint di namespace `sales`.
- `data/sales-orders-sync.ts`: muat `SALES_ORDERS` dari server (merge di tempat), dipanggil `loadServerData` dan reset
  `settings.vue`; kursi project dari server untuk dropdown Group Trip dan tab Bookings.
- Dialihkan: `/sales-orders/[id]` (ubah status), dialog qualify B2C & Group Trip di `LeadDetailSheet` (pemanggilan
  `qualifyLeadAndCreateSalesOrder` / `qualifyGroupTripLead` lokal diganti endpoint server), tab Bookings + dialog DP
  project order (setelah `confirm-dp` order dimuat ulang; `markGroupTripOrderPaid` lokal tinggal membuat traveler).
  Halaman/komponen yang membuat order standalone memakai `POST /sales-orders`.
- Guard `no-local-sales` ditambah `createSalesOrder(`, `updateSalesOrderStatus(`, `qualifyLeadAndCreateSalesOrder(`,
  `qualifyGroupTripLead(`.

## Testing

- Backend (`test/sales-orders.test.ts`): buat standalone (customer baru/ada, idempotensi, validasi, 401/403); status
  urut + batal butuh alasan; Group Trip ke paid ditolak; batal dengan invoice tetap boleh; kursi (held/filled,
  oversell 422, batal membebaskan); qualify B2C membuat order; group-trip qualified vs waitlist; confirm-dp membuat
  order paid dan menolak standalone; seed ulang tidak menimpa status.
- Frontend: tes `sales-orders-sync` (merge, status, group-trip outcome), guard, `pnpm test`, tsc/eslint vs HEAD,
  `pnpm build`.

## Deploy

Migrasi `0025` otomatis. Setelah push: `bun run db:seed:demo` sekali (order standalone & status order). Seed menolak
DB yang berisi data non-demo — cek staging dulu.
