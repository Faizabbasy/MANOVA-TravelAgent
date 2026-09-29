<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Megaphone, AlertTriangle, PlaneTakeoff, Building2, Bus, FolderOpen } from 'lucide-vue-next'
import {
  getProjectById, getTripCenterMode, getTripCenterSchedule, getTripCenterMeetingPoint,
  getTripAnnouncementsByProject, confirmTripAnnouncement, getTravelerReadiness,
  getClientReservations, getClientDocumentsByProject, getIncidentsByProject,
  getUserById, getProjectOrderStatus
} from '~/data'
import { PROJECT_ORDER_STATUSES, INCIDENT_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDayLabel, daysUntil } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { BadgeTone } from '~/types/common'

/**
 * Trip Center — Detail (Repair Phase Section 5 — Execution & Changes, Master Prompt bagian 10). Seluruh
 * widget adalah DERIVASI murni dari Project/Itinerary/Reservation/Incident/`TripAnnouncement` existing —
 * TIDAK ada dataset booking/jadwal paralel (`docs/client-page-inventory.md` #10 rekomendasi opsi derivasi).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.projectId)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => project.value ? `Trip Center — ${project.value.name}` : 'Tidak Ditemukan') })

const MODE_LABEL: Record<string, string> = { 'pre-departure': 'Pra-Keberangkatan', active: 'Sedang Berjalan', completed: 'Selesai' }
const MODE_TONE: Record<string, BadgeTone> = { 'pre-departure': 'info', active: 'warning', completed: 'success' }

const mode = computed(() => (project.value ? getTripCenterMode(project.value) : 'pre-departure'))
const schedule = computed(() => (project.value ? getTripCenterSchedule(project.value.id) : { today: [], next: undefined }))
const meetingPoint = computed(() => (project.value ? getTripCenterMeetingPoint(project.value, schedule.value) : undefined))
const projectManager = computed(() => (project.value ? getUserById(project.value.ownerId) : undefined))
const readiness = computed(() => (project.value ? getTravelerReadiness(project.value.id) : undefined))

const countdownLabel = computed(() => {
  if (!project.value) { return '' }
  if (mode.value === 'pre-departure') { return `H-${daysUntil(project.value.travelStartDate, DEMO_REFERENCE_DATE)}` }
  if (mode.value === 'active') {
    const days = daysUntil(project.value.travelEndDate, DEMO_REFERENCE_DATE)
    return days > 0 ? `${days} hari lagi berakhir` : 'Hari terakhir trip'
  }
  return `Selesai ${formatDate(project.value.travelEndDate)}`
})

const flightReservations = computed(() => (project.value ? getClientReservations(project.value.id).filter(r => r.category === 'flight') : []))
const hotelReservations = computed(() => (project.value ? getClientReservations(project.value.id).filter(r => r.category === 'hotel') : []))
const transportReservations = computed(() => (project.value ? getClientReservations(project.value.id).filter(r => r.category === 'transportation') : []))

const announcements = computed(() => (project.value ? getTripAnnouncementsByProject(project.value.id) : []))
function isAnnouncementConfirmed (announcementId: string): boolean {
  return announcements.value.find(item => item.id === announcementId)?.confirmedByUserIds.includes(currentUser.value.id) ?? false
}
function handleConfirmAnnouncement (announcementId: string) {
  confirmTripAnnouncement(announcementId, currentUser.value.id)
  showToast('Pengumuman Dikonfirmasi', 'Terima kasih, konfirmasi Anda telah tercatat.', 'success')
}

const importantDocuments = computed(() => (project.value ? getClientDocumentsByProject(project.value.id) : []))
const openIssues = computed(() => (project.value ? getIncidentsByProject(project.value.id).filter(item => item.status !== 'resolved' && item.status !== 'closed') : []))

function contactPic () {
  if (!projectManager.value) { return }
  window.location.href = `mailto:${projectManager.value.email}`
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" description="Project Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/project-orders#trip-center')">
            Kembali ke Trip Center
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'My Trips' }, { label: 'Trip Center', to: '/client/project-orders#trip-center' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge :label="MODE_LABEL[mode]" :tone="MODE_TONE[mode]" />
          <StatusBadge :label="findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project)).label" :tone="findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project)).tone" />
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard title="Countdown">
          <p class="text-2xl font-bold text-foreground">
            {{ countdownLabel }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ project.destination }} — {{ formatDate(project.travelStartDate) }} s/d {{ formatDate(project.travelEndDate) }}
          </p>
        </SectionCard>
        <SectionCard title="Meeting Point">
          <p class="text-sm text-foreground">
            {{ meetingPoint ?? 'Belum ditentukan' }}
          </p>
        </SectionCard>
        <SectionCard title="Participant Readiness">
          <div class="flex items-center gap-2">
            <Progress :model-value="readiness?.readinessPercent ?? 0" class="flex-1" />
            <span class="text-xs text-muted-foreground shrink-0">{{ readiness?.readinessPercent ?? 0 }}%</span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ readiness?.documentsCompleteCount ?? 0 }}/{{ readiness?.total ?? 0 }} peserta lengkap dokumen
          </p>
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Today's Schedule">
          <ul v-if="schedule.today.length" class="divide-y divide-border">
            <li v-for="item in schedule.today" :key="item.id" class="py-2">
              <p class="text-sm font-medium text-foreground">
                {{ item.time ? `${item.time} — ` : '' }}{{ item.title }}
              </p>
              <p v-if="item.location" class="text-xs text-muted-foreground">
                {{ item.location }}
              </p>
            </li>
          </ul>
          <EmptyState v-else title="Tidak ada jadwal hari ini" description="Belum ada agenda untuk hari ini." />
        </SectionCard>
        <SectionCard title="Next Activity">
          <template v-if="schedule.next">
            <p class="text-sm font-medium text-foreground">
              {{ formatDayLabel(schedule.next.date) }}{{ schedule.next.time ? `, ${schedule.next.time}` : '' }}
            </p>
            <p class="text-sm text-foreground mt-1">
              {{ schedule.next.title }}
            </p>
            <p v-if="schedule.next.location" class="text-xs text-muted-foreground mt-1">
              {{ schedule.next.location }}
            </p>
          </template>
          <EmptyState v-else title="Tidak ada agenda mendatang" />
          <NuxtLink :to="`/client/itineraries/${project.id}`" class="text-xs text-primary hover:underline mt-3 inline-block">
            Lihat itinerary lengkap →
          </NuxtLink>
        </SectionCard>
      </div>

      <SectionCard title="Kontak">
        <DetailMetadataList
          :items="[
            { label: 'Tour Leader', value: project.tourLeaderName ? `${project.tourLeaderName} (${project.tourLeaderPhone ?? '—'})` : 'Belum ditugaskan' },
            { label: 'Manova PIC', value: projectManager?.name ?? 'Belum ditugaskan' },
            { label: 'Emergency Contact', value: project.emergencyContactName ? `${project.emergencyContactName} (${project.emergencyContactPhone ?? '—'})` : 'Belum ditentukan' },
          ]"
        />
        <Button v-if="projectManager" size="sm" variant="outline" class="mt-3" @click="contactPic">
          Contact Manova PIC
        </Button>
      </SectionCard>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SectionCard title="Flight">
          <ul v-if="flightReservations.length" class="space-y-2">
            <li v-for="r in flightReservations" :key="`${r.bookingType}-${r.bookingId}`">
              <p class="text-sm text-foreground truncate">
                {{ r.label }}
              </p>
              <NuxtLink :to="`/client/reservations/${r.bookingType}/${r.bookingId}/preview`" class="text-xs text-primary hover:underline">
                Lihat tiket →
              </NuxtLink>
            </li>
          </ul>
          <EmptyState v-else :icon="PlaneTakeoff" title="Belum ada" />
        </SectionCard>
        <SectionCard title="Hotel">
          <ul v-if="hotelReservations.length" class="space-y-2">
            <li v-for="r in hotelReservations" :key="`${r.bookingType}-${r.bookingId}`">
              <p class="text-sm text-foreground truncate">
                {{ r.label }}
              </p>
              <NuxtLink :to="`/client/reservations/${r.bookingType}/${r.bookingId}/preview`" class="text-xs text-primary hover:underline">
                Lihat voucher →
              </NuxtLink>
            </li>
          </ul>
          <EmptyState v-else :icon="Building2" title="Belum ada" />
        </SectionCard>
        <SectionCard title="Transportation">
          <ul v-if="transportReservations.length" class="space-y-2">
            <li v-for="r in transportReservations" :key="`${r.bookingType}-${r.bookingId}`">
              <p class="text-sm text-foreground truncate">
                {{ r.label }}
              </p>
              <NuxtLink :to="`/client/reservations/${r.bookingType}/${r.bookingId}/preview`" class="text-xs text-primary hover:underline">
                Lihat detail →
              </NuxtLink>
            </li>
          </ul>
          <EmptyState v-else :icon="Bus" title="Belum ada" />
        </SectionCard>
      </div>

      <SectionCard title="Announcements">
        <ul v-if="announcements.length" class="divide-y divide-border">
          <li v-for="item in announcements" :key="item.id" class="py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground">
                  {{ item.title }}
                </p>
                <p class="text-sm text-muted-foreground mt-0.5">
                  {{ item.message }}
                </p>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ formatDate(item.publishedAt) }}
                </p>
              </div>
              <Button v-if="item.requiresConfirmation && !isAnnouncementConfirmed(item.id)" size="sm" @click="handleConfirmAnnouncement(item.id)">
                Confirm
              </Button>
              <StatusBadge v-else-if="item.requiresConfirmation" label="Dikonfirmasi" tone="success" />
            </div>
          </li>
        </ul>
        <EmptyState v-else :icon="Megaphone" title="Tidak ada pengumuman" />
      </SectionCard>

      <SectionCard title="Important Documents">
        <ul v-if="importantDocuments.length" class="divide-y divide-border">
          <li v-for="doc in importantDocuments" :key="doc.id" class="py-2 flex items-center justify-between gap-3">
            <span class="text-sm text-foreground truncate">{{ doc.name }} <span class="text-xs text-muted-foreground">v{{ doc.version }}</span></span>
            <NuxtLink v-if="doc.sourceType === 'generated' && doc.previewRoute" :to="doc.previewRoute" target="_blank" class="text-xs text-primary hover:underline shrink-0">
              Preview →
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="FolderOpen" title="Belum ada dokumen penting" />
        <NuxtLink to="/client/documents" class="text-xs text-primary hover:underline mt-3 inline-block">
          Buka Documents lengkap →
        </NuxtLink>
      </SectionCard>

      <SectionCard title="Open Issues">
        <template #actions>
          <Button size="sm" variant="outline" @click="router.push({ path: '/client/documents', query: { project: project?.id }, hash: '#support' })">
            Create Issue
          </Button>
        </template>
        <ul v-if="openIssues.length" class="divide-y divide-border">
          <li v-for="item in openIssues" :key="item.id" class="py-3">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-foreground">
                {{ item.title }}
              </p>
              <StatusBadge :label="findStatusOption(INCIDENT_STATUSES, item.status).label" :tone="findStatusOption(INCIDENT_STATUSES, item.status).tone" />
            </div>
            <p v-if="item.resolutionNote" class="text-sm text-muted-foreground mt-1">
              {{ item.resolutionNote }}
            </p>
          </li>
        </ul>
        <EmptyState v-else :icon="AlertTriangle" title="Tidak ada issue terbuka" />
      </SectionCard>
    </template>
  </div>
</template>
