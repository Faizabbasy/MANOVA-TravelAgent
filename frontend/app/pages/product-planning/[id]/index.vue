<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2 } from 'lucide-vue-next'
import {
  getProductTemplateById, getCostSheetsByProduct, getCostSheetBreakdown,
  updateProductTemplate, updateProductTemplateStatus, getProductTemplateStatusTransitions
} from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { ServiceTypeKey } from '~/types/project'
import type { ProductServiceAlternative, ProductTemplateStatus } from '~/types/product'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const canManageProduct = computed(() => canManage('product-planning'))

const product = computed(() => getProductTemplateById(String(route.params.id)))
useHead({ title: computed(() => product.value ? product.value.name : 'Product Template Tidak Ditemukan') })

const costSheets = computed(() => (product.value ? getCostSheetsByProduct(product.value.id) : []))

const STATUS_LABELS: Record<ProductTemplateStatus, { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  active: { label: 'Active', tone: 'success' },
  archived: { label: 'Archived', tone: 'warning' }
}

const summaryMetadata = computed(() => {
  if (!product.value) { return [] }
  return [
    { label: 'Destinasi', value: product.value.destination },
    { label: 'Basis Traveler-Based Costing', value: `${product.value.basePaxCount} pax` },
    { label: 'Validity', value: product.value.validityStart && product.value.validityEnd ? `${formatDate(product.value.validityStart)} – ${formatDate(product.value.validityEnd)}` : '—' },
    { label: 'Jumlah Cost Sheet', value: String(costSheets.value.length) },
    { label: 'Dibuat', value: formatDate(product.value.createdAt) }
  ]
})

function transitionLabel (status: ProductTemplateStatus) {
  return STATUS_LABELS[status].label
}

function submitStatusTransition (status: ProductTemplateStatus) {
  if (!product.value) { return }
  updateProductTemplateStatus(product.value.id, status)
}

/* Edit Product Template (base fields + alternatives, whole-array replace — pola sama "Edit Quotation" serviceBreakdown) */
const isEditOpen = ref(false)
const editName = ref('')
const editDestination = ref('')
const editServiceScope = ref<ServiceTypeKey[]>([])
const editBasePaxCount = ref<number | null>(null)
const editItineraryConcept = ref('')
const editInclusions = ref('')
const editExclusions = ref('')
const editAssumptions = ref('')
const editValidityStart = ref('')
const editValidityEnd = ref('')
const editAlternatives = ref<ProductServiceAlternative[]>([])

function toggleEditServiceScope (type: ServiceTypeKey) {
  editServiceScope.value = editServiceScope.value.includes(type)
    ? editServiceScope.value.filter(item => item !== type)
    : [...editServiceScope.value, type]
}

function openEditDialog () {
  if (!product.value) { return }
  editName.value = product.value.name
  editDestination.value = product.value.destination
  editServiceScope.value = [...product.value.serviceScope]
  editBasePaxCount.value = product.value.basePaxCount
  editItineraryConcept.value = product.value.itineraryConcept ?? ''
  editInclusions.value = product.value.inclusions ?? ''
  editExclusions.value = product.value.exclusions ?? ''
  editAssumptions.value = product.value.assumptions ?? ''
  editValidityStart.value = product.value.validityStart ?? ''
  editValidityEnd.value = product.value.validityEnd ?? ''
  editAlternatives.value = product.value.serviceAlternatives.map(alt => ({ ...alt }))
  isEditOpen.value = true
}

function addAlternativeRow () {
  editAlternatives.value.push({ service: 'flight', label: '', costPerPaxIdr: 0, isRecommended: false })
}

function removeAlternativeRow (index: number) {
  editAlternatives.value.splice(index, 1)
}

