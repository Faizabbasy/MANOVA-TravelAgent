<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus } from 'lucide-vue-next'
import { PRODUCT_TEMPLATES, getCostSheetsByProduct, createProductTemplate } from '~/data'
import { SERVICE_TYPES, findStatusOption } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'
import type { ProductTemplateStatus } from '~/types/product'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Product Planning' })

const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageProduct = computed(() => canManage('product-planning'))

const STATUS_OPTIONS: { value: ProductTemplateStatus; label: string; tone: 'neutral' | 'success' | 'warning' }[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'warning' }
]

const searchQuery = ref('')
const statusFilter = ref('all')
const serviceFilter = ref('all')

const rows = computed(() => {
  let result = PRODUCT_TEMPLATES.map(product => ({
    product,
    costSheetCount: getCostSheetsByProduct(product.id).length
  }))

  if (statusFilter.value !== 'all') { result = result.filter(row => row.product.status === statusFilter.value) }
  if (serviceFilter.value !== 'all') { result = result.filter(row => row.product.serviceScope.includes(serviceFilter.value as ServiceTypeKey)) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.product.name.toLowerCase().includes(q) || row.product.destination.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.product.createdAt.localeCompare(a.product.createdAt))
})

/* Buat Product Template baru */
const isCreateOpen = ref(false)
const newName = ref('')
const newDestination = ref('')
const newServiceScope = ref<ServiceTypeKey[]>([])
const newBasePaxCount = ref<number | null>(null)
const newItineraryConcept = ref('')

function toggleServiceScope (type: ServiceTypeKey) {
  newServiceScope.value = newServiceScope.value.includes(type)
    ? newServiceScope.value.filter(item => item !== type)
    : [...newServiceScope.value, type]
}

function resetCreateForm () {
  newName.value = ''
  newDestination.value = ''
  newServiceScope.value = []
  newBasePaxCount.value = null
  newItineraryConcept.value = ''
}

function submitCreate () {
  if (!newName.value.trim() || !newDestination.value.trim() || newServiceScope.value.length === 0 || !newBasePaxCount.value) { return }
  const product = createProductTemplate({
    name: newName.value.trim(),
    destination: newDestination.value.trim(),
    serviceScope: newServiceScope.value,
    basePaxCount: newBasePaxCount.value,
    itineraryConcept: newItineraryConcept.value.trim() || undefined,
    createdBy: currentUser.value.id
  })
  resetCreateForm()
  isCreateOpen.value = false
  navigateTo(`/product-planning/${product.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Product Planning"
      description="Katalog Product/Package Template — konsep itinerary, alternatif layanan, inclusions/exclusions, dan validity yang dipakai sebagai basis Cost Sheet."
      :breadcrumb="[{ label: 'Product Planning' }]"
    >
      <template v-if="canManageProduct" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Buat Product Template</Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Product Template Baru</DialogTitle>
              <DialogDescription>Template akan tersimpan sebagai Draft — lengkapi detail lain (alternatif layanan, inclusions/exclusions, validity) di halaman detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="pt-name">Nama Product Template</Label>
                <Input id="pt-name" v-model="newName" placeholder="mis. Bali Team Building Package" />
              </div>
              <div class="space-y-1.5">
                <Label for="pt-destination">Destinasi</Label>
                <Input id="pt-destination" v-model="newDestination" placeholder="mis. Bali, Indonesia" />
              </div>
              <div class="space-y-1.5">
                <Label>Service Scope</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in SERVICE_TYPES"
                    :key="type.value"
                    type="button"
                    class="px-3 py-1.5 text-xs rounded-lg border transition-colors"
                    :class="newServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-muted/50'"
                    @click="toggleServiceScope(type.value)"
                  >
                    {{ type.label }}
                  </button>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="pt-pax">Basis Traveler-Based Costing (pax)</Label>
                <Input id="pt-pax" v-model.number="newBasePaxCount" type="number" placeholder="mis. 15" />
              </div>
              <div class="space-y-1.5">
                <Label for="pt-concept">Itinerary Concept (opsional)</Label>
                <textarea id="pt-concept" v-model="newItineraryConcept" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ringkasan konsep perjalanan" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newName.trim() || !newDestination.trim() || newServiceScope.length === 0 || !newBasePaxCount" @click="submitCreate">
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
          <Input v-model="searchQuery" placeholder="Cari nama atau destinasi..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-model="serviceFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Service
          </option>
          <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
      </div>

      <SectionCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Destinasi</TableHead>
              <TableHead>Service Scope</TableHead>
              <TableHead>Basis Pax</TableHead>
              <TableHead>Cost Sheet</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.product.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/product-planning/${row.product.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.product.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.product.destination }}
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <StatusBadge v-for="type in row.product.serviceScope" :key="type" :label="findStatusOption(SERVICE_TYPES, type).label" :tone="findStatusOption(SERVICE_TYPES, type).tone" />
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.product.basePaxCount }} pax
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.costSheetCount }} cost sheet
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="STATUS_OPTIONS.find(o => o.value === row.product.status)?.label ?? row.product.status"
                  :tone="STATUS_OPTIONS.find(o => o.value === row.product.status)?.tone ?? 'neutral'"
                />
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || statusFilter !== 'all' || serviceFilter !== 'all' ? 'Tidak ada Product Template yang cocok dengan filter.' : 'Belum ada Product Template.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
