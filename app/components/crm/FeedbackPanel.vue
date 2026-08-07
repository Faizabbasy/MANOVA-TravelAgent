<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, MessageSquareWarning, ThumbsUp, CheckCircle2 } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { FEEDBACK_RECORDS, getProjectById, getPartyById, getUserById } from '~/data'
import { FEEDBACK_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatPercentage } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { FeedbackStatus } from '~/types/feedback'

/** Tab "Review & Feedback" — Menu CRM > Engagement (Penyederhanaan 7-Role/Menu). Dulu `/crm/feedback`,
 * kini tab dalam satu menu bersama Follow-up/Loyalty — logika tidak diubah. */

const { canView, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const hasAccess = computed(() => canView('crm'))
const canManage = computed(() => can('crm.manage-follow-up'))

const refreshKey = ref(0)
const statusFilter = ref<'all' | FeedbackStatus>('all')

/**
 * Sisi internal dari feedback klien. Halaman `/client/feedback` yang sudah ada adalah tempat klien
 * MENGISI; halaman ini adalah tempat tim CRM MENINDAKLANJUTI — keduanya membaca `FEEDBACK_RECORDS` yang sama.
 */
const rows = computed(() => {
  void refreshKey.value
  return FEEDBACK_RECORDS
    .map(feedback => ({
      feedback,
      project: getProjectById(feedback.projectId),
      party: getPartyById(feedback.clientPartyId),
      statusOption: findStatusOption(FEEDBACK_STATUSES, feedback.status),
      isDetractor: (feedback.recommendationScore ?? 10) <= 6
    }))
    .sort((a, b) => (b.feedback.submittedAt ?? '').localeCompare(a.feedback.submittedAt ?? ''))
})

const filteredRows = computed(() =>
  (statusFilter.value === 'all' ? rows.value : rows.value.filter(row => row.feedback.status === statusFilter.value)))

const submitted = computed(() => rows.value.filter(row => row.feedback.submittedAt))

const stats = computed(() => {
  const scores = submitted.value.map(row => row.feedback.overallExperience ?? 0).filter(Boolean)
  const promoters = submitted.value.filter(row => (row.feedback.recommendationScore ?? 0) >= 9).length
  const detractors = submitted.value.filter(row => row.isDetractor).length
  return {
    total: submitted.value.length,
    average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
    /** NPS = %promoter − %detractor, dihitung dari `recommendationScore` yang memang skala 0–10. */
    nps: submitted.value.length ? ((promoters - detractors) / submitted.value.length) * 100 : 0,
    needsFollowUp: rows.value.filter(row => row.feedback.status === 'follow-up-required' || (row.isDetractor && !row.feedback.acknowledgedAt)).length
  }
})

const ASPECTS = [
  { key: 'salesResponsiveness', label: 'Responsivitas Sales' },
  { key: 'proposalQuality', label: 'Kualitas Proposal' },
  { key: 'itineraryQuality', label: 'Kualitas Itinerary' },
  { key: 'hotelRating', label: 'Akomodasi' },
  { key: 'transportationRating', label: 'Transportasi' },
  { key: 'tourLeaderRating', label: 'Tour Leader' },
  { key: 'operationSupportRating', label: 'Dukungan Operasional' },
  { key: 'communicationRating', label: 'Komunikasi' },
  { key: 'issueResolutionRating', label: 'Penyelesaian Masalah' },
  { key: 'valueForMoneyRating', label: 'Value for Money' }
] as const

/** Rata-rata per aspek — menunjukkan di mana tepatnya layanan perlu diperbaiki, bukan sekadar skor total. */
const aspectAverages = computed(() => ASPECTS.map((aspect) => {
  const values = submitted.value.map(row => row.feedback[aspect.key] as number | undefined).filter((value): value is number => Boolean(value))
  return {
    ...aspect,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    count: values.length
  }
}).sort((a, b) => a.average - b.average))

function acknowledge (feedbackId: string) {
  const record = FEEDBACK_RECORDS.find(item => item.id === feedbackId)
  if (!record) { return }
  record.status = 'acknowledged'
  record.acknowledgedAt = DEMO_REFERENCE_DATE
  record.acknowledgedBy = currentUser.value.id
  refreshKey.value += 1
  showToast('Feedback ditindaklanjuti', 'Status diubah menjadi Acknowledged.', 'success')
}

function flagFollowUp (feedbackId: string) {
  const record = FEEDBACK_RECORDS.find(item => item.id === feedbackId)
  if (!record) { return }
  record.status = 'follow-up-required'
  refreshKey.value += 1
  showToast('Ditandai', 'Feedback masuk antrean tindak lanjut.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul CRM" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Feedback Masuk" :value="String(stats.total)" :icon="Star" />
        <StatsCard title="Rata-rata Pengalaman" :value="`${stats.average.toFixed(1)} / 5`" :icon="ThumbsUp" :icon-color="stats.average >= 4 ? 'success' : 'warning'" />
        <StatsCard title="Net Promoter Score" :value="formatPercentage(stats.nps)" :icon="ThumbsUp" :icon-color="stats.nps >= 0 ? 'success' : 'destructive'" />
        <StatsCard title="Perlu Tindak Lanjut" :value="String(stats.needsFollowUp)" :icon="MessageSquareWarning" :icon-color="stats.needsFollowUp ? 'destructive' : 'success'" />
      </div>

      <SectionCard title="Rata-rata per Aspek Layanan" description="Diurutkan dari yang paling rendah — itulah prioritas perbaikan.">
        <ul class="space-y-2">
          <li v-for="aspect in aspectAverages" :key="aspect.key" class="flex items-center gap-3">
            <span class="w-48 shrink-0 text-sm text-foreground truncate">{{ aspect.label }}</span>
            <span class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <span
                :class="cn('block h-full rounded-full', aspect.average >= 4 ? 'bg-success' : aspect.average >= 3 ? 'bg-warning' : 'bg-destructive')"
                :style="{ width: `${(aspect.average / 5) * 100}%` }"
              />
            </span>
            <span class="w-16 shrink-0 text-right text-sm font-medium text-foreground">{{ aspect.average.toFixed(1) }}</span>
          </li>
        </ul>
      </SectionCard>

      <div class="flex flex-wrap items-center gap-3">
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="status in FEEDBACK_STATUSES" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
      </div>

      <SectionCard>
        <ul v-if="filteredRows.length" class="divide-y divide-border">
          <li v-for="row in filteredRows" :key="row.feedback.id" class="py-4 first:pt-0 last:pb-0">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-foreground">{{ row.party?.name ?? row.feedback.clientPartyId }}</span>
                  <StatusBadge :label="row.statusOption.label" :tone="row.statusOption.tone" />
                  <StatusBadge v-if="row.isDetractor" label="Detractor" tone="destructive" />
                </div>
                <NuxtLink
                  v-if="row.project"
                  :to="`/project-orders/${row.project.id}`"
                  class="text-xs text-muted-foreground hover:text-primary"
                >
                  {{ row.project.name }} · {{ row.project.id }}
                </NuxtLink>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <Star
                  v-for="index in 5"
                  :key="index"
                  class="h-4 w-4"
                  :class="index <= (row.feedback.overallExperience ?? 0) ? 'text-warning fill-warning' : 'text-muted-foreground'"
                />
                <span class="text-xs text-muted-foreground ml-1.5">NPS {{ row.feedback.recommendationScore ?? '—' }}</span>
              </div>
            </div>

            <p v-if="row.feedback.comment" class="text-sm text-foreground mt-2 leading-relaxed">
              "{{ row.feedback.comment }}"
            </p>
            <p v-if="row.feedback.improvementSuggestion" class="text-xs text-muted-foreground mt-1">
              Saran: {{ row.feedback.improvementSuggestion }}
            </p>

            <div class="flex flex-wrap items-center gap-3 mt-2.5">
              <span class="text-xs text-muted-foreground">
                {{ row.feedback.submittedAt ? `Dikirim ${formatDate(row.feedback.submittedAt)}` : 'Belum dikirim' }}
              </span>
              <span v-if="row.feedback.acknowledgedAt" class="text-xs text-success flex items-center gap-1">
                <CheckCircle2 class="h-3 w-3" />
                Ditindaklanjuti {{ formatDate(row.feedback.acknowledgedAt) }} oleh {{ getUserById(row.feedback.acknowledgedBy ?? '')?.name ?? '—' }}
              </span>
              <StatusBadge v-if="row.feedback.testimonialConsent" label="Boleh jadi testimoni" tone="info" />

              <span v-if="canManage" class="ml-auto flex items-center gap-2">
                <Button
                  v-if="row.feedback.status !== 'follow-up-required'"
                  variant="outline"
                  size="sm"
                  @click="flagFollowUp(row.feedback.id)"
                >
                  Tandai Perlu Tindak Lanjut
                </Button>
                <Button
                  v-if="row.feedback.status !== 'acknowledged'"
                  size="sm"
                  @click="acknowledge(row.feedback.id)"
                >
                  Tandai Ditindaklanjuti
                </Button>
              </span>
            </div>
          </li>
        </ul>

        <EmptyState v-else :icon="Star" title="Belum ada feedback" description="Feedback muncul setelah klien mengisi form evaluasi di portal." />
      </SectionCard>
    </template>
  </div>
</template>
