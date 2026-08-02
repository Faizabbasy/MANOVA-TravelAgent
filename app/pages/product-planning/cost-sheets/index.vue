<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus } from 'lucide-vue-next'
import { COST_SHEETS, PRODUCT_TEMPLATES, OPPORTUNITIES, getCostSheetBreakdown, getOpportunityById, createCostSheet } from '~/data'
import { formatCurrencyIdr } from '~/utils/format'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Cost Sheets' })

const route = useRoute()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageCostSheet = computed(() => canManage('product-planning'))

const searchQuery = ref('')
const statusFilter = ref('all')
const opportunityFilter = ref('all')

const rows = computed(() => {
  let result = COST_SHEETS.map(sheet => ({ sheet, breakdown: getCostSheetBreakdown(sheet) }))

  if (statusFilter.value !== 'all') { result = result.filter(row => row.sheet.status === statusFilter.value) }
  if (opportunityFilter.value !== 'all') { result = result.filter(row => row.sheet.opportunityId === opportunityFilter.value) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.sheet.name.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.sheet.createdAt.localeCompare(a.sheet.createdAt))
})

function opportunityLabel (opportunityId?: string) {
  if (!opportunityId) { return '—' }
  return getOpportunityById(opportunityId)?.title ?? opportunityId
}

const opportunitiesWithCostSheetInterest = computed(() => OPPORTUNITIES.filter(opp => !['won', 'lost'].includes(opp.stage)))

/* Buat Cost Sheet baru — bisa dipicu langsung dari Product Template Detail (query productId) atau Opportunity Detail (query opportunityId) */
const isCreateOpen = ref(false)
const newName = ref('')
const newProductId = ref('')
const newOpportunityId = ref('')
const newTravelerCount = ref<number | null>(null)
const newMarkupPercent = ref<number | null>(null)
const newTaxPercent = ref<number | null>(null)
const newContingencyPercent = ref<number | null>(null)

function resetCreateForm () {
  newName.value = ''
  newProductId.value = ''
  newOpportunityId.value = ''
  newTravelerCount.value = null
  newMarkupPercent.value = null
  newTaxPercent.value = null
  newContingencyPercent.value = null
}

function openCreateDialog () {
  resetCreateForm()
  if (typeof route.query.productId === 'string') {
    newProductId.value = route.query.productId
    const product = PRODUCT_TEMPLATES.find(p => p.id === route.query.productId)
    if (product) {
      newTravelerCount.value = product.basePaxCount
      newName.value = `${product.name} — Cost Sheet`
    }
  }
  if (typeof route.query.opportunityId === 'string') {
    newOpportunityId.value = route.query.opportunityId
    const opportunity = OPPORTUNITIES.find(o => o.id === route.query.opportunityId)
    if (opportunity) {
      newTravelerCount.value ??= opportunity.travelerEstimate ?? null
      if (!newName.value) { newName.value = `${opportunity.title} — Cost Sheet` }
    }
  }
  isCreateOpen.value = true
}

watch(() => route.query.create, (value) => { if (value === '1') { openCreateDialog() } }, { immediate: true })

function submitCreate () {
  if (!newName.value.trim() || !newTravelerCount.value) { return }
  const sheet = createCostSheet({
    name: newName.value.trim(),
    productId: newProductId.value || undefined,
    opportunityId: newOpportunityId.value || undefined,
    travelerCount: newTravelerCount.value,
    markupPercent: newMarkupPercent.value ?? 0,
    taxPercent: newTaxPercent.value ?? 0,
    contingencyPercent: newContingencyPercent.value ?? 0,
    createdBy: currentUser.value.id
  })
  isCreateOpen.value = false
  navigateTo(`/product-planning/cost-sheets/${sheet.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Cost Sheets"
      description="Perhitungan biaya traveler-based — markup, tax/fee, contingency, currency — sumber estimasi cost/margin Quotation."
      :breadcrumb="[{ label: 'Product Planning', to: '/product-planning' }, { label: 'Cost Sheets' }]"
    >
      <template v-if="canManageCostSheet" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button @click="openCreateDialog">
              <Plus class="h-4 w-4 mr-1.5" />Buat Cost Sheet
            </Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Cost Sheet Baru</DialogTitle>
              <DialogDescription>Dapat dibuat lepas (referensi katalog) atau langsung terhubung ke satu Opportunity untuk kolaborasi dengan Account Executive.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="cs-name">Nama / Label Skenario</Label>
                <Input id="cs-name" v-model="newName" placeholder="mis. Palu MICE 2027 — Economy Scenario" />
              </div>
              <div class="space-y-1.5">
                <Label for="cs-product">Product Template (opsional)</Label>
                <select id="cs-product" v-model="newProductId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Tanpa template — mulai kosong
                  </option>
                  <option v-for="product in PRODUCT_TEMPLATES" :key="product.id" :value="product.id">
                    {{ product.name }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="cs-opportunity">Opportunity (opsional)</Label>
                <select id="cs-opportunity" v-model="newOpportunityId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Belum terhubung ke Opportunity
                  </option>
                  <option v-for="opp in opportunitiesWithCostSheetInterest" :key="opp.id" :value="opp.id">
                    {{ opp.title }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="cs-pax">Traveler Count</Label>
                <Input id="cs-pax" v-model.number="newTravelerCount" type="number" placeholder="mis. 25" />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div class="space-y-1.5">
                  <Label for="cs-markup">Markup (%)</Label>
                  <Input id="cs-markup" v-model.number="newMarkupPercent" type="number" placeholder="0" />
                </div>
                <div class="space-y-1.5">
                  <Label for="cs-tax">Tax/Fee (%)</Label>
                  <Input id="cs-tax" v-model.number="newTaxPercent" type="number" placeholder="0" />
                </div>
                <div class="space-y-1.5">
                  <Label for="cs-contingency">Contingency (%)</Label>
                  <Input id="cs-contingency" v-model.number="newContingencyPercent" type="number" placeholder="0" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newName.trim() || !newTravelerCount" @click="submitCreate">
                Simpan
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('product-planning')" module-label="modul Product Planning" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama cost sheet..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option value="draft">
            Draft
          </option>
          <option value="final">
            Final
          </option>
        </select>
        <select v-model="opportunityFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Opportunity
          </option>
          <option v-for="opp in OPPORTUNITIES" :key="opp.id" :value="opp.id">
            {{ opp.title }}
          </option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Cost Sheet</TableHead>
              <TableHead>Opportunity</TableHead>
              <TableHead>Traveler</TableHead>
              <TableHead>Total Sell</TableHead>
              <TableHead>Versi</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.sheet.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/product-planning/cost-sheets/${row.sheet.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.sheet.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ opportunityLabel(row.sheet.opportunityId) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.sheet.travelerCount }} pax
              </TableCell>
              <TableCell class="text-foreground">
                {{ formatCurrencyIdr(row.breakdown.totalSellIdr) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                v{{ row.sheet.version }}
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1.5">
                  <StatusBadge :label="row.sheet.status === 'final' ? 'Final' : 'Draft'" :tone="row.sheet.status === 'final' ? 'success' : 'neutral'" />
                  <StatusBadge v-if="row.sheet.appliedToQuotationId" label="Applied" tone="info" />
                </div>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' || opportunityFilter !== 'all' ? 'Tidak ada Cost Sheet yang cocok dengan filter.' : 'Belum ada Cost Sheet.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
