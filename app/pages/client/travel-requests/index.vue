<script setup lang="ts">
import TravelRequestsListPanel from '~/components/client/TravelRequestsListPanel.vue'
import QuotationsListPanel from '~/components/client/QuotationsListPanel.vue'
import ApprovalsListPanel from '~/components/client/ApprovalsListPanel.vue'

/**
 * Client Portal > Request & Approval (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung Travel Requests (dulu halaman ini sendiri), Quotations & Proposals (dulu
 * `/client/quotations`), dan Approval Center (dulu `/client/approvals`). Konten tiap section dipindah apa
 * adanya ke `app/components/client/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman
 * scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Route detail
 * (`/client/travel-requests/[id]`, `/new`, `/[id]/edit`, `/client/quotations/[id]`, `/[id]/preview`,
 * `/client/approvals/[id]`) TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Request & Approval' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Request & Approval"
      description="Ajukan Travel Request, pantau Quotation, dan putuskan Approval — dalam satu menu."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Approval' }]"
    />

    <section id="travel-requests" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Travel Requests
      </h2>
      <TravelRequestsListPanel />
    </section>

    <Separator />

    <section id="quotations" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Quotations
      </h2>
      <QuotationsListPanel />
    </section>

    <Separator />

    <section id="approvals" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Approvals
      </h2>
      <ApprovalsListPanel />
    </section>
  </div>
</template>
