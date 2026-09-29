<script setup lang="ts">
import TicketingListPanel from '~/components/operations/TicketingListPanel.vue'
import AccommodationListPanel from '~/components/operations/AccommodationListPanel.vue'
import TransportationListPanel from '~/components/operations/TransportationListPanel.vue'
import MiceListPanel from '~/components/operations/MiceListPanel.vue'

/**
 * Operations > Service Operations (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling
 * ngalir") — satu menu menampung 4 list booking yang dulu terpisah (`/ticketing`, `/accommodation`,
 * `/transportation`, `/mice`) tapi berstruktur identik. Konten tiap section dipindah apa adanya ke
 * `app/components/operations/*ListPanel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll
 * (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Route DETAIL (`/ticketing/[id]`,
 * dst.) TIDAK berubah — hanya list-nya yang digabung.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Service Operations' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Service Operations"
      description="Flight, Hotel, Transportation, dan MICE booking — dalam satu menu."
      :breadcrumb="[{ label: 'Service Operations' }]"
    />

    <section id="ticketing" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Ticketing
      </h2>
      <TicketingListPanel />
    </section>

    <Separator />

    <section id="accommodation" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Accommodation
      </h2>
      <AccommodationListPanel />
    </section>

    <Separator />

    <section id="transportation" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Transportation
      </h2>
      <TransportationListPanel />
    </section>

    <Separator />

    <section id="mice" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        MICE
      </h2>
      <MiceListPanel />
    </section>
  </div>
</template>
