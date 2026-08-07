<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getVendorById, getVendorContacts, getVendorQuotations, getVendorActivities, getServicesByVendor,
  createVendorContact, submitVendorQuotation, updateVendor,
  getProjectById, PROJECTS, getProjectServices,
  getVendorProducts, createVendorProduct,
  getVendorDocuments, createVendorDocument
} from '~/data'
import { SERVICE_TYPES, SERVICE_STATUSES, VENDOR_QUOTATION_STATUSES, VENDOR_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { VendorDetailTab } from '~/types/vendor'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const canManageVendor = computed(() => canManage('vendor'))

const vendor = computed(() => getVendorById(String(route.params.id)))
useHead({ title: computed(() => vendor.value ? vendor.value.name : 'Vendor Tidak Ditemukan') })

const contacts = computed(() => (vendor.value ? getVendorContacts(vendor.value.id) : []))
const quotations = computed(() => (vendor.value ? getVendorQuotations(vendor.value.id) : []))
const activities = computed(() => (vendor.value ? getVendorActivities(vendor.value.id) : []))
const assignedServices = computed(() => (vendor.value ? getServicesByVendor(vendor.value.id) : []))
/** Products (Prompt 19 — Change Request, area Supplier/External Partners) — katalog produk/layanan vendor, sama dengan `/supplier/products` (self-service oleh supplier user sendiri). */
const products = computed(() => (vendor.value ? getVendorProducts(vendor.value.id) : []))

const activeTab = computed<VendorDetailTab>({
  get: () => (route.query.tab as VendorDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

const TABS: { value: VendorDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'services', label: 'Services' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'products', label: 'Products' },
  { value: 'documents', label: 'Documents' },
  { value: 'contacts', label: 'Contacts' }
]

/** Dokumen (Section 17) — preview mock (D-006), tab "Documents". */
const documents = computed(() => (vendor.value ? getVendorDocuments(vendor.value.id) : []))

const summaryMetadata = computed(() => {
  if (!vendor.value) { return [] }
  return [
    { label: 'Jenis Layanan', value: findStatusOption(SERVICE_TYPES, vendor.value.serviceType).label },
    { label: 'Kategori', value: vendor.value.category ?? '—' },
    { label: 'Contact Utama', value: `${vendor.value.contactName}${vendor.value.contactPhone ? ` · ${vendor.value.contactPhone}` : ''}` },
    { label: 'Jumlah Contact', value: String(contacts.value.length) },
    { label: 'Penugasan Aktif', value: `${assignedServices.value.length} service` },
    { label: 'Jumlah Quotation', value: String(quotations.value.length) },
    { label: 'Jumlah Dokumen', value: String(documents.value.length) }
  ]
})

/* Edit category/status (Section 17) */
const isVendorEditOpen = ref(false)
const editCategory = ref('')
const editStatus = ref<'active' | 'inactive' | 'pending'>('active')
function openVendorEdit () {
  if (!vendor.value) { return }
  editCategory.value = vendor.value.category ?? ''
  editStatus.value = vendor.value.status ?? 'active'
  isVendorEditOpen.value = true
}
function submitVendorEdit () {
  if (!vendor.value) { return }
  updateVendor(vendor.value.id, { category: editCategory.value.trim() || undefined, status: editStatus.value })
  isVendorEditOpen.value = false
}

/* Tambah Document (Section 17) */
const isDocumentDialogOpen = ref(false)
const documentName = ref('')
const documentType = ref('')
function submitDocument () {
  if (!vendor.value || !documentName.value.trim() || !documentType.value.trim()) { return }
  createVendorDocument({ vendorId: vendor.value.id, name: documentName.value.trim(), type: documentType.value.trim() })
  documentName.value = ''
  documentType.value = ''
  isDocumentDialogOpen.value = false
}

function projectName (projectId: string) {
  return getProjectById(projectId)?.name ?? projectId
}

/* Tambah Contact */
const isContactDialogOpen = ref(false)
const contactName = ref('')
const contactTitle = ref('')
const contactEmail = ref('')
const contactPhone = ref('')

/* Tambah Product (Prompt 19) */
const isProductDialogOpen = ref(false)
const productName = ref('')
const productCategory = ref<ServiceTypeKey>('hotel')
const productDescription = ref('')
const productPrice = ref<number | null>(null)

function submitProduct () {
  if (!vendor.value || !productName.value.trim()) { return }
  createVendorProduct({
    vendorId: vendor.value.id,
    name: productName.value.trim(),
    category: productCategory.value,
    description: productDescription.value.trim() || undefined,
    priceIdr: productPrice.value ?? undefined
  })
  productName.value = ''
  productCategory.value = 'hotel'
  productDescription.value = ''
  productPrice.value = null
  isProductDialogOpen.value = false
}

function submitContact () {
  if (!vendor.value || !contactName.value.trim() || !contactTitle.value.trim()) { return }
  createVendorContact({
    vendorId: vendor.value.id,
    name: contactName.value.trim(),
    title: contactTitle.value.trim(),
    email: contactEmail.value.trim() || undefined,
    phone: contactPhone.value.trim() || undefined
  })
  contactName.value = ''
  contactTitle.value = ''
  contactEmail.value = ''
  contactPhone.value = ''
  isContactDialogOpen.value = false
}

/* Submit Quotation */
const isQuotationDialogOpen = ref(false)
const quotationProjectId = ref('')
const quotationServiceId = ref('')
const quotationAmount = ref('')
const quotationNotes = ref('')

const quotationServiceOptions = computed(() => {
  if (!quotationProjectId.value || !vendor.value) { return [] }
  return getProjectServices(quotationProjectId.value).filter(service => service.type === vendor.value!.serviceType)
})

function resetQuotationForm () {
  quotationProjectId.value = ''
  quotationServiceId.value = ''
  quotationAmount.value = ''
  quotationNotes.value = ''
}

function submitQuotation () {
  if (!vendor.value || !quotationProjectId.value || !quotationAmount.value) { return }
  const amountIdr = Number(quotationAmount.value)
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) { return }
  submitVendorQuotation({
    vendorId: vendor.value.id,
    projectId: quotationProjectId.value,
    serviceId: quotationServiceId.value || undefined,
    serviceType: vendor.value.serviceType,
    amountIdr,
    notes: quotationNotes.value.trim() || undefined
  })
  resetQuotationForm()
  isQuotationDialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!vendor">
      <PageHeader title="Vendor Tidak Ditemukan" :breadcrumb="[{ label: 'Vendors', to: '/vendors' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Vendor tidak ditemukan"
          :description="`Vendor dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/vendors')">
            Kembali ke Daftar Vendor
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('vendor')" module-label="modul Vendors" />

    <template v-else>
      <PageHeader
        :title="vendor.name"
        :breadcrumb="[{ label: 'Vendors', to: '/vendors' }, { label: vendor.name }]"
      >
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge
              :label="findStatusOption(SERVICE_TYPES, vendor.serviceType).label"
              :tone="findStatusOption(SERVICE_TYPES, vendor.serviceType).tone"
            />
            <StatusBadge
              :label="findStatusOption(VENDOR_STATUSES, vendor.status ?? 'active').label"
              :tone="findStatusOption(VENDOR_STATUSES, vendor.status ?? 'active').tone"
            />
            <Button v-if="canManageVendor" size="sm" variant="outline" @click="openVendorEdit">
              Edit Kategori/Status
            </Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard title="Aktivitas Terbaru">
            <ul v-if="activities.length" class="divide-y divide-border">
              <li v-for="activity in activities.slice(0, 5)" :key="activity.id" class="py-3">
                <p class="text-sm text-foreground">
                  {{ activity.message }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ formatDate(activity.createdAt) }}
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada aktivitas tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="services">
          <SectionCard title="Services" description="Service project yang ditugaskan ke vendor ini (Section 12).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Detail Service</TableHead>
                  <TableHead>Booking Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="service in assignedServices" :key="service.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/project-orders/${service.projectId}?tab=itinerary-services`)">
                  <TableCell class="font-medium text-foreground">
                    {{ projectName(service.projectId) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ service.label }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ service.bookingReference ?? '—' }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(SERVICE_STATUSES, service.status).label"
                      :tone="findStatusOption(SERVICE_STATUSES, service.status).tone"
                    />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="assignedServices.length === 0" :colspan="4">
                  Belum ada service yang ditugaskan ke vendor ini.
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="quotations">
          <SectionCard title="Quotations">
            <template #actions>
              <Dialog v-if="canManageVendor" v-model:open="isQuotationDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Submit Quotation
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Submit Quotation Baru</DialogTitle>
                    <DialogDescription>Quotation akan diajukan untuk {{ vendor.name }} — keputusan Accept/Reject dilakukan di tab "Vendors" Project Detail.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="quotation-project">Project</Label>
                      <select
                        id="quotation-project"
                        v-model="quotationProjectId"
                        class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                      >
                        <option value="" disabled>
                          Pilih project
                        </option>
                        <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
                          {{ project.name }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="quotation-service">Service (opsional)</Label>
                      <select
                        id="quotation-service"
                        v-model="quotationServiceId"
                        :disabled="!quotationProjectId"
                        class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer disabled:opacity-50"
                      >
                        <option value="">
                          Belum terhubung ke service spesifik
                        </option>
                        <option v-for="service in quotationServiceOptions" :key="service.id" :value="service.id">
                          {{ service.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="quotation-amount">Nilai Quotation (Rp)</Label>
                      <Input id="quotation-amount" v-model="quotationAmount" type="number" placeholder="mis. 45000000" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="quotation-notes">Catatan (opsional)</Label>
                      <Input id="quotation-notes" v-model="quotationNotes" placeholder="mis. Termasuk sopir dan bahan bakar" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isQuotationDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!quotationProjectId || !quotationAmount" @click="submitQuotation">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Jenis Layanan</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Diajukan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="quotation in quotations" :key="quotation.id">
                  <TableCell class="font-medium text-foreground">
                    {{ projectName(quotation.projectId) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(SERVICE_TYPES, quotation.serviceType).label"
                      :tone="findStatusOption(SERVICE_TYPES, quotation.serviceType).tone"
                    />
                  </TableCell>
                  <TableCell class="text-foreground">
                    {{ formatCurrencyIdr(quotation.amountIdr) }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(quotation.submittedAt) }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).label"
                      :tone="findStatusOption(VENDOR_QUOTATION_STATUSES, quotation.status).tone"
                    />
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="quotations.length === 0" :colspan="5">
                  Belum ada quotation untuk vendor ini.
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="products">
          <SectionCard title="Products" description="Katalog produk/layanan milik vendor ini (Prompt 19).">
            <template #actions>
              <Dialog v-if="canManageVendor" v-model:open="isProductDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Tambah Produk
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Produk/Layanan Baru</DialogTitle>
                    <DialogDescription>Produk baru akan tampil di katalog {{ vendor.name }}.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="vp-name">Nama Produk/Layanan</Label>
                      <Input id="vp-name" v-model="productName" placeholder="mis. Paket Kamar Deluxe" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vp-category">Kategori</Label>
                      <select id="vp-category" v-model="productCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                        <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                          {{ type.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vp-description">Deskripsi (opsional)</Label>
                      <Input id="vp-description" v-model="productDescription" placeholder="Deskripsi singkat" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vp-price">Harga per Unit (Rp, opsional)</Label>
                      <Input id="vp-price" v-model.number="productPrice" type="number" placeholder="mis. 1200000" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isProductDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!productName.trim()" @click="submitProduct">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Produk/Layanan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Harga</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="product in products" :key="product.id">
                  <TableCell class="font-medium text-foreground">
                    {{ product.name }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(SERVICE_TYPES, product.category).label" :tone="findStatusOption(SERVICE_TYPES, product.category).tone" /></TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ product.description ?? '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ product.priceIdr ? formatCurrencyIdr(product.priceIdr) : '—' }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="products.length === 0" :colspan="4">
                  Belum ada produk/layanan untuk vendor ini.
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents" description="Dokumen vendor (kontrak, sertifikasi, NPWP, dsb.) — preview mock, bukan file upload nyata.">
            <template #actions>
              <Dialog v-if="canManageVendor" v-model:open="isDocumentDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Tambah Dokumen
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Dokumen Baru</DialogTitle>
                    <DialogDescription>Preview mock — bukan file upload nyata (D-006).</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="vdoc-name">Nama Dokumen</Label>
                      <Input id="vdoc-name" v-model="documentName" placeholder="mis. Kontrak Kerjasama 2026.pdf" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vdoc-type">Tipe</Label>
                      <Input id="vdoc-type" v-model="documentType" placeholder="mis. Kontrak, NPWP, Sertifikasi" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isDocumentDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!documentName.trim() || !documentType.trim()" @click="submitDocument">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Dokumen</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Diunggah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="document in documents" :key="document.id">
                  <TableCell class="font-medium text-foreground">
                    {{ document.name }}
                  </TableCell>
                  <TableCell><StatusBadge :label="document.type" tone="neutral" /></TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(document.uploadedAt) }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="documents.length === 0" :colspan="3">
                  Belum ada dokumen untuk vendor ini.
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="contacts">
          <SectionCard title="Contacts">
            <template #actions>
              <Dialog v-if="canManageVendor" v-model:open="isContactDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Tambah Contact
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Contact Baru</DialogTitle>
                    <DialogDescription>Contact akan ditambahkan untuk {{ vendor.name }}.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="vc-name">Nama</Label>
                      <Input id="vc-name" v-model="contactName" placeholder="Nama contact person" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vc-title">Jabatan</Label>
                      <Input id="vc-title" v-model="contactTitle" placeholder="mis. Account Manager" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vc-email">Email (opsional)</Label>
                      <Input id="vc-email" v-model="contactEmail" type="email" placeholder="nama@vendor.com" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="vc-phone">Telepon (opsional)</Label>
                      <Input id="vc-phone" v-model="contactPhone" placeholder="08xx-xxxx-xxxx" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isContactDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!contactName.trim() || !contactTitle.trim()" @click="submitContact">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <ul class="divide-y divide-border">
              <li v-for="contact in contacts" :key="contact.id" class="py-3">
                <p class="text-sm font-medium text-foreground">
                  {{ contact.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ contact.title }}<template v-if="contact.email">
                    · {{ contact.email }}
                  </template><template v-if="contact.phone">
                    · {{ contact.phone }}
                  </template>
                </p>
              </li>
            </ul>
            <EmptyState v-if="contacts.length === 0" title="Belum ada contact tercatat" />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <!-- Edit kategori/status vendor (Section 17) -->
      <Dialog v-model:open="isVendorEditOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Kategori/Status Vendor</DialogTitle>
            <DialogDescription>Kategori sourcing dan lifecycle vendor sebagai partner.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="edit-vendor-category">Kategori</Label>
              <Input id="edit-vendor-category" v-model="editCategory" placeholder="mis. Hotel Budget, MICE Full-Service" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-vendor-status">Status</Label>
              <select id="edit-vendor-status" v-model="editStatus" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="option in VENDOR_STATUSES" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isVendorEditOpen = false">
              Batal
            </Button>
            <Button @click="submitVendorEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