function submitEdit () {
  if (!product.value || !editName.value.trim() || !editDestination.value.trim() || editServiceScope.value.length === 0 || !editBasePaxCount.value) { return }
  updateProductTemplate(product.value.id, {
    name: editName.value.trim(),
    destination: editDestination.value.trim(),
    serviceScope: editServiceScope.value,
    basePaxCount: editBasePaxCount.value,
    itineraryConcept: editItineraryConcept.value.trim() || undefined,
    inclusions: editInclusions.value.trim() || undefined,
    exclusions: editExclusions.value.trim() || undefined,
    assumptions: editAssumptions.value.trim() || undefined,
    validityStart: editValidityStart.value || undefined,
    validityEnd: editValidityEnd.value || undefined,
    serviceAlternatives: editAlternatives.value.filter(alt => alt.label.trim() && alt.costPerPaxIdr > 0)
  })
  isEditOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!product">
      <PageHeader title="Product Template Tidak Ditemukan" :breadcrumb="[{ label: 'Product Planning', to: '/product-planning' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Product Template tidak ditemukan"
          :description="`Product Template dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/product-planning#templates')">
            Kembali ke Daftar Product Template
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('product-planning')" module-label="modul Product Planning" />

    <template v-else>
      <PageHeader :title="product.name" :breadcrumb="[{ label: 'Product Planning', to: '/product-planning' }, { label: product.name }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="STATUS_LABELS[product.status].label" :tone="STATUS_LABELS[product.status].tone" />
            <template v-if="canManageProduct">
              <Button size="sm" variant="outline" @click="openEditDialog">
                Edit Template
              </Button>
              <Button
                v-for="next in getProductTemplateStatusTransitions(product.status)"
                :key="next"
                size="sm"
                variant="outline"
                @click="submitStatusTransition(next)"
              >
                Tandai {{ transitionLabel(next) }}
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div class="mt-2 flex flex-wrap gap-1">
          <StatusBadge v-for="type in product.serviceScope" :key="type" :label="findStatusOption(SERVICE_TYPES, type).label" :tone="findStatusOption(SERVICE_TYPES, type).tone" />
        </div>
      </SectionCard>

      <SectionCard v-if="product.itineraryConcept" title="Itinerary Concept">
        <p class="text-sm text-foreground whitespace-pre-line">
          {{ product.itineraryConcept }}
        </p>
      </SectionCard>

      <SectionCard title="Service Alternatives" description="Opsi layanan yang dibandingkan sebelum dituangkan ke Cost Sheet.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Layanan</TableHead>
              <TableHead>Opsi</TableHead>
              <TableHead>Biaya / Pax</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead>Rekomendasi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(alt, index) in product.serviceAlternatives" :key="index">
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, alt.service).label" :tone="findStatusOption(SERVICE_TYPES, alt.service).tone" /></TableCell>
              <TableCell class="font-medium text-foreground">
                {{ alt.label }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(alt.costPerPaxIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ alt.notes ?? '—' }}
              </TableCell>
              <TableCell>
                <StatusBadge v-if="alt.isRecommended" label="Direkomendasikan" tone="success" />
                <span v-else class="text-muted-foreground text-sm">—</span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="product.serviceAlternatives.length === 0" :colspan="5">
              Belum ada alternatif layanan tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard v-if="product.inclusions || product.exclusions || product.assumptions" title="Inclusions, Exclusions dan Assumptions">
        <div class="grid gap-3 sm:grid-cols-3">
          <div v-if="product.inclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Inclusions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ product.inclusions }}
            </p>
          </div>
          <div v-if="product.exclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Exclusions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ product.exclusions }}
            </p>
          </div>
          <div v-if="product.assumptions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Assumptions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ product.assumptions }}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cost Sheet Terkait">
        <template v-if="canManageProduct" #actions>
          <NuxtLink :to="`/product-planning?productId=${product.id}&create=1#cost-sheets`">
            <Button size="sm" variant="outline">
              <Plus class="h-4 w-4 mr-1.5" />Buat Cost Sheet dari Template Ini
            </Button>
          </NuxtLink>
        </template>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Cost Sheet</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Total Sell</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="sheet in costSheets" :key="sheet.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/product-planning/cost-sheets/${sheet.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ sheet.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ sheet.leadId ?? '—' }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(getCostSheetBreakdown(sheet).totalSellIdr) }}
              </TableCell>
              <TableCell><StatusBadge :label="sheet.status === 'final' ? 'Final' : 'Draft'" :tone="sheet.status === 'final' ? 'success' : 'neutral'" /></TableCell>
            </TableRow>
            <TableEmpty v-if="costSheets.length === 0" :colspan="4">
              Belum ada Cost Sheet dari template ini.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <Dialog v-model:open="isEditOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product Template</DialogTitle>
            <DialogDescription>Perubahan berlaku langsung untuk seluruh Cost Sheet yang mereferensikan template ini.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-pt-name">Nama</Label>
                <Input id="edit-pt-name" v-model="editName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-pt-destination">Destinasi</Label>
                <Input id="edit-pt-destination" v-model="editDestination" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label>Service Scope</Label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="type in SERVICE_TYPES"
                  :key="type.value"
                  type="button"
                  class="px-3 py-1.5 text-xs rounded-lg border transition-colors"
                  :class="editServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-muted/50'"
                  @click="toggleEditServiceScope(type.value)"
                >
                  {{ type.label }}
                </button>
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="space-y-1.5">
                <Label for="edit-pt-pax">Basis Pax</Label>
                <Input id="edit-pt-pax" v-model.number="editBasePaxCount" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-pt-validity-start">Validity Mulai</Label>
                <Input id="edit-pt-validity-start" v-model="editValidityStart" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-pt-validity-end">Validity Sampai</Label>
                <Input id="edit-pt-validity-end" v-model="editValidityEnd" type="date" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="edit-pt-concept">Itinerary Concept</Label>
              <textarea id="edit-pt-concept" v-model="editItineraryConcept" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <div class="flex items-center justify-between">
                <Label>Service Alternatives</Label>
                <Button size="sm" variant="outline" type="button" @click="addAlternativeRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(alt, index) in editAlternatives" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <select v-model="alt.service" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
                <Input v-model="alt.label" placeholder="Nama opsi" class="col-span-4 h-8 text-xs" />
                <CurrencyInput v-model="alt.costPerPaxIdr" placeholder="Biaya/pax" class="col-span-2 h-8 text-xs" />
                <Input v-model="alt.notes" placeholder="Catatan (opsional)" class="col-span-3 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeAlternativeRow(index)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p v-if="editAlternatives.length === 0" class="text-xs text-muted-foreground">
                Belum ada alternatif — klik "Tambah" untuk menambahkan.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border">
              <div class="space-y-1.5">
                <Label for="edit-pt-inclusions">Inclusions</Label>
                <textarea id="edit-pt-inclusions" v-model="editInclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-pt-exclusions">Exclusions</Label>
                <textarea id="edit-pt-exclusions" v-model="editExclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-pt-assumptions">Assumptions</Label>
                <textarea id="edit-pt-assumptions" v-model="editAssumptions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditOpen = false">
              Batal
            </Button>
            <Button :disabled="!editName.trim() || !editDestination.trim() || editServiceScope.length === 0 || !editBasePaxCount" @click="submitEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
