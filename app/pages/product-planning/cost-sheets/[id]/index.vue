<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2 } from 'lucide-vue-next'
import {
  getCostSheetById, getCostSheetBreakdown, getCostSheetsByOpportunity, getProductTemplateById, getOpportunityById,
  updateCostSheet, duplicateCostSheetVersion, applyCostSheetToQuotation
} from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { ServiceTypeKey } from '~/types/project'
import type { CostSheetLineItem } from '~/types/product'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageCostSheet = computed(() => canManage('product-planning'))
const { showToast } = useToast()

const costSheet = computed(() => getCostSheetById(String(route.params.id)))
useHead({ title: computed(() => costSheet.value ? costSheet.value.name : 'Cost Sheet Tidak Ditemukan') })

const breakdown = computed(() => (costSheet.value ? getCostSheetBreakdown(costSheet.value) : undefined))
const product = computed(() => (costSheet.value?.productId ? getProductTemplateById(costSheet.value.productId) : undefined))
const opportunity = computed(() => (costSheet.value?.opportunityId ? getOpportunityById(costSheet.value.opportunityId) : undefined))

/** Scenario/version comparison (Wajib) — Cost Sheet lain yang melekat pada Opportunity yang sama. */
const scenarioSiblings = computed(() => {
  if (!costSheet.value?.opportunityId) { return [] }
  return getCostSheetsByOpportunity(costSheet.value.opportunityId).filter(sheet => sheet.id !== costSheet.value!.id)
})
const compareTargetId = ref('')
const compareTarget = computed(() => scenarioSiblings.value.find(sheet => sheet.id === compareTargetId.value))
const compareBreakdown = computed(() => (compareTarget.value ? getCostSheetBreakdown(compareTarget.value) : undefined))

const isVersionCompareOpen = ref(false)

const summaryMetadata = computed(() => {
  if (!costSheet.value) { return [] }
  return [
    { label: 'Product Template', value: product.value?.name ?? '—' },
    { label: 'Opportunity', value: opportunity.value?.title ?? '—' },
    { label: 'Traveler Count', value: `${costSheet.value.travelerCount} pax` },
    { label: 'Currency', value: costSheet.value.currency },
    { label: 'Versi', value: `v${costSheet.value.version}` },
    { label: 'Dibuat', value: formatDate(costSheet.value.createdAt) }
  ]
})

/* Edit Cost Sheet (guard: hanya draft — locked begitu status 'final', lihat updateCostSheet) */
const isEditOpen = ref(false)
const editName = ref('')
const editTravelerCount = ref<number | null>(null)
const editCurrency = ref('IDR')
const editMarkupPercent = ref<number | null>(null)
const editTaxPercent = ref<number | null>(null)
const editContingencyPercent = ref<number | null>(null)
const editNotes = ref('')
const editInclusions = ref('')
const editExclusions = ref('')
const editAssumptions = ref('')
const editValidityStart = ref('')
const editValidityEnd = ref('')
const editLineItems = ref<CostSheetLineItem[]>([])

function openEditDialog () {
  if (!costSheet.value) { return }
  editName.value = costSheet.value.name
  editTravelerCount.value = costSheet.value.travelerCount
  editCurrency.value = costSheet.value.currency
  editMarkupPercent.value = costSheet.value.markupPercent
  editTaxPercent.value = costSheet.value.taxPercent
  editContingencyPercent.value = costSheet.value.contingencyPercent
  editNotes.value = costSheet.value.notes ?? ''
  editInclusions.value = costSheet.value.inclusions ?? ''
  editExclusions.value = costSheet.value.exclusions ?? ''
  editAssumptions.value = costSheet.value.assumptions ?? ''
  editValidityStart.value = costSheet.value.validityStart ?? ''
  editValidityEnd.value = costSheet.value.validityEnd ?? ''
  editLineItems.value = costSheet.value.lineItems.map(item => ({ ...item }))
  isEditOpen.value = true
}

