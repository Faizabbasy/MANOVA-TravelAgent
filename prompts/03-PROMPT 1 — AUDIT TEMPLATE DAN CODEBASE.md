Lanjutkan berdasarkan konteks MANOVA yang sudah diberikan.

Pada tahap ini lakukan audit menyeluruh terhadap template dan codebase Nuxt.js yang sudah ada. Jangan melakukan redesign, implementasi modul MANOVA, rename massal, penghapusan file, atau perubahan besar.

Tujuan tahap ini adalah memahami apa yang sudah tersedia dan menentukan bagian mana yang dapat direuse.

==================================================
A. AUDIT PROJECT FOUNDATION
==================================================

Periksa dan dokumentasikan:

- Versi Nuxt.
- Versi Vue.
- TypeScript configuration.
- Package manager.
- Scripts pada `package.json`.
- Runtime configuration.
- Environment variables.
- Module Nuxt yang digunakan.
- UI framework atau component library.
- CSS framework.
- Icon library.
- Chart library.
- Table library.
- Form dan validation library.
- Date library.
- State management.
- Data fetching pattern.
- Authentication pattern.
- Middleware.
- Testing framework.
- Linting dan formatting.
- Build dan deployment configuration.

Jangan menginstal atau menghapus package.

==================================================
B. AUDIT STRUKTUR CODEBASE
==================================================

Periksa struktur berikut bila tersedia:

- `app/`
- `pages/`
- `layouts/`
- `components/`
- `composables/`
- `stores/`
- `middleware/`
- `plugins/`
- `utils/`
- `types/`
- `constants/`
- `data/`
- `server/`
- `assets/`
- `public/`
- `docs/`
- konfigurasi Nuxt dan TypeScript.

Identifikasi:

- Pola struktur yang digunakan.
- Naming convention.
- Import alias.
- Auto-import behavior.
- Reusable components.
- Domain-specific components lama.
- Shared utilities.
- Duplicate components.
- Dead files yang terindikasi, tetapi jangan hapus.
- Mock data existing.
- Hardcoded data di page.
- Route yang sudah tersedia.
- Route yang rusak atau tidak terpakai.
- Layout dan navigation behavior.

==================================================
C. AUDIT UI DAN DESIGN SYSTEM
==================================================

Inventarisasi komponen dan pola UI yang tersedia:

- App shell.
- Sidebar.
- Header.
- Breadcrumb.
- Page title.
- Card.
- Statistic card.
- Table.
- Filter.
- Search.
- Pagination.
- Tabs.
- Badge.
- Avatar.
- Dropdown.
- Modal.
- Drawer.
- Form.
- Date picker.
- File upload.
- Chart.
- Timeline.
- Stepper.
- Kanban.
- Calendar.
- Toast.
- Alert.
- Empty state.
- Loading state.
- Skeleton.
- Error state.
- Confirmation dialog.

Catat:

- Komponen yang langsung dapat direuse.
- Komponen yang dapat diadaptasi.
- Komponen yang sebaiknya tidak digunakan.
- Inconsistency visual.
- Aksesibilitas dasar.
- Responsive behavior.
- Desktop-only assumptions.
- Design token dan theme configuration.
- Warna, typography, spacing, radius, shadow, dan breakpoint.

==================================================
D. AUDIT FITUR TEMPLATE
==================================================

Buat daftar semua halaman dan fitur existing.

Untuk setiap fitur, catat:

- Route.
- Nama halaman.
- Tujuan awal.
- Layout yang digunakan.
- Komponen utama.
- Sumber data.
- Status interaksi.
- Dependensi.
- Apakah reusable untuk MANOVA.
- Potensi mapping ke domain MANOVA.
- Risiko bila diubah atau dihapus.

Kelompokkan ke:

1. Reuse as-is.
2. Reuse with adaptation.
3. Replace content but keep structure.
4. Keep temporarily.
5. Candidate for removal.
6. Unknown and needs validation.

Jangan menghapus candidate apa pun pada tahap ini.

==================================================
E. AUDIT DATA DAN STATE
==================================================

Periksa:

- Lokasi dummy data.
- Struktur interface/type.
- Store.
- Composable.
- API wrapper.
- Hardcoded values.
- Status constants.
- Currency formatting.
- Date formatting.
- ID generation.
- Cross-page consistency.
- Persisted state seperti localStorage.
- Role mock atau current user.
- Permission logic.
- Filter dan query state.

Identifikasi area yang berpotensi menyebabkan dummy data tidak konsisten saat template diadaptasi.

==================================================
F. AUDIT KUALITAS CODEBASE
==================================================

Tanpa refactor besar, identifikasi:

- Type errors.
- Lint errors.
- Build errors.
- Broken imports.
- Broken route.
- Console errors.
- Hydration issue.
- Duplicate key.
- Unsafe `any`.
- Hardcoded secret.
- Sensitive value.
- Dead code.
- Oversized component.
- Tight coupling.
- UI component yang terlalu domain-specific.
- Data yang bercampur dengan presentasi.

Jalankan hanya command aman yang sudah tersedia, seperti:

- install hanya bila dependency memang belum terpasang dan menggunakan lockfile existing;
- lint;
- typecheck;
- test;
- build.

Jangan melakukan auto-fix massal.

==================================================
G. OUTPUT YANG WAJIB
==================================================

Buat atau update:

`docs/template-audit.md`

Isi minimal:

1. Executive summary.
2. Stack dan package audit.
3. Struktur codebase.
4. Route inventory.
5. Layout inventory.
6. Component inventory.
7. Design system inventory.
8. Data dan state audit.
9. Authentication dan role audit.
10. Reuse opportunities.
11. Candidate removal.
12. Technical debt.
13. Risks.
14. Validation results.
15. Recommended next step.

Update juga:

`docs/mockup-progress.md`

Tambahkan progress tahap audit tanpa menghapus histori yang sudah ada.

==================================================
H. BATASAN
==================================================

- Jangan implementasi halaman MANOVA.
- Jangan rename menu.
- Jangan rename route.
- Jangan mengganti dummy data.
- Jangan menghapus fitur.
- Jangan memasang library baru.
- Jangan mengubah design system.
- Jangan refactor besar.
- Jangan menganggap file tidak terpakai hanya berdasarkan nama.
- Jangan mengubah kode hanya agar audit terlihat selesai.

Pada akhir pekerjaan, berikan laporan ringkas dan berhenti. Jangan lanjut ke gap analysis sebelum saya memberikan prompt selanjutnya.