<script setup lang="ts">
import { computed, ref } from 'vue'
import { Wallet, TrendingDown, CheckCircle2, Clock, Plus } from 'lucide-vue-next'
import {
  OPEX_CATEGORIES,
  OPEX_STATUSES,
  getOpexEntries,
  getOpexPeriods,
  createOpexEntry,
  updateOpexStatus
} from '~/data/finance-ext'
import { getProjectById, getUserById, PROJECTS } from '~/data'
import { findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { OpexCategoryKey, OpexEntry } from '~/types/finance-ext'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Opex — Finance & ACC' })

const { canView, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Opex (revisi.md #2 — "tambah opex yang terpisah dengan invoice"). Berdiri sendiri sebagai biaya
 * operasional perusahaan per PERIODE, bukan biaya yang dibebankan ke project — itulah yang membedakannya
 * dari `SupplierInvoice` (biaya langsung project) dan `Invoice` (tagihan ke klien).
 */
const hasAccess = computed(() => canView('finance-acc'))
const canManage = computed(() => can('finance.manage-opex'))

const refreshKey = ref(0)
const periods = computed(() => {
  void refreshKey.value
  return getOpexPeriods()
})
/** Default ke periode terbaru supaya dropdown tidak tampil kosong saat halaman pertama dibuka. */
const selectedPeriod = ref<string>(getOpexPeriods()[0] ?? '')
const activePeriod = computed(() => selectedPeriod.value || periods.value[0])

/** Filter "per project" (revisi.md) — 'all' = seluruh entri, 'none' = biaya perusahaan tanpa project, atau ID project tertentu. */
const projectFilter = ref<'all' | 'none' | string>('all')

const entries = computed(() => {
  void refreshKey.value
  let result = getOpexEntries(activePeriod.value)
  if (projectFilter.value === 'none') {
    result = result.filter(entry => !entry.projectId)
  } else if (projectFilter.value !== 'all') {
    result = result.filter(entry => entry.projectId === projectFilter.value)
  }
  return result
})

const byCategory = computed(() => {
  const relevant = entries.value.filter(entry => entry.status !== 'rejected' && entry.status !== 'draft')
  return OPEX_CATEGORIES
    .map(category => ({
      category,
      amountIdr: relevant.filter(entry => entry.category === category.value).reduce((sum, entry) => sum + entry.amountIdr, 0)
    }))
    .filter(row => row.amountIdr > 0)
    .sort((a, b) => b.amountIdr - a.amountIdr)
})

const stats = computed(() => {
  const all = entries.value
  return {
    total: all.filter(entry => entry.status === 'approved' || entry.status === 'paid').reduce((sum, entry) => sum + entry.amountIdr, 0),
    paid: all.filter(entry => entry.status === 'paid').reduce((sum, entry) => sum + entry.amountIdr, 0),
    pending: all.filter(entry => entry.status === 'submitted' || entry.status === 'draft').reduce((sum, entry) => sum + entry.amountIdr, 0),
    count: all.length
  }
})

const maxCategoryAmount = computed(() => Math.max(1, ...byCategory.value.map(row => row.amountIdr)))

/* Form tambah opex */
const isCreateOpen = ref(false)
const form = ref({
  period: '',
  category: 'office' as OpexCategoryKey,
  description: '',
  amountIdr: null as number | null,
  incurredAt: DEMO_REFERENCE_DATE,
  vendorName: '',
  projectId: ''
})

function openCreate () {
  form.value = {
    period: activePeriod.value ?? DEMO_REFERENCE_DATE.slice(0, 7),
    category: 'office',
    description: '',
    amountIdr: null,
    incurredAt: DEMO_REFERENCE_DATE,
    vendorName: '',
    projectId: projectFilter.value !== 'all' && projectFilter.value !== 'none' ? projectFilter.value : ''
  }
  isCreateOpen.value = true
}

const isFormValid = computed(() => Boolean(form.value.description.trim() && form.value.amountIdr && form.value.amountIdr > 0))

function submitCreate () {
  if (!isFormValid.value) { return }
  createOpexEntry({
    period: form.value.period,
    category: form.value.category,
    description: form.value.description.trim(),
    amountIdr: Number(form.value.amountIdr),
    incurredAt: form.value.incurredAt,
    vendorName: form.value.vendorName.trim() || undefined,
    projectId: form.value.projectId || undefined,
    submittedBy: currentUser.value.id
  })
  refreshKey.value += 1
  isCreateOpen.value = false
  showToast('Opex ditambahkan', 'Entri masuk sebagai "Diajukan" dan menunggu persetujuan.', 'success')
}

function setStatus (entry: OpexEntry, status: OpexEntry['status']) {
  updateOpexStatus(entry.id, status, currentUser.value.id)
  refreshKey.value += 1
  showToast('Status diperbarui', `"${entry.description}" kini ${findStatusOption(OPEX_STATUSES, status).label}.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Opex"
      description="Biaya operasional perusahaan per periode — terpisah dari invoice klien maupun biaya langsung project."
      :breadcrumb="[{ label: 'Finance & ACC', to: '/finance' }, { label: 'Opex' }]"
    >
      <template #actions>
        <Button v-if="canManage" size="sm" @click="openCreate">
          <Plus class="h-4 w-4 mr-1.5" />
          Tambah Opex
        </Button>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!hasAccess" module-label="modul Finance & ACC" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <select v-model="selectedPeriod" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option v-for="period in periods" :key="period" :value="period">
            Periode {{ period }}
          </option>
        </select>
        <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Project
          </option>
          <option value="none">
            Biaya Perusahaan (Tanpa Project)
          </option>
          <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Opex Periode" :value="formatCurrencyIdr(stats.total)" :icon="TrendingDown" icon-color="destructive" />
        <StatsCard title="Sudah Dibayar" :value="formatCurrencyIdr(stats.paid)" :icon="CheckCircle2" icon-color="success" />
        <StatsCard title="Menunggu Persetujuan" :value="formatCurrencyIdr(stats.pending)" :icon="Clock" icon-color="warning" />
        <StatsCard title="Jumlah Entri" :value="String(stats.count)" :icon="Wallet" />
      </div>

      <SectionCard title="Komposisi per Kategori">
        <ul class="space-y-2.5">
          <li v-for="row in byCategory" :key="row.category.value" class="flex items-center gap-3">
            <span class="w-44 shrink-0 text-sm text-foreground truncate">{{ row.category.label }}</span>
            <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <span class="block h-full rounded-full bg-primary" :style="{ width: `${(row.amountIdr / maxCategoryAmount) * 100}%` }" />
            </span>
            <span class="w-40 shrink-0 text-right text-sm font-medium text-foreground">{{ formatCurrencyIdr(row.amountIdr) }}</span>
          </li>
        </ul>
        <EmptyState v-if="!byCategory.length" title="Belum ada opex disetujui pada periode ini" />
      </SectionCard>

      <SectionCard title="Daftar Opex">
        <Table v-if="entries.length">
          <TableHeader>
            <TableRow>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead class="text-right">
                Jumlah
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead v-if="canManage" class="text-right">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="entry in entries" :key="entry.id">
              <TableCell>
                <p class="text-sm font-medium text-foreground">
                  {{ entry.description }}
                </p>
                <p class="text-xs text-muted-foreground">
                  <template v-if="entry.vendorName">{{ entry.vendorName }} · </template>
                  <template v-if="entry.submittedBy">diajukan {{ getUserById(entry.submittedBy)?.name ?? entry.submittedBy }}</template>
                </p>
                <NuxtLink
                  v-if="entry.projectId"
                  :to="`/project-orders/${entry.projectId}`"
                  class="text-xs text-primary hover:underline"
                >
                  Dialokasikan ke {{ getProjectById(entry.projectId)?.name ?? entry.projectId }}
                </NuxtLink>
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(OPEX_CATEGORIES, entry.category).label"
                  :tone="findStatusOption(OPEX_CATEGORIES, entry.category).tone"
                />
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(entry.incurredAt) }}
              </TableCell>
              <TableCell class="text-right text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(entry.amountIdr) }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(OPEX_STATUSES, entry.status).label"
                  :tone="findStatusOption(OPEX_STATUSES, entry.status).tone"
                />
              </TableCell>
              <TableCell v-if="canManage" class="text-right">
                <div class="flex justify-end gap-1.5">
                  <Button v-if="entry.status === 'submitted' || entry.status === 'draft'" variant="outline" size="sm" @click="setStatus(entry, 'approved')">
                    Setujui
                  </Button>
                  <Button v-if="entry.status === 'approved'" size="sm" @click="setStatus(entry, 'paid')">
                    Tandai Dibayar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState v-else :icon="Wallet" title="Belum ada opex pada periode ini" />
      </SectionCard>

      <Dialog v-model:open="isCreateOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Opex</DialogTitle>
            <DialogDescription>Biaya operasional perusahaan, bukan biaya yang ditagihkan ke klien.</DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>Periode</Label>
                <Input v-model="form.period" placeholder="2026-07" />
              </div>
              <div class="space-y-1.5">
                <Label>Tanggal</Label>
                <Input v-model="form.incurredAt" type="date" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>Kategori</Label>
              <select v-model="form.category" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="category in OPEX_CATEGORIES" :key="category.value" :value="category.value">
                  {{ category.label }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label>Deskripsi</Label>
              <Input v-model="form.description" placeholder="mis. Sewa kantor Agustus" />
            </div>
            <div class="space-y-1.5">
              <Label>Jumlah (IDR)</Label>
              <Input v-model.number="form.amountIdr" type="number" placeholder="0" />
            </div>
            <div class="space-y-1.5">
              <Label>Vendor / Penerima (opsional)</Label>
              <Input v-model="form.vendorName" placeholder="Nama vendor" />
            </div>
            <div class="space-y-1.5">
              <Label>Project (opsional)</Label>
              <select v-model="form.projectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Biaya perusahaan — tidak dialokasikan ke project
                </option>
                <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground">
                Isi hanya bila biaya ini memang khusus untuk satu project tertentu, bukan biaya operasional umum.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="isCreateOpen = false">
              Batal
            </Button>
            <Button :disabled="!isFormValid" @click="submitCreate">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
