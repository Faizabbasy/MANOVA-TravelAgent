<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Package, FileText, CheckCircle2 } from 'lucide-vue-next'
import { getVendorById, getServicesByVendor, getVendorQuotations, getVendorProducts } from '~/data'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Supplier Portal' })

const { canView, vendorScopeId } = usePermissions()

/** Vendor isolation (Prompt 19) — seluruh data di halaman ini di-scope ke `vendorScopeId` (vendor company milik user login), tidak pernah membaca `VENDORS` penuh. */
const vendor = computed(() => (vendorScopeId.value ? getVendorById(vendorScopeId.value) : undefined))
const assignments = computed(() => (vendorScopeId.value ? getServicesByVendor(vendorScopeId.value) : []))
const quotations = computed(() => (vendorScopeId.value ? getVendorQuotations(vendorScopeId.value) : []))
const products = computed(() => (vendorScopeId.value ? getVendorProducts(vendorScopeId.value) : []))

const acceptedQuotationCount = computed(() => quotations.value.filter(q => q.status === 'accepted').length)
const pendingQuotationCount = computed(() => quotations.value.filter(q => q.status === 'submitted').length)
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
        <StatsCard title="Quotation Menunggu" :value="String(pendingQuotationCount)" :icon="FileText" icon-color="warning" />
        <StatsCard title="Quotation Diterima" :value="String(acceptedQuotationCount)" :icon="CheckCircle2" icon-color="success" />
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
      </div>
    </template>
  </div>
</template>
