<script setup lang="ts">
import ReportsAnalyticsPanel from '~/components/client/ReportsAnalyticsPanel.vue'
import FeedbackListPanel from '~/components/client/FeedbackListPanel.vue'

/**
 * Client Portal > Reports & Feedback (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Reports & Analytics (dulu halaman ini sendiri) dan Feedback & Evaluation
 * (dulu `/client/feedback`). Konten tiap section dipindah apa adanya ke `app/components/client/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`. Route detail `/client/feedback/[projectId]` TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Reports & Feedback' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Reports & Feedback"
      description="Laporan, analitik, dan penilaian layanan company Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Reports & Feedback' }]"
    />

    <section id="reports" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Reports
      </h2>
      <ReportsAnalyticsPanel />
    </section>

    <Separator />

    <section id="feedback" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Feedback
      </h2>
      <FeedbackListPanel />
    </section>
  </div>
</template>
