<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Package, FileText, ClipboardList, Send } from 'lucide-vue-next'
import { getVendorById, getServicesByVendor, getVendorQuotations, getVendorProducts, getRfqsForVendor, getServiceOrdersByVendor } from '~/data'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Supplier Portal' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Prompt 19) — seluruh data di halaman ini di-scope ke `vendorScopeId` (vendor company milik user login), tidak pernah membaca `VENDORS` penuh. */
const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))
const assignments = computed(() => (vendorScopeId.value ? getServicesByVendor(vendorScopeId.value) : []))
const quotations = computed(() => (vendorScopeId.value ? getVendorQuotations(vendorScopeId.value) : []))
const products = computed(() => (vendorScopeId.value ? getVendorProducts(vendorScopeId.value) : []))
/** RFQ Inbox dan Service Orders (Section 17) — di-scope `vendorScopeId`, pola sama data existing di atas. */
const rfqs = computed(() => (vendorScopeId.value ? getRfqsForVendor(vendorScopeId.value) : []))
const serviceOrders = computed(() => (vendorScopeId.value ? getServiceOrdersByVendor(vendorScopeId.value) : []))

const acceptedQuotationCount = computed(() => quotations.value.filter(q => q.status === 'accepted').length)
const pendingQuotationCount = computed(() => quotations.value.filter(q => q.status === 'submitted').length)
const rfqNeedingResponseCount = computed(() => rfqs.value.filter(rfq => ['sent', 'responses-in', 'comparison', 'clarification'].includes(rfq.status)).length)
const activeServiceOrderCount = computed(() => serviceOrders.value.filter(so => !['fulfilled', 'cancelled'].includes(so.status)).length)
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Supplier Portal"
      :description="vendor ? `${vendor.name} — akses terbatas ke company Anda sendiri.` : 'Portal supplier.'"
      :breadcrumb="[{ label: 'Supplier Portal' }]"
    />

    <RoleAccessState v-if="!canView('supplier-portal') || !vendor" module-label="Supplier Portal" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Assignments" :value="String(assignments.length)" :icon="Building2" />
        <StatsCard title="Produk/Layanan" :value="String(products.length)" :icon="Package" />
        <StatsCard title="RFQ Perlu Respons" :value="String(rfqNeedingResponseCount)" :icon="ClipboardList" icon-color="warning" />
        <StatsCard title="Service Order Aktif" :value="String(activeServiceOrderCount)" :icon="Send" icon-color="warning" />
      </div>

      <SectionCard title="Profil Company">
        <DetailMetadataList :items="[
          { label: 'Nama Company', value: vendor.name },
          { label: 'Jenis Layanan Utama', value: vendor.serviceType },
          { label: 'Contact', value: vendor.contactName },
        ]" />
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NuxtLink to="/supplier/products">
          <SectionCard title="Kelola Produk/Layanan" description="Katalog produk/layanan milik company Anda.">
            <Package class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/supplier/orders">
          <SectionCard title="Assignment & Quotation" description="Order/assignment dan status quotation milik company Anda.">
            <FileText class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/supplier/rfq">
          <SectionCard title="RFQ Inbox" :description="`${pendingQuotationCount + rfqNeedingResponseCount} item menunggu respons Anda (RFQ + quotation langsung).`">
            <ClipboardList class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
        <NuxtLink to="/supplier/service-orders">
          <SectionCard title="Service Orders" :description="`${activeServiceOrderCount} Service Order aktif — acknowledge, fulfillment, dan invoice submission.`">
            <Send class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