function addLineItemRow () {
  editLineItems.value.push({ service: 'flight' as ServiceTypeKey, description: '', costPerPaxIdr: 0 })
}

function removeLineItemRow (index: number) {
  editLineItems.value.splice(index, 1)
}

function submitEdit () {
  if (!costSheet.value || !editName.value.trim() || !editTravelerCount.value) { return }
  updateCostSheet(costSheet.value.id, {
    name: editName.value.trim(),
    travelerCount: editTravelerCount.value,
    currency: editCurrency.value.trim() || 'IDR',
    markupPercent: editMarkupPercent.value ?? 0,
    taxPercent: editTaxPercent.value ?? 0,
    contingencyPercent: editContingencyPercent.value ?? 0,
    notes: editNotes.value.trim() || undefined,
    inclusions: editInclusions.value.trim() || undefined,
    exclusions: editExclusions.value.trim() || undefined,
    assumptions: editAssumptions.value.trim() || undefined,
    validityStart: editValidityStart.value || undefined,
    validityEnd: editValidityEnd.value || undefined,
    lineItems: editLineItems.value.filter(item => item.costPerPaxIdr > 0)
  })
  isEditOpen.value = false
}

function submitDuplicate () {
  if (!costSheet.value) { return }
  const duplicated = duplicateCostSheetVersion(costSheet.value.id)
  if (duplicated) { showToast('Versi Baru Dibuat', `${duplicated.name} kini versi ${duplicated.version}, siap direvisi.`, 'success') }
}

