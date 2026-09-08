# Milestone Template (Master Data + Timeline Tracking)

Status: designed, not yet implemented.

## Kenapa

Tiap Project Order butuh serangkaian milestone standar (SPK/Handover → Finalisasi Itinerary → Invoice DP →
Konfirmasi Vendor → dst.) yang polanya mirip lintas project sejenis. Saat ini setiap milestone harus
ditambahkan satu-satu lewat dialog "Tambah Milestone" (`ProjectOrderTimelineTracking.vue`) — tidak ada cara
menerapkan sekumpulan milestone standar sekaligus. Fitur ini menambahkan **Milestone Template**: daftar
milestone standar (nama + offset hari dari satu tanggal acuan) yang dikonfigurasi PM/Super Admin di
Setting > Master Data, lalu bisa "diterapkan" ke Timeline Tracking sebuah project dalam satu aksi.

## Keputusan desain (dikonfirmasi user)

1. Tiap item template punya **offset hari** dari satu Tanggal Acuan yang dipilih user saat apply (bukan
   cuma nama+urutan tanpa timing) — `plannedDate` milestone hasil apply = Tanggal Acuan + offset hari.
2. Menerapkan template ke project yang **sudah punya milestone** akan **mengganti seluruhnya** (replace,
   bukan append) — seluruh `ProjectMilestone` project itu dihapus dulu, baru diisi ulang dari item
   template. Ini destruktif (termasuk milestone yang sudah "Selesai", ada catatan/budget/deliverables) —
   dialog apply WAJIB menampilkan peringatan tegas sebelum eksekusi.

## Data model

**`app/types/master-data.ts`** — `MilestoneTemplate` MEMPERLUAS `MasterDataItem` (id/label/description/
isActive — sama seperti seluruh kategori Master Data lain) ditambah `items`. Nama tiap item pakai `label`
(bukan `name`), konsisten dengan `MilestoneDeliverable.label` (`app/types/project-order.ts:59-63`) yang
sudah dipakai untuk pola "daftar sub-item bernama" yang sama persis:

```ts
export interface MilestoneTemplateItem {
  id: ID
  label: string
  offsetDays: number   // 0 = tanggal acuan, 3 = acuan + 3 hari, boleh negatif (sebelum acuan)
}

export interface MilestoneTemplate extends MasterDataItem {
  items: MilestoneTemplateItem[]
}
```

`MasterDataCategoryKey` (`app/types/master-data.ts:148`) — tambah union member `'milestone-template'`.

**`app/data/master-data.ts`** — tambah `export const MILESTONE_TEMPLATES: MilestoneTemplate[] = reactive([...])`
dengan 1-2 contoh seed (mis. "Standard Corporate Trip": SPK/Handover H+0, Finalisasi Itinerary H+3, Invoice
DP H+5, Konfirmasi Vendor H+10, Dokumen Traveler Lengkap H+20, Keberangkatan H+30, Trip Selesai H+34,
Closing Report H+40 — meniru pola 8 milestone yang sudah terlihat di seed data project existing).

## Reuse infra CRUD generik (TIDAK perlu mutator baru)

`createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord`
(`app/data/index.ts:5102-5135`) sudah sepenuhnya generik: `MasterDataRecordShape = { id, isActive } & Record<string, unknown>`,
jadi field `items: MilestoneTemplateItem[]` lolos tanpa perubahan apa pun ke fungsi-fungsi ini. Cukup:
- Tambah entri baru di `MASTER_DATA_REGISTRY` (`app/data/index.ts:5076`): `'milestone-template': { list: MILESTONE_TEMPLATES as unknown as MasterDataRecordShape[], prefix: 'MTPL-', label: 'Milestone Template' }`.
- Import `MILESTONE_TEMPLATES` dari `master-data.ts`, re-export dari `app/data/index.ts` seperti kategori lain.

`getMasterDataUsageCount` (`app/data/index.ts:5151`) — kategori ini TIDAK dapat genuine usage-count cross-reference
sederhana (template dipakai lewat aksi "apply", bukan foreign key tersimpan di `ProjectMilestone`). Ikuti
pola existing "be honest": return `null` untuk key ini (tampil "Tidak diketahui" di UI, bukan angka
fabrikasi) — sama seperti kategori lain yang belum py cross-reference.

## Fungsi baru: apply template ke project

**`app/data/project-order-workflow.ts`** — fungsi baru:

```ts
export function applyMilestoneTemplate (projectId: string, templateId: string, baseDate: string): ProjectMilestone[] {
  const template = MILESTONE_TEMPLATES.find(t => t.id === templateId)
  if (!template) { return [] }

  // Replace — hapus seluruh milestone project ini lebih dulu (keputusan user: "ganti semua").
  const remaining = PROJECT_MILESTONES.filter(m => m.projectId !== projectId)
  PROJECT_MILESTONES.length = 0
  PROJECT_MILESTONES.push(...remaining)

  const created = template.items.map(item => createProjectMilestone({
    projectId,
    name: item.label,
    plannedDate: formatISO(addDays(parseISO(baseDate), item.offsetDays), { representation: 'date' })
  }))
  return created
}
```

