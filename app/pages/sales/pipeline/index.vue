<script setup lang="ts">
import SalesFunnelPanel from '~/components/sales/SalesFunnelPanel.vue'
import SalesLeadsPanel from '~/components/sales/SalesLeadsPanel.vue'
import SalesQuotationsPanel from '~/components/sales/SalesQuotationsPanel.vue'

/**
 * Sales > Pipeline (revisi "satu menu tanpa tab tapi saling ngalir") — satu menu menampung seluruh corong
 * Lead → Quotation yang sebelumnya tersebar di 2 modul (Sales: Leads/Opportunities/Quotation & Invoice;
 * CRM: Customer Journey/Lead Source Recap). Section "Opportunities" DIHAPUS (entitas Opportunity dihapus —
 * lihat komentar desain di `app/types/lead.ts`) — status quotation per Lead sekarang tampil langsung
 * sebagai kolom di `SalesLeadsPanel`, bukan panel terpisah. Disusun sebagai section bertumpuk dalam satu
 * halaman scroll (BUKAN `<Tabs>`) — setiap section punya `id` untuk deep-link `#section`, dipakai redirect
 * route lama (lihat `app/pages/customer-journey/**`, `app/pages/crm/**`) supaya bookmark/link lama tidak
 * 404, browser otomatis scroll ke section yang dituju.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Sales Pipeline' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Sales Pipeline"
      description="Lead → Qualified → Quotation → Management Approval → Won, dalam satu menu."
      :breadcrumb="[{ label: 'Sales Pipeline' }]"
    />

    <section id="leads" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Leads
      </h2>
      <SalesLeadsPanel />
    </section>

    <Separator />

    <section id="funnel" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Funnel
      </h2>
      <SalesFunnelPanel />
    </section>

    <Separator />

    <section id="quotations" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Quotation
      </h2>
      <SalesQuotationsPanel />
    </section>
  </div>
</template>
