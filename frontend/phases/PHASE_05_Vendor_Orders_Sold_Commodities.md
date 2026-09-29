Lanjutkan ke Phase 5 — Vendor Orders dan Sold Commodities.

Kerjakan:
- Vendor Orders list.
- Order detail.
- Search dan filter.
- Status timeline.
- Sold Commodities summary.
- Sinkronisasi selection, hold, confirmed order, dan booked order.

Pastikan:
- Vendor hanya melihat order commodity miliknya.
- Soft Hold belum dihitung sebagai sold.
- Confirmed, Booked, In Service, dan Completed dihitung sebagai sold.
- Expired, Cancelled, dan Rejected tidak dihitung sebagai sold.
- Confirmation memindahkan held quantity menjadi booked quantity.
- Vendor order menggunakan snapshot commodity dan harga.
- Client melihat status yang sama secara konsisten.

Tambahkan integration-style test untuk:
Vendor publish → Client select → Hold → Confirmed → Vendor sold.

Jalankan seluruh validasi yang relevan.

Berhenti setelah memberikan laporan Phase 5.