(`addDays`/`parseISO`/`formatISO` sudah diimpor di `app/data/index.ts` dari `date-fns` untuk pola serupa —
`project-order-workflow.ts` perlu import yang sama.)

## UI — Master Data (`app/pages/admin/master-data.vue`)

Kategori "Milestone Template" masuk grup **Operational Reference**, tapi TIDAK memakai generic `FieldDef`
renderer (field-nya bukan flat text/number) — dialog Tambah/Edit-nya bikin markup khusus untuk kategori
ini (percabangan `v-if="activeCategory.key === 'milestone-template'"` di dialog yang sudah ada), berisi:
- `CategoryDef.fields` kategori ini HANYA `[{ key: 'label', label: 'Nama', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'textarea' }]` — supaya tabel daftar + kolom "Nama"/"Deskripsi" tetap dirender generik apa adanya oleh markup existing (tidak perlu sentuh table rendering sama sekali). Field `items` SENGAJA tidak dimasukkan ke `fields` (bukan flat text/number, tidak lolos loop generik `formValues`/`payload` di `submitForm`).
- Dialog Tambah/Edit menambah blok item-editor TERPISAH dari loop `v-for="field in activeCategory.fields"` yang sudah ada — muncul cuma saat `activeCategoryKey === 'milestone-template'`, backed oleh `ref` lokal baru `formItems: Array<{ id: string; label: string; offsetDays: number }>` (bukan bagian dari `formValues` generik). Baris item (Nama Milestone + Offset Hari, angka boleh negatif) dengan tombol tambah/hapus baris — pola sama seperti editor "Deliverables" yang sudah ada di `ProjectOrderTimelineTracking.vue` Sheet "Kelola Milestone" (list + input baru + tombol Tambah + tombol hapus per baris).
- `openCreate`/`openEdit` di-extend: reset/isi `formItems` juga (di luar loop `fields` yang sudah ada). `submitForm` di-extend: kalau `activeCategoryKey.value === 'milestone-template'`, tambahkan `payload.items = formItems.value` sebelum memanggil `createMasterDataRecord`/`updateMasterDataRecord`.

## UI — Timeline Tracking (`app/components/project-order/ProjectOrderTimelineTracking.vue`)

- Tombol baru **"Terapkan Template"** (varian outline, ikon `LayoutTemplate` atau serupa) di `#actions`,
  di sebelah kiri tombol "Tambah Milestone" yang sudah ada — hanya tampil bila `canManage`.
- Dialog "Terapkan Template": dropdown pilih Template (hanya `isActive`), date input "Tanggal Acuan",
  lalu blok peringatan destruktif (mis. `rounded-lg border border-destructive/30 bg-destructive/5`, ikon
  `AlertTriangle`) berbunyi: "Seluruh milestone project ini akan DIHAPUS dan digantikan oleh N milestone
  dari template ini. Aksi ini tidak dapat dibatalkan." N dihitung reaktif dari jumlah item template
  terpilih.
- Emit baru `apply-template: [payload: { templateId: string; baseDate: string }]`.
- Perlu import `MILESTONE_TEMPLATES` (untuk populate dropdown) — via `getMasterDataCategoryMeta('milestone-template')`
  atau import langsung array-nya dari `~/data`, konsisten dengan cara komponen ini sudah import `USERS`.

**`app/pages/project-orders/[id]/index.vue`** — handler baru:

```ts
function onApplyMilestoneTemplate (payload: { templateId: string; baseDate: string }) {
  if (!project.value) { return }
  const created = applyMilestoneTemplate(project.value.id, payload.templateId, payload.baseDate)
  refreshStep()
  showToast('Template Diterapkan', `${created.length} milestone dibuat dari template.`, 'success')
}
```
Wire `@apply-template="onApplyMilestoneTemplate"` di pemanggilan `<ProjectOrderTimelineTracking>` yang
sudah ada, dan tambah `applyMilestoneTemplate` ke import dari `~/data/project-order-workflow`.

## Testing

- `app/data/project-order-workflow.test.ts` (file existing) — tambah test untuk `applyMilestoneTemplate`:
  template dengan N item + baseDate tertentu → menghasilkan N `ProjectMilestone` baru dengan `plannedDate`
  yang benar (offset dihitung dari `baseDate`), dan milestone project itu yang lama sudah tidak ada lagi
  di `PROJECT_MILESTONES` (tapi milestone milik project LAIN tidak ikut terhapus).
- `npx vue-tsc --noEmit` bersih setelah setiap perubahan (standar sesi ini).

## Scope eksplisit — TIDAK termasuk

- Tidak ada "undo" untuk apply template (destruktif, sesuai keputusan user).
- Tidak ada validasi/pencegahan menerapkan template ke project yang sudah "Done"/closed — dianggap sama
  seperti aksi manage lain di halaman ini, digerbang oleh `canManage` yang sama (PM/Super Admin), bukan
  gate baru.
- Template tidak terikat ke `Project.characteristic`/tipe project tertentu — semua template aktif tampil
  untuk semua project (YAGNI, bisa ditambah nanti kalau memang dibutuhkan).
