<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus } from 'lucide-vue-next'
import { VENDORS, getServicesByVendor, createVendor } from '~/data'
import { SERVICE_TYPES, VENDOR_STATUSES, findStatusOption } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Vendors' })

const { canView, canManage } = usePermissions()
const canManageVendor = computed(() => canManage('vendor'))

const searchQuery = ref('')
const serviceTypeFilter = ref('all')

const rows = computed(() => {
  let result = VENDORS.map(vendor => ({
    vendor,
    activeAssignmentCount: getServicesByVendor(vendor.id).length
  }))

  if (serviceTypeFilter.value !== 'all') {
    result = result.filter(row => row.vendor.serviceType === serviceTypeFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(row => row.vendor.name.toLowerCase().includes(q))
  }
  return result
})

const isCreateOpen = ref(false)
const newName = ref('')
const newServiceType = ref<ServiceTypeKey>('flight')
const newContactName = ref('')
const newContactPhone = ref('')
const newCategory = ref('')

function resetCreateForm () {
  newName.value = ''
  newServiceType.value = 'flight'
  newContactName.value = ''
  newContactPhone.value = ''
  newCategory.value = ''
}

function submitCreate () {
  if (!newName.value.trim() || !newContactName.value.trim()) { return }
  const vendor = createVendor({
    name: newName.value.trim(),
    serviceType: newServiceType.value,
    contactName: newContactName.value.trim(),
    contactPhone: newContactPhone.value.trim() || undefined,
    category: newCategory.value.trim() || undefined
  })
  resetCreateForm()
  isCreateOpen.value = false
  navigateTo(`/vendors/${vendor.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Vendors"
      description="Direktori vendor lintas-project (flight, hotel, transportation, MICE, additional service)."
      :breadcrumb="[{ label: 'Vendors' }]"
    >
      <template v-if="canManageVendor" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />Tambah Vendor</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Vendor Baru</DialogTitle>
              <DialogDescription>Vendor baru akan tersedia untuk ditugaskan ke service project.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="vendor-name">Nama Vendor</Label>
                <Input id="vendor-name" v-model="newName" placeholder="mis. CV Nama Perusahaan" />
              </div>
              <div class="space-y-1.5">
                <Label for="vendor-type">Jenis Layanan</Label>
                <select
                  id="vendor-type"
                  v-model="newServiceType"
                  class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="vendor-category">Kategori (opsional)</Label>
                <Input id="vendor-category" v-model="newCategory" placeholder="mis. Hotel Budget, MICE Full-Service" />
              </div>
              <div class="space-y-1.5">
                <Label for="vendor-contact-name">Nama Contact</Label>
                <Input id="vendor-contact-name" v-model="newContactName" placeholder="Nama contact utama" />
              </div>
              <div class="space-y-1.5">
                <Label for="vendor-contact-phone">Telepon (opsional)</Label>
                <Input id="vendor-contact-phone" v-model="newContactPhone" placeholder="08xx-xxxx-xxxx" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">
                Batal
              </Button>
              <Button :disabled="!newName.trim() || !newContactName.trim()" @click="submitCreate">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('vendor')" module-label="modul Vendors" />

    <template v-else>
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama vendor..." class="pl-9" />
        </div>
        <select
          v-model="serviceTypeFilter"
          class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          <option value="all">
            Semua Jenis Layanan
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
              <TableHead>Vendor</TableHead>
              <TableHead>Jenis Layanan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Penugasan Aktif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.vendor.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/vendors/${row.vendor.id}`)">
              <TableCell class="font-medium text-foreground">
                {{ row.vendor.name }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(SERVICE_TYPES, row.vendor.serviceType).label"
                  :tone="findStatusOption(SERVICE_TYPES, row.vendor.serviceType).tone"
                />
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.vendor.category ?? '—' }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(VENDOR_STATUSES, row.vendor.status ?? 'active').label"
                  :tone="findStatusOption(VENDOR_STATUSES, row.vendor.status ?? 'active').tone"
                />
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.vendor.contactName }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ row.activeAssignmentCount }} service
              </TableCell>
            </TableRow>
            <TableEmpty v-if="rows.length === 0" :colspan="6">
              {{ searchQuery || serviceTypeFilter !== 'all' ? 'Tidak ada vendor yang cocok dengan filter.' : 'Belum ada vendor.' }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
