<script setup lang="ts">
import DashboardOverviewPanel from '~/components/client/DashboardOverviewPanel.vue'
import NotificationsPanel from '~/components/client/NotificationsPanel.vue'

/**
 * Client Portal > Dashboard (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir")
 * — satu menu menampung Overview (dulu halaman ini sendiri, seluruh isi) dan Notifications (dulu
 * `/client/notifications`). Konten tiap section dipindah apa adanya ke `app/components/client/*Panel.vue`.
 * Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id`
 * untuk deep-link `#section`. `/client` tetap jadi root Client Portal.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Client Portal' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Client Portal"
      description="Ringkasan aktivitas dan notifikasi Anda."
      :breadcrumb="[{ label: 'Client Portal' }]"
    />

    <section id="overview" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Overview
      </h2>
      <DashboardOverviewPanel />
    </section>

    <Separator />

    <section id="notifications" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Notifications
      </h2>
      <NotificationsPanel />
    </section>
  </div>
</template>
