<script setup lang="ts">
import AuditTrailPanel from '~/components/admin/AuditTrailPanel.vue'
import ActivityCenterPanel from '~/components/admin/ActivityCenterPanel.vue'

/**
 * Administration > Audit & Activity (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Audit Trail (dulu halaman ini sendiri) dan Activity Center (dulu
 * top-level `/activity-center`). Konten tiap section dipindah apa adanya ke `app/components/admin/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`. Gerbang akses KEDUA section TETAP berbeda (Audit Trail: `canView('administration')`;
 * Activity Center: capability `admin.view-activity-center`, Super Admin saja by default) — masing-masing
 * panel mempertahankan gate aslinya sendiri.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Audit & Activity' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Audit & Activity"
      description="Log aktivitas project dan log sistem lintas-modul — dalam satu menu."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Audit & Activity' }]"
    />

    <section id="audit-trail" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Audit Trail
      </h2>
      <AuditTrailPanel />
    </section>

    <Separator />

    <section id="activity-center" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Activity Center
      </h2>
      <ActivityCenterPanel />
    </section>
  </div>
</template>
