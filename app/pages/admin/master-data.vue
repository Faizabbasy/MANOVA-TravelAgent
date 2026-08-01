<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Plus, Pencil, Ban, RotateCcw, Layers, MapPin, Building2, FolderKanban, Plane, BedDouble, Coins, Percent, CalendarClock, ShieldAlert, Hash, FileText, Gauge, Route } from 'lucide-vue-next'
import {
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES,
  createMasterDataRecord, updateMasterDataRecord, deactivateMasterDataRecord, reactivateMasterDataRecord, getMasterDataUsageCount,
} from '~/data'
import type { MasterDataCategoryKey } from '~/types/master-data'

/**
 * Master Data (Section 23 — Administration, Master Data dan Audit, roadmap Section 00–24 baru, D-080).
 * Restrukturisasi dari 4-tab read-only (Section 17 lama) menjadi 3 kelompok (Operational Reference /
 * Commercial & Finance / System Configuration) x sub-tab per kategori (15 total: 4 migrasi + 11 baru),
 * masing-masing dengan CRUD mock penuh (Add/Edit/Deactivate/Reactivate) + peringatan "in-use" saat
 * edit/deactivate. Field per kategori didefinisikan generik di `FIELD_DEFS` — form dan tabel dibangun
 * dinamis dari definisi ini (bukan 15 template terpisah), mengikuti prinsip generik yang sama dengan
 * mutator `createMasterDataRecord` dkk. (`app/data/index.ts`).
 */

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Master Data — Administration' })

const { canView, canManage } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const canEdit = computed(() => canManage('administration'))

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea'
  placeholder?: string
}

interface CategoryDef {
  key: MasterDataCategoryKey
  label: string
  description: string
  list: Array<Record<string, any>>
  fields: FieldDef[]
}

interface GroupDef {
  id: string
  label: string
  icon: any
  categories: CategoryDef[]
}

