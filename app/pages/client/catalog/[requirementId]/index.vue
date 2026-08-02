<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageX, Plus, Scale } from 'lucide-vue-next'
import {
  getCommodityRequirementById, updateCommodityRequirementStatus, getCommodityProductById,
  matchCommoditiesForRequirement, getCommodityTotalAvailable,
  getCommodityVariantsByProduct, getAvailabilitySlotsByCommodity, getAvailableQuantity,
  getCommoditySelectionsByRequirement, createCommoditySelection, submitAndHoldCommoditySelection,
  cancelCommoditySelectionHold, computeHoldExpiry, sweepExpiredHolds, hasActiveSelectionWithRank,
  type CommodityMatchResult, type CommodityMatchTier
} from '~/data'
import {
  SERVICE_TYPES, COMMODITY_REQUIREMENT_STATUSES, COMMODITY_SELECTION_STATUSES, SELECTION_CHOICE_RANKS,
  findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, daysUntil } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { CommodityVariant } from '~/types/commodity'
import type { SelectionChoiceRank } from '~/types/selection'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const requirement = computed(() => getCommodityRequirementById(String(route.params.requirementId)))
useHead({ title: computed(() => requirement.value ? `Cari Komoditas — ${requirement.value.title}` : 'Kebutuhan Tidak Ditemukan') })

/** Ownership (Phase 3, pola sama `isOwnCompany` project detail) — requirement harus milik `clientScopeId` user login. */
const isOwn = computed(() => !!requirement.value && !!clientScopeId.value && requirement.value.clientPartyId === clientScopeId.value)

/** Hold expiry sweep (Phase 4) — dijalankan sekali saat halaman ini diakses (Phase 1 sengaja tidak membuat sweep otomatis/cron, lihat komentar `sweepExpiredHolds`). */
sweepExpiredHolds()

/** Requirement Open → Matching begitu Client mulai mencari komoditas (transisi maju, hanya sekali). */
if (requirement.value && isOwn.value && requirement.value.status === 'open') {
  updateCommodityRequirementStatus(requirement.value.id, 'matching')
}

const MATCH_TIER_LABELS: Record<CommodityMatchTier, { label: string, tone: 'success' | 'warning' | 'info' }> = {
  'exact-match': { label: 'Exact Match', tone: 'success' },
  'near-match': { label: 'Near Match', tone: 'warning' },
  alternative: { label: 'Alternative', tone: 'info' },
  'no-match': { label: 'No Match', tone: 'info' }
}

const matchResults = computed(() => (requirement.value ? matchCommoditiesForRequirement(requirement.value.id) : []))

const searchQuery = ref('')
function filterResults (results: CommodityMatchResult[]): CommodityMatchResult[] {
  if (!searchQuery.value.trim()) { return results }
  const q = searchQuery.value.toLowerCase()
  return results.filter(r => r.commodity.name.toLowerCase().includes(q))
}
const exactMatches = computed(() => filterResults(matchResults.value.filter(r => r.tier === 'exact-match')))
const nearMatches = computed(() => filterResults(matchResults.value.filter(r => r.tier === 'near-match')))
const alternatives = computed(() => filterResults(matchResults.value.filter(r => r.tier === 'alternative')))
/** Hasil setelah difilter search (Phase 6 regression fix) — dipakai untuk empty state agar tidak blank saat search tidak menemukan apa pun walau `matchResults` mentah tidak kosong. */
const hasFilteredResults = computed(() => exactMatches.value.length + nearMatches.value.length + alternatives.value.length > 0)

// ── Compare (maks. 4 commodity) ───────────────────────────────────────────
const MAX_COMPARE = 4
const compareIds = ref<string[]>([])
function toggleCompare (commodityId: string) {
  if (compareIds.value.includes(commodityId)) {
    compareIds.value = compareIds.value.filter(id => id !== commodityId)
    return
  }
  if (compareIds.value.length >= MAX_COMPARE) {
    showToast('Batas Perbandingan', `Maksimal ${MAX_COMPARE} komoditas dapat dibandingkan sekaligus.`, 'warning')
    return
  }
  compareIds.value = [...compareIds.value, commodityId]
}
const compareResults = computed(() => matchResults.value.filter(r => compareIds.value.includes(r.commodity.id)))
const isCompareOpen = ref(false)

