<script setup lang="ts">
import { computed } from 'vue'
import { Building2, Package, FileText, ClipboardList, Send, Bell, Layers, UploadCloud, PackageX } from 'lucide-vue-next'
import { getVendorById, getServicesByVendor, getVendorQuotations, getVendorProducts, getRfqsForVendor, getServiceOrdersByVendor, getSupplierInvoicesByServiceOrder, getCommodityProductsByVendor } from '~/data'

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

const pendingQuotationCount = computed(() => quotations.value.filter(q => q.status === 'submitted').length)
const rfqNeedingResponseCount = computed(() => rfqs.value.filter(rfq => ['sent', 'responses-in', 'comparison', 'clarification'].includes(rfq.status)).length)
const activeServiceOrderCount = computed(() => serviceOrders.value.filter(so => !['fulfilled', 'cancelled'].includes(so.status)).length)

/** Commodity summary (Phase 2 — Client–Vendor Commodity) — dihitung real dari `getCommodityProductsByVendor`, mengisi gap "Belum Ada" pada audit Phase 0 (Section Vendor Dashboard). */
const commodities = computed(() => (vendorScopeId.value ? getCommodityProductsByVendor(vendorScopeId.value) : []))
const draftCommodityCount = computed(() => commodities.value.filter(c => c.status === 'draft').length)
const publishedCommodityCount = computed(() => commodities.value.filter(c => ['published', 'available', 'limited'].includes(c.status)).length)
const soldOutCommodityCount = computed(() => commodities.value.filter(c => c.status === 'sold-out').length)

/**
 * Action Center (Section 22) — mengagregasi item actionable milik vendor login, seluruhnya reuse selector
 * Section 17 (`rfqs`/`serviceOrders` di atas, `getSupplierInvoicesByServiceOrder` baru diimpor) yang sudah
 * di-scope `vendorScopeId` — pola sama `app/pages/client/index.vue` (Action Center Client Portal).
 * TIDAK membuat data/entitas baru, murni derivasi read-only dari `RFQ`/`ServiceOrder`/`SupplierInvoice`.
 */
const actionItems = computed(() => {
  const items: { key: string; label: string; to: string; tone: 'warning' | 'destructive' }[] = []
  for (const rfq of rfqs.value) {
    if (['sent', 'responses-in'].includes(rfq.status)) {
      items.push({ key: `rfq-respond-${rfq.id}`, label: `RFQ "${rfq.title}" menunggu respons Anda`, to: `/supplier/rfq/${rfq.id}`, tone: 'warning' })
    } else if (rfq.status === 'clarification') {
      items.push({ key: `rfq-clarify-${rfq.id}`, label: `Klarifikasi terbuka pada RFQ "${rfq.title}"`, to: `/supplier/rfq/${rfq.id}`, tone: 'warning' })
    }
  }
  for (const so of serviceOrders.value) {
    if (so.status === 'sent') {
      items.push({ key: `so-ack-${so.id}`, label: `Service Order ${so.id} menunggu acknowledgment Anda`, to: `/supplier/service-orders/${so.id}`, tone: 'warning' })
    } else if (so.status === 'fulfilled' && getSupplierInvoicesByServiceOrder(so.id).length === 0) {
      items.push({ key: `so-invoice-${so.id}`, label: `Service Order ${so.id} sudah fulfilled — ajukan invoice Anda`, to: `/supplier/service-orders/${so.id}`, tone: 'destructive' })
    }
  }
  return items
})
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

      <SectionCard title="Ringkasan Komoditas" description="Commodity Product milik company Anda.">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Komoditas" :value="String(commodities.length)" :icon="Layers" />
          <StatsCard title="Draft" :value="String(draftCommodityCount)" :icon="Package" />
          <StatsCard title="Published" :value="String(publishedCommodityCount)" :icon="UploadCloud" icon-color="success" />
          <StatsCard title="Sold Out" :value="String(soldOutCommodityCount)" :icon="PackageX" icon-color="destructive" />
        </div>
      </SectionCard>

      <SectionCard title="Action Center" description="Hal-hal yang perlu tindakan Anda.">
        <ul v-if="actionItems.length" class="divide-y divide-border">
          <li v-for="item in actionItems" :key="item.key" class="py-3">
            <NuxtLink :to="item.to" class="flex items-center gap-3 group">
              <Bell class="h-4 w-4 shrink-0" :class="item.tone === 'destructive' ? 'text-destructive' : 'text-warning'" />
              <span class="text-sm text-foreground group-hover:underline">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Bell" title="Tidak ada tindakan yang perlu dilakukan saat ini" />
      </SectionCard>

      <SectionCard title="Profil Company">
        <DetailMetadataList
          :items="[
            { label: 'Nama Company', value: vendor.name },
            { label: 'Jenis Layanan Utama', value: vendor.serviceType },
            { label: 'Contact', value: vendor.contactName },
          ]"
        />
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NuxtLink to="/supplier/commodities">
          <SectionCard title="Kelola Komoditas" :description="`${commodities.length} komoditas — publish, variant, dan availability.`">
            <Layers class="h-5 w-5 text-muted-foreground" />
          </SectionCard>
        </NuxtLink>
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
