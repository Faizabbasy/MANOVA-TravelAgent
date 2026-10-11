<script setup lang="ts">
import { onMounted } from 'vue'
import AuditTrailPanel from '~/components/admin/AuditTrailPanel.vue'
import ActivityCenterPanel from '~/components/admin/ActivityCenterPanel.vue'
import { loadServerAudit } from '~/data/audit-sync'

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

/* S10a: the Activity Center and session log read the server audit trail; without access the demo data stays. */
const auditApi = useApi()
onMounted(() => { loadServerAudit(auditApi).catch(() => undefined) })
</script>

<template>
  <div class="space-y-6 sm:space-y-8">
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