// ── Detail (read-only) ────────────────────────────────────────────────────
const viewingCommodityId = ref<string | null>(null)
const viewingResult = computed(() => matchResults.value.find(r => r.commodity.id === viewingCommodityId.value) ?? null)
const viewingVariants = computed<CommodityVariant[]>(() => (viewingCommodityId.value ? getCommodityVariantsByProduct(viewingCommodityId.value) : []))

// ── Selection dialog (variant + quantity + rank) ──────────────────────────
const isSelectDialogOpen = ref(false)
const selectingCommodityId = ref<string | null>(null)
const selectingVariantId = ref<string>('')
const selectQuantity = ref<number | null>(null)
const selectRank = ref<SelectionChoiceRank | ''>('')

const selectingVariants = computed<CommodityVariant[]>(() => (selectingCommodityId.value ? getCommodityVariantsByProduct(selectingCommodityId.value) : []))
const requiresVariant = computed(() => selectingVariants.value.length > 0)

function relevantSlots (commodityId: string, variantId: string | undefined) {
  return getAvailabilitySlotsByCommodity(commodityId).filter(slot => slot.variantId === variantId)
}
const maxSelectableQuantity = computed(() => {
  if (!selectingCommodityId.value) { return 0 }
  if (requiresVariant.value && !selectingVariantId.value) { return 0 }
  return relevantSlots(selectingCommodityId.value, selectingVariantId.value || undefined)
    .reduce((sum, slot) => sum + getAvailableQuantity(slot), 0)
})
const availableRanks = computed(() => {
  if (!requirement.value) { return [] }
  return SELECTION_CHOICE_RANKS.filter(rank => !hasActiveSelectionWithRank(requirement.value!.id, rank.value))
})

function openSelectDialog (commodityId: string) {
  selectingCommodityId.value = commodityId
  const variants = getCommodityVariantsByProduct(commodityId)
  selectingVariantId.value = variants.length ? variants[0].id : ''
  selectQuantity.value = null
  selectRank.value = availableRanks.value[0]?.value ?? ''
  isSelectDialogOpen.value = true
}

function pickSlotForSubmit (commodityId: string, variantId: string | undefined, quantity: number) {
  return relevantSlots(commodityId, variantId)
    .filter(slot => getAvailableQuantity(slot) >= quantity)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0]
}

function advanceRequirementAfterSelection (submitted: boolean) {
  if (!requirement.value) { return }
  if (requirement.value.status === 'matching') {
    updateCommodityRequirementStatus(requirement.value.id, 'selection-in-progress')
  }
  if (submitted && requirement.value.status === 'selection-in-progress') {
    updateCommodityRequirementStatus(requirement.value.id, 'selection-submitted')
  }
}

function saveDraftSelection () {
  if (!requirement.value || !selectingCommodityId.value || !selectQuantity.value || !selectRank.value) { return }
  if (requiresVariant.value && !selectingVariantId.value) { return }
  if (selectQuantity.value > maxSelectableQuantity.value) {
    showToast('Quantity Melebihi Availability', `Sisa availability hanya ${maxSelectableQuantity.value}.`, 'error')
    return
  }
  const selection = createCommoditySelection({
    requirementId: requirement.value.id,
    commodityProductId: selectingCommodityId.value,
    variantId: selectingVariantId.value || undefined,
    quantity: selectQuantity.value,
    choiceRank: selectRank.value
  })
  if (!selection) {
    showToast('Gagal Menyimpan', 'Rank ini sudah terisi atau komoditas ini sudah dipilih aktif untuk kebutuhan ini.', 'error')
    return
  }
  advanceRequirementAfterSelection(false)
  isSelectDialogOpen.value = false
  showToast('Draft Selection Disimpan', 'Pilihan Anda tersimpan sebagai draft — belum menahan stok.', 'success')
}