const GROUPS: GroupDef[] = [
  {
    id: 'operational',
    label: 'Operational Reference',
    icon: Route,
    categories: [
      { key: 'project-type', label: 'Tipe / Karakteristik Project', description: 'Kategori karakteristik project (Normal, High-Change, Complex).', list: MASTER_PROJECT_TYPES, fields: [{ key: 'label', label: 'Label', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'text' }] },
      { key: 'service-type', label: 'Tipe Layanan Operasional', description: 'Jenis layanan yang dikelola per project.', list: MASTER_SERVICE_TYPES, fields: [{ key: 'label', label: 'Label', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'text' }] },
      { key: 'destination', label: 'Destinasi', description: 'Daftar destinasi yang tersedia untuk project.', list: MASTER_DESTINATIONS, fields: [{ key: 'label', label: 'Label', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'text' }] },
      { key: 'vendor-category', label: 'Kategori Vendor', description: 'Jenis layanan yang disediakan vendor.', list: MASTER_VENDOR_CATEGORIES, fields: [{ key: 'label', label: 'Label', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'text' }] },
      { key: 'airport', label: 'Airport', description: 'Referensi bandara. TIDAK ditautkan sebagai foreign key ke FlightBooking (LOCKED) — murni referensi admin.', list: AIRPORTS, fields: [{ key: 'iataCode', label: 'Kode IATA', type: 'text', placeholder: 'mis. CGK' }, { key: 'name', label: 'Nama Airport', type: 'text' }, { key: 'city', label: 'Kota', type: 'text' }] },
      { key: 'airline', label: 'Airline', description: 'Referensi maskapai. TIDAK ditautkan sebagai foreign key ke FlightBooking (LOCKED) — murni referensi admin.', list: AIRLINES, fields: [{ key: 'iataCode', label: 'Kode IATA', type: 'text', placeholder: 'mis. GA' }, { key: 'name', label: 'Nama Airline', type: 'text' }] },
      { key: 'hotel', label: 'Hotel', description: 'Referensi hotel. TIDAK ditautkan sebagai foreign key ke HotelBooking (LOCKED) — murni referensi admin.', list: MASTER_HOTELS, fields: [{ key: 'name', label: 'Nama Hotel', type: 'text' }, { key: 'city', label: 'Kota', type: 'text' }, { key: 'starRating', label: 'Star Rating', type: 'number' }] },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial & Finance',
    icon: Coins,
    categories: [
      { key: 'currency', label: 'Currencies', description: 'Berelasi konseptual dengan Invoice.currency (Section 20) — tidak memutasi type Invoice.', list: MASTER_CURRENCIES, fields: [{ key: 'code', label: 'Kode', type: 'text', placeholder: 'mis. USD' }, { key: 'name', label: 'Nama', type: 'text' }, { key: 'symbol', label: 'Simbol', type: 'text' }] },
      { key: 'tax-rule', label: 'Tax Rules', description: 'Aturan pajak referensi.', list: TAX_RULES, fields: [{ key: 'name', label: 'Nama', type: 'text' }, { key: 'ratePercent', label: 'Rate (%)', type: 'number' }, { key: 'appliesTo', label: 'Berlaku Untuk', type: 'text' }] },
      { key: 'payment-term', label: 'Payment Terms', description: 'Termin pembayaran referensi.', list: PAYMENT_TERMS, fields: [{ key: 'label', label: 'Label', type: 'text' }, { key: 'daysDue', label: 'Jatuh Tempo (hari)', type: 'number' }] },
      { key: 'cancellation-rule', label: 'Cancellation Rules', description: 'Konfigurasi/referensi SAJA — TIDAK menyentuh transition guard CancellationRecord (LOCKED, Section 13-19).', list: CANCELLATION_RULES, fields: [{ key: 'name', label: 'Nama', type: 'text' }, { key: 'daysBeforeDeparture', label: 'Hari Sebelum Keberangkatan', type: 'number' }, { key: 'penaltyPercent', label: 'Penalty (%)', type: 'number' }, { key: 'appliesToBookingType', label: 'Berlaku Untuk Tipe Booking', type: 'text', placeholder: 'mis. flight' }] },
    ],
  },
  {
    id: 'system',
    label: 'System Configuration',
    icon: Gauge,
    categories: [
      { key: 'numbering-scheme', label: 'Numbering Scheme', description: 'Preview/konfigurasi SAJA — bukan counter nyata yang dipakai ID generation (LOCKED).', list: NUMBERING_SCHEMES, fields: [{ key: 'entityType', label: 'Entity Type', type: 'text' }, { key: 'prefix', label: 'Prefix', type: 'text' }, { key: 'nextNumberPreview', label: 'Preview Nomor Berikutnya', type: 'text' }] },
      { key: 'document-template', label: 'Document Template', description: 'Referensi longgar ke Document.category (Section 21) — tidak memutasi type Document.', list: DOCUMENT_TEMPLATES, fields: [{ key: 'name', label: 'Nama Template', type: 'text' }, { key: 'category', label: 'Kategori', type: 'text' }, { key: 'appliesToDocumentCategory', label: 'Berlaku Untuk Kategori Dokumen', type: 'text' }, { key: 'bodyPreview', label: 'Preview Isi', type: 'textarea' }] },
      { key: 'readiness-gate', label: 'Readiness Gate', description: 'Konfigurasi display SAJA — TIDAK me-rewire derivasi departure-readiness (LOCKED, Section 12).', list: READINESS_GATE_CONFIGS, fields: [{ key: 'name', label: 'Nama Gate', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'textarea' }, { key: 'appliesToModule', label: 'Berlaku Untuk Modul', type: 'text' }] },
      { key: 'assignment-rule', label: 'Assignment Rule', description: 'Konfigurasi display SAJA — TIDAK me-rewire mutator lead-routing (LOCKED, Section 04).', list: ASSIGNMENT_RULES, fields: [{ key: 'name', label: 'Nama Rule', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'textarea' }, { key: 'triggerCondition', label: 'Trigger Condition', type: 'text' }, { key: 'targetRole', label: 'Target Role', type: 'text' }] },
    ],
  },
]

const CATEGORY_ICONS: Record<MasterDataCategoryKey, any> = {
  'project-type': FolderKanban, 'service-type': Layers, destination: MapPin, 'vendor-category': Building2,
  airport: Plane, airline: Plane, hotel: BedDouble,
  currency: Coins, 'tax-rule': Percent, 'payment-term': CalendarClock, 'cancellation-rule': ShieldAlert,
  'numbering-scheme': Hash, 'document-template': FileText, 'readiness-gate': Gauge, 'assignment-rule': Route,
}

const activeGroupId = ref(GROUPS[0].id)
const activeGroup = computed(() => GROUPS.find(g => g.id === activeGroupId.value) ?? GROUPS[0])

const activeCategoryKey = ref<MasterDataCategoryKey>(GROUPS[0].categories[0].key)
const activeCategory = computed(() => activeGroup.value.categories.find(c => c.key === activeCategoryKey.value) ?? activeGroup.value.categories[0])

// Ganti group -> reset ke kategori pertama group tsb (agar tidak "nyangkut" ke key yang tidak ada di group baru)
watch(activeGroupId, () => { activeCategoryKey.value = activeGroup.value.categories[0].key })

const activeFilter = ref<'all' | 'active' | 'inactive'>('all')
const displayedItems = computed(() => {
  const items = activeCategory.value.list
  if (activeFilter.value === 'active') return items.filter(i => i.isActive)
  if (activeFilter.value === 'inactive') return items.filter(i => !i.isActive)
  return items
})

function totalActive(items: Array<Record<string, any>>) {
  return items.filter(i => i.isActive).length
}

function itemDisplayName(item: Record<string, any>): string {
  return String(item.label ?? item.name ?? item.code ?? item.id)
}

/* ---------- Create / Edit form (generik, field dari CategoryDef.fields) ---------- */
const isFormOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const formValues = reactive<Record<string, any>>({})

function openCreate() {
  formMode.value = 'create'
  editingId.value = null
  for (const key in formValues) delete formValues[key]
  for (const field of activeCategory.value.fields) formValues[field.key] = field.type === 'number' ? null : ''
  isFormOpen.value = true
}

function openEdit(item: Record<string, any>) {
  formMode.value = 'edit'
  editingId.value = item.id
  for (const key in formValues) delete formValues[key]
  for (const field of activeCategory.value.fields) formValues[field.key] = item[field.key] ?? (field.type === 'number' ? null : '')
  isFormOpen.value = true
}

const isFormValid = computed(() => activeCategory.value.fields.every((field) => {
  const value = formValues[field.key]
  return field.type === 'number' ? value !== null && value !== '' : String(value ?? '').trim().length > 0
}))

/* ---------- Usage warning dialog (edit/deactivate) — "historical snapshot warning ketika master berubah" ---------- */
const isUsageDialogOpen = ref(false)
const usageCount = ref<number | null>(0)
const pendingConfirmLabel = ref('')
let pendingConfirmAction: (() => void) | null = null

function confirmOrRun(itemId: string, itemName: string, actionLabel: string, run: () => void) {
  const count = getMasterDataUsageCount(activeCategoryKey.value, itemId)
  if (count === 0) { run(); return }
  usageCount.value = count
  pendingConfirmLabel.value = `${actionLabel} "${itemName}"`
  pendingConfirmAction = run
  isUsageDialogOpen.value = true
}

function confirmPendingAction() {
  pendingConfirmAction?.()
  isUsageDialogOpen.value = false
  pendingConfirmAction = null
}

function cancelPendingAction() {
  isUsageDialogOpen.value = false
  pendingConfirmAction = null
}

/* ---------- Submit create/edit ---------- */
function submitForm() {
  if (!isFormValid.value) {
    showToast('Gagal Menyimpan', 'Seluruh field wajib diisi.', 'error')
    return
  }
  const payload: Record<string, any> = {}
  for (const field of activeCategory.value.fields) {
    payload[field.key] = field.type === 'number' ? formValues[field.key] : String(formValues[field.key]).trim()
  }

  if (formMode.value === 'create') {
    createMasterDataRecord(activeCategoryKey.value, payload, currentUser.value.id)
    isFormOpen.value = false
    showToast('Data Ditambahkan', `${activeCategory.value.label} baru tercatat.`, 'success')
    return
  }

  const id = editingId.value!
  const name = itemDisplayName(activeCategory.value.list.find(i => i.id === id) ?? { id })
  confirmOrRun(id, name, 'Simpan perubahan', () => {
    updateMasterDataRecord(activeCategoryKey.value, id, payload, currentUser.value.id)
    isFormOpen.value = false
    showToast('Perubahan Disimpan', `${activeCategory.value.label} "${name}" diperbarui.`, 'success')
  })
}

/* ---------- Deactivate / Reactivate ---------- */
function requestDeactivate(item: Record<string, any>) {
  const name = itemDisplayName(item)
  confirmOrRun(item.id, name, 'Nonaktifkan', () => {
    deactivateMasterDataRecord(activeCategoryKey.value, item.id, currentUser.value.id)
    showToast('Data Dinonaktifkan', `${activeCategory.value.label} "${name}" dinonaktifkan. Record historis tidak terpengaruh.`, 'success')
  })
}

function reactivateItem(item: Record<string, any>) {
  const name = itemDisplayName(item)
  reactivateMasterDataRecord(activeCategoryKey.value, item.id, currentUser.value.id)
  showToast('Data Diaktifkan Kembali', `${activeCategory.value.label} "${name}" aktif kembali.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Master Data"
      description="Kelola konfigurasi referensi lintas modul. Perubahan tercatat di Audit Trail; record historis yang sudah memakai nilai lama tidak terpengaruh."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Master Data' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <!-- Group tabs -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="group in GROUPS"
          :key="group.id"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors"
          :class="group.id === activeGroupId ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border hover:bg-muted text-foreground'"
          @click="activeGroupId = group.id"
        >
          <component :is="group.icon" class="h-4 w-4" />
          {{ group.label }}
        </button>
      </div>

      <!-- Category sub-tabs (chips) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          v-for="category in activeGroup.categories"
          :key="category.key"
          class="flex flex-col items-start gap-1 p-3 rounded-xl border transition-colors text-left"
          :class="category.key === activeCategoryKey ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted'"
          @click="activeCategoryKey = category.key"
        >
          <component :is="CATEGORY_ICONS[category.key]" class="h-5 w-5 text-muted-foreground mb-0.5" />
          <span class="text-sm font-medium text-foreground leading-tight">{{ category.label }}</span>
          <span class="text-xs text-muted-foreground">{{ totalActive(category.list) }} aktif / {{ category.list.length }} total</span>
        </button>
      </div>

      <!-- Active category detail -->
      <SectionCard :title="activeCategory.label" :description="activeCategory.description">
        <template #actions>
          <div class="flex items-center gap-2">
            <select
              v-model="activeFilter"
              class="appearance-none px-3 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="all">Semua</option>
              <option value="active">Aktif saja</option>
              <option value="inactive">Non-aktif saja</option>
            </select>
            <Button v-if="canEdit" size="sm" @click="openCreate">
              <Plus class="h-4 w-4 mr-1.5" />Tambah
            </Button>
          </div>
        </template>

        <EmptyState
          v-if="displayedItems.length === 0"
          title="Tidak ada item"
          description="Tidak ada item yang cocok dengan filter saat ini."
        />

        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead v-for="field in activeCategory.fields" :key="field.key">{{ field.label }}</TableHead>
                <TableHead class="text-center">Status</TableHead>
                <TableHead v-if="canEdit" class="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in displayedItems" :key="item.id">
                <TableCell class="font-mono text-xs text-muted-foreground">{{ item.id }}</TableCell>
                <TableCell v-for="field in activeCategory.fields" :key="field.key" class="text-sm text-foreground max-w-[240px]">
                  <span v-if="field.type === 'textarea'" class="line-clamp-2 text-muted-foreground">{{ item[field.key] || '—' }}</span>
                  <span v-else>{{ item[field.key] ?? '—' }}</span>
                </TableCell>
                <TableCell class="text-center">
                  <StatusBadge :label="item.isActive ? 'Aktif' : 'Non-aktif'" :tone="item.isActive ? 'success' : 'neutral'" />
                </TableCell>
                <TableCell v-if="canEdit" class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit" @click="openEdit(item)">
                      <Pencil class="h-3.5 w-3.5" />
                    </button>
                    <button
                      v-if="item.isActive"
                      class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive"
                      title="Nonaktifkan"
                      @click="requestDeactivate(item)"
                    >
                      <Ban class="h-3.5 w-3.5" />
                    </button>
                    <button
                      v-else
                      class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-success"
                      title="Aktifkan Kembali"
                      @click="reactivateItem(item)"
                    >
                      <RotateCcw class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <!-- Create/Edit dialog (generik, field dari CategoryDef) -->
      <Dialog v-model:open="isFormOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ formMode === 'create' ? 'Tambah' : 'Edit' }} {{ activeCategory.label }}</DialogTitle>
            <DialogDescription>Mock CRUD — perubahan tersimpan di state aplikasi dan tercatat di Audit Trail.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div v-for="field in activeCategory.fields" :key="field.key" class="space-y-1.5">
              <Label :for="`md-field-${field.key}`">{{ field.label }}</Label>
              <textarea
                v-if="field.type === 'textarea'"
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                rows="3"
                class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                :placeholder="field.placeholder"
              />
              <Input
                v-else
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                :type="field.type === 'number' ? 'number' : 'text'"
                :placeholder="field.placeholder"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isFormOpen = false">Batal</Button>
            <Button :disabled="!isFormValid" @click="submitForm">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Usage warning confirm dialog -->
      <Dialog v-model:open="isUsageDialogOpen">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konfirmasi Perubahan</DialogTitle>
            <DialogDescription>
              <template v-if="usageCount !== null">
                {{ usageCount }} record existing mereferensikan nilai ini — data historis tidak akan terpengaruh oleh perubahan ini.
              </template>
              <template v-else>
                Data ini mungkin digunakan di tempat lain (tidak ada cek referensi otomatis untuk kategori ini) — data historis tidak akan terpengaruh oleh perubahan ini.
              </template>
            </DialogDescription>
          </DialogHeader>
          <p class="text-sm text-foreground">Lanjutkan: <span class="font-medium">{{ pendingConfirmLabel }}</span>?</p>
          <DialogFooter>
            <Button variant="outline" @click="cancelPendingAction">Batal</Button>
            <Button @click="confirmPendingAction">Lanjutkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
