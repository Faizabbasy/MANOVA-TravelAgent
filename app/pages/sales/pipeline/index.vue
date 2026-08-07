<script setup lang="ts">
import SalesFunnelPanel from '~/components/sales/SalesFunnelPanel.vue'
import SalesLeadsPanel from '~/components/sales/SalesLeadsPanel.vue'
import SalesOpportunitiesPanel from '~/components/sales/SalesOpportunitiesPanel.vue'
import SalesQuotationsPanel from '~/components/sales/SalesQuotationsPanel.vue'

/**
 * Sales > Pipeline (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") — satu
 * menu menampung seluruh corong Lead → Opportunity → Quotation yang sebelumnya tersebar di 2 modul (Sales:
 * Leads/Opportunities/Quotation & Invoice; CRM: Customer Journey/Lead Source Recap). Konten TIDAK ditulis
 * ulang — dipindah apa adanya ke `app/components/sales/*Panel.vue`. Disusun sebagai section bertumpuk
 * dalam satu halaman scroll (BUKAN `<Tabs>`) — setiap section punya `id` untuk deep-link `#section`, dipakai
 * redirect route lama (lihat `app/pages/customer-journey/**`, `app/pages/crm/**`) supaya bookmark/link
 * lama tidak 404, browser otomatis scroll ke section yang dituju.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Sales Pipeline' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Sales Pipeline"
      description="Lead → Qualified → Opportunity → Quotation → Management Approval → Won, dalam satu menu."
      :breadcrumb="[{ label: 'Sales Pipeline' }]"
    />

    <section id="funnel" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Funnel
      </h2>
      <SalesFunnelPanel />
    </section>

    <Separator />

    <section id="leads" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Leads
      </h2>
      <SalesLeadsPanel />
    </section>

    <Separator />

    <section id="opportunities" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Opportunities
      </h2>
      <SalesOpportunitiesPanel />
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