const isApplyDialogOpen = ref(false)
function submitApplyToQuotation () {
  if (!costSheet.value) { return }
  const quotation = applyCostSheetToQuotation(costSheet.value.id, currentUser.value.id)
  isApplyDialogOpen.value = false
  if (quotation) {
    showToast('Diterapkan ke Quotation', `Cost Sheet ini kini terkunci (snapshot) dan diterapkan ke Quotation ${quotation.id}.`, 'success')
  } else {
    showToast('Gagal Menerapkan', 'Quotation pada Opportunity ini sudah diajukan/disetujui — tidak dapat ditimpa oleh Cost Sheet.', 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!costSheet">
      <PageHeader title="Cost Sheet Tidak Ditemukan" :breadcrumb="[{ label: 'Product Planning', to: '/product-planning' }, { label: 'Cost Sheets', to: '/product-planning/cost-sheets' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Cost Sheet tidak ditemukan"
          :description="`Cost Sheet dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/product-planning/cost-sheets')">
            Kembali ke Daftar Cost Sheet
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('product-planning')" module-label="modul Product Planning" />

    <template v-else>
      <PageHeader :title="costSheet.name" :breadcrumb="[{ label: 'Product Planning', to: '/product-planning' }, { label: 'Cost Sheets', to: '/product-planning/cost-sheets' }, { label: costSheet.name }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="costSheet.status === 'final' ? 'Final (Locked)' : 'Draft'" :tone="costSheet.status === 'final' ? 'success' : 'neutral'" />
            <template v-if="canManageCostSheet">
              <Button v-if="costSheet.status !== 'final'" size="sm" variant="outline" @click="openEditDialog">
                Edit Cost Sheet
              </Button>
              <Button size="sm" variant="outline" @click="submitDuplicate">
                Duplicate as New Version
              </Button>
              <Dialog v-if="costSheet.opportunityId && !costSheet.appliedToQuotationId" v-model:open="isApplyDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm">
                    Apply to Quotation
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Terapkan Cost Sheet ke Quotation</DialogTitle>
                    <DialogDescription>
                      Total sell ({{ formatCurrencyIdr(breakdown!.totalSellIdr) }}) akan disalin (snapshot) ke Quotation Opportunity "{{ opportunity?.title }}".
                      Cost Sheet ini akan terkunci setelahnya — revisi lanjutan wajib lewat "Duplicate as New Version".
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" @click="isApplyDialogOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitApplyToQuotation">
                      Terapkan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
          </div>
        </template>
      </PageHeader>

      <div v-if="costSheet.appliedToQuotationId" class="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <p class="text-foreground">
          Cost Sheet ini sudah diterapkan (snapshot) ke <NuxtLink :to="`/crm/opportunities/${costSheet.opportunityId}`" class="text-primary hover:underline font-medium">
            Quotation {{ costSheet.appliedToQuotationId }}
          </NuxtLink> pada {{ formatDate(costSheet.appliedAt!) }} — tidak dapat diedit lagi.
        </p>
      </div>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Line Items">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Layanan</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Biaya / Pax</TableHead>
              <TableHead>Total ({{ costSheet.travelerCount }} pax)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, index) in costSheet.lineItems" :key="index">
              <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, item.service).label" :tone="findStatusOption(SERVICE_TYPES, item.service).tone" /></TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.description ?? '—' }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(item.costPerPaxIdr) }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(item.costPerPaxIdr * costSheet.travelerCount) }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="costSheet.lineItems.length === 0" :colspan="4">
              Belum ada line item biaya.
            </TableEmpty>
          </TableBody>
        </Table>

        <div v-if="breakdown" class="mt-4 pt-4 border-t border-border grid gap-2 sm:grid-cols-2 max-w-xl">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Base Cost</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.baseCostIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Contingency ({{ costSheet.contingencyPercent }}%)</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.contingencyIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Cost + Contingency</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.costWithContingencyIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Markup ({{ costSheet.markupPercent }}%)</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.markupIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Subtotal</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.subtotalIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Tax / Fee ({{ costSheet.taxPercent }}%)</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.taxIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-base font-semibold sm:col-span-2 pt-2 border-t border-border">
            <span class="text-foreground">Total Sell</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.totalSellIdr) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm sm:col-span-2">
            <span class="text-muted-foreground">Estimasi Margin</span><span class="text-foreground">{{ formatCurrencyIdr(breakdown.marginIdr) }}</span>
          </div>
        </div>

        <div v-if="costSheet.supersededTotalSellIdr" class="mt-3 text-xs text-muted-foreground">
          <p>Direvisi dari total sell versi sebelumnya: {{ formatCurrencyIdr(costSheet.supersededTotalSellIdr) }}</p>
          <button type="button" class="text-primary hover:underline" @click="isVersionCompareOpen = !isVersionCompareOpen">
            {{ isVersionCompareOpen ? 'Sembunyikan' : 'Bandingkan' }} dengan versi sebelumnya
          </button>
          <div v-if="isVersionCompareOpen" class="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Versi Sebelumnya
              </p>
              <p class="text-sm text-foreground">
                {{ formatCurrencyIdr(costSheet.supersededTotalSellIdr) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Versi {{ costSheet.version }} (Saat Ini)
              </p>
              <p class="text-sm text-foreground">
                {{ formatCurrencyIdr(breakdown!.totalSellIdr) }}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard v-if="scenarioSiblings.length > 0" title="Scenario Comparison" description="Cost Sheet lain yang melekat pada Opportunity yang sama.">
        <div class="space-y-3">
          <select v-model="compareTargetId" class="w-full max-w-sm appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="">
              Pilih skenario untuk dibandingkan
            </option>
            <option v-for="sibling in scenarioSiblings" :key="sibling.id" :value="sibling.id">
              {{ sibling.name }}
            </option>
          </select>
          <div v-if="compareTarget && compareBreakdown" class="grid gap-3 sm:grid-cols-2 rounded-lg border border-border p-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {{ costSheet.name }} (Saat Ini)
              </p>
              <p class="text-lg font-semibold text-foreground">
                {{ formatCurrencyIdr(breakdown!.totalSellIdr) }}
              </p>
              <p class="text-xs text-muted-foreground">
                Margin {{ formatCurrencyIdr(breakdown!.marginIdr) }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {{ compareTarget.name }}
              </p>
              <p class="text-lg font-semibold text-foreground">
                {{ formatCurrencyIdr(compareBreakdown.totalSellIdr) }}
              </p>
              <p class="text-xs text-muted-foreground">
                Margin {{ formatCurrencyIdr(compareBreakdown.marginIdr) }}
              </p>
            </div>
            <p class="col-span-2 text-[11px] text-muted-foreground">
              Selisih total sell: {{ formatCurrencyIdr(Math.abs(breakdown!.totalSellIdr - compareBreakdown.totalSellIdr)) }}.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard v-if="costSheet.inclusions || costSheet.exclusions || costSheet.assumptions || costSheet.notes" title="Inclusions, Exclusions, Assumptions dan Catatan">
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-if="costSheet.inclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Inclusions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ costSheet.inclusions }}
            </p>
          </div>
          <div v-if="costSheet.exclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Exclusions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ costSheet.exclusions }}
            </p>
          </div>
          <div v-if="costSheet.assumptions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Assumptions
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ costSheet.assumptions }}
            </p>
          </div>
          <div v-if="costSheet.notes">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Catatan Kolaborasi
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ costSheet.notes }}
            </p>
          </div>
        </div>
      </SectionCard>

      <Dialog v-model:open="isEditOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Cost Sheet</DialogTitle>
            <DialogDescription>Hanya dapat diedit selagi masih Draft — setelah diterapkan ke Quotation, revisi wajib lewat "Duplicate as New Version".</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-cs-name">Nama</Label>
                <Input id="edit-cs-name" v-model="editName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-pax">Traveler Count</Label>
                <Input id="edit-cs-pax" v-model.number="editTravelerCount" type="number" />
              </div>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <div class="space-y-1.5">
                <Label for="edit-cs-currency">Currency</Label>
                <Input id="edit-cs-currency" v-model="editCurrency" placeholder="IDR" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-markup">Markup (%)</Label>
                <Input id="edit-cs-markup" v-model.number="editMarkupPercent" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-tax">Tax/Fee (%)</Label>
                <Input id="edit-cs-tax" v-model.number="editTaxPercent" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-contingency">Contingency (%)</Label>
                <Input id="edit-cs-contingency" v-model.number="editContingencyPercent" type="number" />
              </div>
            </div>

            <div class="space-y-2 pt-2 border-t border-border">
              <div class="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button size="sm" variant="outline" type="button" @click="addLineItemRow">
                  <Plus class="h-3.5 w-3.5 mr-1" />Tambah
                </Button>
              </div>
              <div v-for="(item, index) in editLineItems" :key="index" class="grid grid-cols-12 gap-2 items-center">
                <select v-model="item.service" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
                <Input v-model="item.description" placeholder="Deskripsi" class="col-span-6 h-8 text-xs" />
                <Input v-model.number="item.costPerPaxIdr" type="number" placeholder="Biaya/pax" class="col-span-3 h-8 text-xs" />
                <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeLineItemRow(index)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <p v-if="editLineItems.length === 0" class="text-xs text-muted-foreground">
                Belum ada line item — klik "Tambah" untuk menambahkan.
              </p>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-cs-validity-start">Validity Mulai</Label>
                <Input id="edit-cs-validity-start" v-model="editValidityStart" type="date" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-validity-end">Validity Sampai</Label>
                <Input id="edit-cs-validity-end" v-model="editValidityEnd" type="date" />
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-cs-inclusions">Inclusions</Label>
                <textarea id="edit-cs-inclusions" v-model="editInclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-exclusions">Exclusions</Label>
                <textarea id="edit-cs-exclusions" v-model="editExclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-assumptions">Assumptions</Label>
                <textarea id="edit-cs-assumptions" v-model="editAssumptions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-cs-notes">Catatan Kolaborasi</Label>
                <textarea id="edit-cs-notes" v-model="editNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Catatan untuk AE/Operations/Finance" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditOpen = false">
              Batal
            </Button>
            <Button :disabled="!editName.trim() || !editTravelerCount" @click="submitEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