function submitSelectionNow () {
  if (!requirement.value || !selectingCommodityId.value || !selectQuantity.value || !selectRank.value) { return }
  if (requiresVariant.value && !selectingVariantId.value) { return }
  if (selectQuantity.value > maxSelectableQuantity.value) {
    showToast('Quantity Melebihi Availability', `Sisa availability hanya ${maxSelectableQuantity.value}.`, 'error')
    return
  }
  const slot = pickSlotForSubmit(selectingCommodityId.value, selectingVariantId.value || undefined, selectQuantity.value)
  if (!slot) {
    showToast('Availability Tidak Cukup', 'Stok berubah saat Anda mengisi form — silakan pilih ulang.', 'error')
    return
  }
  const selection = createCommoditySelection({
    requirementId: requirement.value.id,
    commodityProductId: selectingCommodityId.value,
    variantId: selectingVariantId.value || undefined,
    quantity: selectQuantity.value,
    choiceRank: selectRank.value
  })
  if (!selection) {
    showToast('Gagal Menyimpan', 'Rank ini sudah terisi atau komoditas ini sudah dipilih aktif untuk kebutuhan ini.', 'error')
    return
  }
  const held = submitAndHoldCommoditySelection(selection.id, slot.id, computeHoldExpiry())
  if (!held) {
    showToast('Availability Tidak Cukup Saat Submit', 'Soft Hold gagal dibuat — stok tidak lagi mencukupi (availability sudah dicek ulang).', 'error')
    return
  }
  advanceRequirementAfterSelection(true)
  isSelectDialogOpen.value = false
  showToast('Selection Diajukan', `Soft Hold dibuat, kadaluarsa ${formatDate(held.holdExpiresAt!)}.`, 'success')
}

// ── Selected Commodities (Phase 4) ────────────────────────────────────────
const mySelections = computed(() => (requirement.value ? getCommoditySelectionsByRequirement(requirement.value.id) : []))

/** Nama commodity untuk selection yang mungkin sudah tidak lagi katalog-visible (mis. sudah archived/expired setelah selection dibuat) — tetap harus bisa ditampilkan di riwayat "Selected Commodities", bukan hanya yang masih ada di `matchResults`. */
const selectionCommodityNames = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const selection of mySelections.value) {
    const product = getCommodityProductById(selection.commodityProductId)
    if (product) { map[selection.commodityProductId] = product.name }
  }
  return map
})
function selectionCommodityName (commodityProductId: string): string {
  return selectionCommodityNames.value[commodityProductId] ?? commodityProductId
}

function submitDraftFromList (selectionId: string, commodityProductId: string, variantId: string | undefined, quantity: number) {
  const slot = pickSlotForSubmit(commodityProductId, variantId, quantity)
  if (!slot) {
    showToast('Availability Tidak Cukup', 'Stok tidak lagi mencukupi untuk selection ini.', 'error')
    return
  }
  const held = submitAndHoldCommoditySelection(selectionId, slot.id, computeHoldExpiry())
  if (held) {
    advanceRequirementAfterSelection(true)
    showToast('Selection Diajukan', `Soft Hold dibuat, kadaluarsa ${formatDate(held.holdExpiresAt!)}.`, 'success')
  } else {
    showToast('Gagal Mengajukan', 'Availability tidak mencukupi saat ini.', 'error')
  }
}

