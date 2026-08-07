<script setup lang="ts">
import ReportsOperationalPanel from '~/components/reports/ReportsOperationalPanel.vue'
import ReportsAnalyticsPanel from '~/components/reports/ReportsAnalyticsPanel.vue'

/**
 * Reporting & BI > Reports (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") —
 * satu menu menampung 7 section operasional (dulu halaman ini sendiri) dan Analytics & Marketing ROI (dulu
 * `/reports/analytics`). Konten tiap section dipindah apa adanya ke `app/components/reports/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Reports' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Reports"
      description="Laporan operasional lintas-modul dan Analytics & Marketing ROI — dalam satu menu."
      :breadcrumb="[{ label: 'Reports' }]"
    />

    <section id="operational" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Operasional
      </h2>
      <ReportsOperationalPanel />
    </section>

    <Separator />

    <section id="analytics" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Analytics & Marketing ROI
      </h2>
      <ReportsAnalyticsPanel />
    </section>
  </div>
</template>
