Lanjutkan ke Phase 1 — Domain dan Mock Data berdasarkan hasil audit terakhir.

Kerjakan hanya:
- Commodity Product
- Commodity Variant
- Availability Slot
- Commodity Requirement
- Commodity Selection
- Commodity Order
- State transition rules
- Shared mock repository/store/service
- Seed data dan edge cases

Jangan membuat atau mengubah halaman UI terlebih dahulu.

Pastikan:
- Commodity Product dan Commodity Requirement tetap menjadi entitas berbeda.
- Client dan Vendor membaca sumber data yang sama.
- Availability tidak dapat negatif.
- Harga confirmed order menggunakan snapshot.
- Permission isolation sudah dipersiapkan.
- Tidak mengubah code role lain yang tidak berkaitan.

Tambahkan test untuk domain logic dan availability.

Jalankan test dan typecheck yang relevan.

Setelah selesai, berikan:
1. File yang diubah.
2. Model data final.
3. Transition rules.
4. Hasil test.
5. Masalah yang masih tersisa.

Berhenti setelah Phase 1.