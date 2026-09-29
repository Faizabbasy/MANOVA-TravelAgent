Lanjutkan ke Phase 2 — Vendor Commodity CRUD.

Kerjakan hanya fitur Vendor/Supplier:
- Vendor Dashboard commodity summary.
- My Commodities.
- Create commodity.
- Commodity detail.
- Edit commodity.
- Delete draft.
- Archive referenced commodity.
- Publish dan unpublish.
- Commodity variants.
- Availability management.
- Search, filter, empty state, validation, toast, dan confirmation dialog.

Gunakan domain/store/service dari Phase 1. Jangan membuat sumber data baru.

Pastikan:
- Vendor hanya melihat dan mengelola commodity miliknya.
- Commodity vendor lain tidak dapat dibuka melalui URL langsung.
- Draft boleh dihapus bila belum direferensikan.
- Commodity yang pernah digunakan hanya boleh di-archive.
- Published commodity masuk ke shared catalog.
- Commodity archived tidak tampil ke Client.
- Perubahan harga tidak mengubah confirmed order.
- Kapasitas tidak dapat dikurangi di bawah booked quantity.

Tambahkan test CRUD dan permission isolation.

Jalankan test, typecheck, lint yang relevan.

Berhenti setelah memberikan laporan Phase 2.