function cancelSelection (selectionId: string) {
  const result = cancelCommoditySelectionHold(selectionId)
  if (result) { showToast('Pilihan Dibatalkan', 'Selection dibatalkan, availability yang tertahan sudah dikembalikan.', 'success') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!requirement || !isOwn">
      <PageHeader title="Kebutuhan Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="PackageX" title="Kebutuhan komoditas tidak ditemukan" description="Kebutuhan ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client')">
            Kembali ke Client Portal
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal') || !clientScopeId" module-label="Client Portal" />

    <template v-else>
      <PageHeader :title="`Cari Komoditas — ${requirement.title}`" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Project Order', to: `/client/project-orders/${requirement.projectId}?tab=commodity` }, { label: requirement.title }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(COMMODITY_REQUIREMENT_STATUSES, requirement.status).label" :tone="findStatusOption(COMMODITY_REQUIREMENT_STATUSES, requirement.status).tone" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList
          :items="[
            { label: 'Kategori', value: findStatusOption(SERVICE_TYPES, requirement.category).label },
            { label: 'Kuantitas Dibutuhkan', value: String(requirement.quantity) },
            { label: 'Catatan', value: requirement.notes ?? '—' },
          ]"
        />
      </SectionCard>

      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <Input v-model="searchQuery" placeholder="Cari nama komoditas dalam hasil..." class="max-w-sm w-full" />
        <Button v-if="compareIds.length > 1" variant="outline" @click="isCompareOpen = true">
          <Scale class="h-4 w-4 mr-1.5" />Bandingkan ({{ compareIds.length }})
        </Button>
      </div>

      <EmptyState v-if="matchResults.length === 0" :icon="PackageX" title="No Match" description="Belum ada komoditas Vendor yang cocok dengan kebutuhan ini saat ini. Coba lagi nanti setelah Vendor mempublikasikan komoditas baru." />
      <EmptyState v-else-if="!hasFilteredResults" :icon="PackageX" title="Tidak Ada Hasil" description="Tidak ada komoditas yang cocok dengan kata kunci pencarian Anda. Coba kata kunci lain." />

      <template
        v-for="group in [
          { key: 'exact-match', title: 'Exact Match', results: exactMatches },
          { key: 'near-match', title: 'Near Match', results: nearMatches },
          { key: 'alternative', title: 'Alternative', results: alternatives },
        ]"
        :key="group.key"
      >
        <SectionCard v-if="group.results.length" :title="group.title">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bandingkan</TableHead>
                <TableHead>Nama Komoditas</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="result in group.results" :key="result.commodity.id">
                <TableCell>
                  <Checkbox :model-value="compareIds.includes(result.commodity.id)" @update:model-value="() => toggleCompare(result.commodity.id)" />
                </TableCell>
                <TableCell class="font-medium text-foreground">
                  {{ result.commodity.name }}
                </TableCell>
                <TableCell class="text-foreground">
                  {{ formatCurrencyIdr(result.commodity.sellPriceIdr) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ getCommodityTotalAvailable(result.commodity.id) }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <Button size="sm" variant="ghost" @click="viewingCommodityId = result.commodity.id">
                      Detail
                    </Button>
                    <Button size="sm" @click="openSelectDialog(result.commodity.id)">
                      <Plus class="h-4 w-4 mr-1" />Pilih
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SectionCard>
      </template>

      <SectionCard title="Selected Commodities" description="Kebutuhan komoditas Anda yang sudah dipilih untuk kebutuhan ini.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Komoditas</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Pilihan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hold Kadaluarsa</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="selection in mySelections" :key="selection.id">
              <TableCell class="font-medium text-foreground">
                {{ selectionCommodityName(selection.commodityProductId) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ selection.quantity }}
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(SELECTION_CHOICE_RANKS, selection.choiceRank).label" :tone="findStatusOption(SELECTION_CHOICE_RANKS, selection.choiceRank).tone" />
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(COMMODITY_SELECTION_STATUSES, selection.status).label" :tone="findStatusOption(COMMODITY_SELECTION_STATUSES, selection.status).tone" />
              </TableCell>
              <TableCell class="text-muted-foreground">
                <template v-if="selection.status === 'soft-hold' && selection.holdExpiresAt">
                  {{ formatDate(selection.holdExpiresAt) }} ({{ daysUntil(selection.holdExpiresAt, DEMO_REFERENCE_DATE) }} hari lagi)
                </template>
                <template v-else>
                  —
                </template>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Button v-if="selection.status === 'draft'" size="sm" variant="outline" @click="submitDraftFromList(selection.id, selection.commodityProductId, selection.variantId, selection.quantity)">
                    Ajukan
                  </Button>
                  <Button v-if="['draft', 'soft-hold'].includes(selection.status)" size="sm" variant="destructive" @click="cancelSelection(selection.id)">
                    Batalkan
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="mySelections.length === 0" :colspan="6">
              Belum ada komoditas yang dipilih untuk kebutuhan ini.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <!-- ── Detail Dialog (read-only) ─────────────────────────────────── -->
      <Dialog :open="viewingCommodityId !== null" @update:open="val => { if (!val) viewingCommodityId = null }">
        <DialogContent v-if="viewingResult" class="max-w-md">
          <DialogHeader>
            <DialogTitle>{{ viewingResult.commodity.name }}</DialogTitle>
            <DialogDescription>{{ viewingResult.commodity.description ?? 'Tidak ada deskripsi.' }}</DialogDescription>
          </DialogHeader>
          <DetailMetadataList
            :items="[
              { label: 'Kategori', value: findStatusOption(SERVICE_TYPES, viewingResult.commodity.category).label },
              { label: 'Harga Jual', value: formatCurrencyIdr(viewingResult.commodity.sellPriceIdr) },
              { label: 'Match', value: MATCH_TIER_LABELS[viewingResult.tier].label },
              { label: 'Sisa Availability', value: String(getCommodityTotalAvailable(viewingResult.commodity.id)) },
            ]"
          />
          <div v-if="viewingVariants.length" class="mt-3 pt-3 border-t border-border">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Variant Tersedia
            </p>
            <ul class="space-y-1">
              <li v-for="variant in viewingVariants" :key="variant.id" class="text-sm text-foreground flex items-center justify-between">
                <span>{{ variant.name }}</span>
                <span class="text-muted-foreground">{{ variant.sellPriceIdr ? formatCurrencyIdr(variant.sellPriceIdr) : formatCurrencyIdr(viewingResult.commodity.sellPriceIdr) }}</span>
              </li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <!-- ── Compare Dialog ─────────────────────────────────────────────── -->
      <Dialog v-model:open="isCompareOpen">
        <DialogContent class="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bandingkan Komoditas</DialogTitle>
          </DialogHeader>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead v-for="result in compareResults" :key="result.commodity.id">
                    {{ result.commodity.name }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell class="font-medium">
                    Match
                  </TableCell>
                  <TableCell v-for="result in compareResults" :key="result.commodity.id">
                    <StatusBadge :label="MATCH_TIER_LABELS[result.tier].label" :tone="MATCH_TIER_LABELS[result.tier].tone" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell class="font-medium">
                    Harga
                  </TableCell>
                  <TableCell v-for="result in compareResults" :key="result.commodity.id">
                    {{ formatCurrencyIdr(result.commodity.sellPriceIdr) }}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell class="font-medium">
                    Availability
                  </TableCell>
                  <TableCell v-for="result in compareResults" :key="result.commodity.id">
                    {{ getCommodityTotalAvailable(result.commodity.id) }}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell class="font-medium">
                    Variant
                  </TableCell>
                  <TableCell v-for="result in compareResults" :key="result.commodity.id">
                    {{ getCommodityVariantsByProduct(result.commodity.id).map(v => v.name).join(', ') || '—' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <!-- ── Selection Dialog (variant + quantity + rank) ──────────────── -->
      <Dialog v-model:open="isSelectDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Pilih Komoditas</DialogTitle>
            <DialogDescription>Availability akan diperiksa ulang saat Anda mengajukan selection.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div v-if="requiresVariant" class="space-y-1.5">
              <Label for="select-variant">Variant</Label>
              <select id="select-variant" v-model="selectingVariantId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="variant in selectingVariants" :key="variant.id" :value="variant.id">
                  {{ variant.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="select-quantity">Jumlah (maks. {{ maxSelectableQuantity }})</Label>
              <Input id="select-quantity" v-model.number="selectQuantity" type="number" :max="maxSelectableQuantity" />
              <p v-if="selectQuantity && selectQuantity > maxSelectableQuantity" class="text-xs text-destructive">
                Jumlah melebihi sisa availability ({{ maxSelectableQuantity }}).
              </p>
            </div>
            <div class="space-y-1.5">
              <Label for="select-rank">Pilihan</Label>
              <select id="select-rank" v-model="selectRank" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="rank in availableRanks" :key="rank.value" :value="rank.value">
                  {{ rank.label }}
                </option>
              </select>
              <p v-if="availableRanks.length === 0" class="text-xs text-destructive">
                Primary, Secondary, dan Third Choice sudah semua terisi — batalkan salah satu pilihan aktif terlebih dahulu.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isSelectDialogOpen = false">
              Batal
            </Button>
            <Button variant="outline" :disabled="!selectQuantity || !selectRank || selectQuantity > maxSelectableQuantity" @click="saveDraftSelection">
              Simpan Draft
            </Button>
            <Button :disabled="!selectQuantity || !selectRank || selectQuantity > maxSelectableQuantity" @click="submitSelectionNow">
              Ajukan Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
