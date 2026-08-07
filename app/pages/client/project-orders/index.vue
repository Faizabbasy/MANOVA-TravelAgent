<script setup lang="ts">
import ProjectsListPanel from '~/components/client/ProjectsListPanel.vue'
import ParticipantsListPanel from '~/components/client/ParticipantsListPanel.vue'
import ItinerariesListPanel from '~/components/client/ItinerariesListPanel.vue'
import ReservationsListPanel from '~/components/client/ReservationsListPanel.vue'
import TripCenterListPanel from '~/components/client/TripCenterListPanel.vue'
import ChangeRequestsListPanel from '~/components/client/ChangeRequestsListPanel.vue'

/**
 * Client Portal > My Trips (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") —
 * satu menu menampung Projects (dulu `/client/projects`, sekarang dipindah ke sini supaya list dan detail
 * satu segmen path `/client/project-orders`), Participants (dulu `/client/participants`), Itineraries
 * (dulu `/client/itineraries`), Reservations (dulu `/client/reservations`), Trip Center (dulu
 * `/client/trip-center`), dan Change Requests (dulu `/client/change-requests`). Konten tiap section
 * dipindah apa adanya ke `app/components/client/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu
 * halaman scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Detail workspace
 * per-project `/client/project-orders/[id]` sudah punya tab setara untuk sebagian besar konten ini
 * (Participants/Itineraries/Reservations/dst di-scope satu project) — section di sini tetap dipertahankan
 * karena isinya agregasi LINTAS seluruh Project Order company (bukan duplikat), lihat spec konsolidasi menu.
 * Route detail (`/client/project-orders/[id]`, `/client/participants/[id]`, `/client/itineraries/[id]`,
 * `/client/reservations/[type]/[id]/preview`, `/client/trip-center/[projectId]`, `/client/change-requests/[id]`)
 * TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'My Trips' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="My Trips"
      description="Seluruh Project Order, peserta, itinerary, reservasi, trip center, dan change request company Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'My Trips' }]"
    />

    <section id="projects" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Projects
      </h2>
      <ProjectsListPanel />
    </section>

    <Separator />

    <section id="participants" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Participants
      </h2>
      <ParticipantsListPanel />
    </section>

    <Separator />

    <section id="itineraries" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Itineraries
      </h2>
      <ItinerariesListPanel />
    </section>

    <Separator />

    <section id="reservations" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Reservations
      </h2>
      <ReservationsListPanel />
    </section>

    <Separator />

    <section id="trip-center" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Trip Center
      </h2>
      <TripCenterListPanel />
    </section>

    <Separator />

    <section id="change-requests" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Change Requests
      </h2>
      <ChangeRequestsListPanel />
    </section>
  </div>
</template>
