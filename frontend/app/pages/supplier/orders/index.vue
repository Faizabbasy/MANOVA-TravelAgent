<script setup lang="ts">
import MyAssignmentsPanel from '~/components/supplier/MyAssignmentsPanel.vue'
import ServiceOrderInboxPanel from '~/components/supplier/ServiceOrderInboxPanel.vue'
import VendorOrdersPanel from '~/components/supplier/VendorOrdersPanel.vue'

/**
 * Vendor Portal > Orders (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") —
 * satu menu menampung Assignment & Quotation Saya (dulu halaman ini sendiri), Service Order Inbox (dulu
 * `/supplier/service-orders`), dan Vendor Orders/Sold Commodities (dulu `/supplier/commodity-orders`).
 * Konten tiap section dipindah apa adanya ke `app/components/supplier/*Panel.vue`. Disusun sebagai section
 * bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 * Route detail (`/supplier/orders/[id]`, `/supplier/service-orders/[id]`, `/supplier/commodity-orders/[id]`)
 * TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Orders' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Orders"
      description="Assignment, Service Order, dan Vendor Orders milik company Anda — dalam satu menu."
      :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Orders' }]"
    />

    <section id="assignments" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Assignments
      </h2>
      <MyAssignmentsPanel />
    </section>

    <Separator />

    <section id="service-orders" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Service Orders
      </h2>
      <ServiceOrderInboxPanel />
    </section>

    <Separator />

    <section id="vendor-orders" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Vendor Orders
      </h2>
      <VendorOrdersPanel />
    </section>
  </div>
</template>
