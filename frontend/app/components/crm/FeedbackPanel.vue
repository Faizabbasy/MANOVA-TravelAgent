<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, MessageSquareWarning, ThumbsUp, CheckCircle2 } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getUserById } from '~/data'
import { feedbackFromServer } from '~/data/support-sync'
import { feedbackActions } from '~/lib/support'
import { createSaveGate } from '~/lib/save-gate'
import { isApiError } from '~/lib/api/errors'
import { FEEDBACK_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatPercentage } from '~/utils/format'
import type { FeedbackDto } from '~/types/api'
import type { FeedbackStatus } from '~/types/feedback'

/** Tab "Review & Feedback" — Menu CRM > Engagement (Penyederhanaan 7-Role/Menu). Dulu `/crm/feedback`,
 * kini tab dalam satu menu bersama Follow-up/Loyalty. */

const { canView, can } = usePermissions()
const { showToast } = useToast()
const api = useApi()
const session = useServerSession()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

const hasAccess = computed(() => canView('crm'))
const canManage = computed(() => can('crm.manage-follow-up'))

const statusFilter = ref<'all' | FeedbackStatus>('all')

/**
 * Sisi internal dari feedback klien (S12c-2: dari server, `GET /feedback`). Portal client adalah tempat klien
 * MENGISI; panel ini tempat tim CRM MENINDAKLANJUTI — terima, tandai perlu tindak lanjut (catatan wajib), tutup.
 */
const records = ref<FeedbackDto[]>([])
const loadError = ref('')
async function load () {
  if (!hasAccess.value) { return }
  try {
    await session.ensure()
    records.value = (await api.core.listFeedback()).data
    loadError.value = ''
  } catch (error) {
    loadError.value = isApiError(error) ? error.message : 'Server belum bisa dihubungi.'
  }
}
onMounted(load)

const rows = computed(() => records.value
  .filter(dto => dto.status !== 'draft')
  .map((dto) => {
    const feedback = feedbackFromServer(dto)
    return {
      dto,
      feedback,
      statusOption: findStatusOption(FEEDBACK_STATUSES, feedback.status),
      isDetractor: (feedback.recommendationScore ?? 10) <= 6,
      actions: feedbackActions(feedback.status)
    }
  })
  .sort((a, b) => (b.feedback.submittedAt ?? '').localeCompare(a.feedback.submittedAt ?? '')))

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

const acknowledgedName = (userId?: string) => { const name = userId ? getUserById(userId)?.name : undefined; return name ? ` oleh ${name}` : '' }

/** The server's feedback replaces the row. */
async function act (title: string, action: () => Promise<{ data: FeedbackDto }>) {
  const saved = await gate.run(title, async () => (await action()).data)
  if (!saved) { return false }
  const i = records.value.findIndex(item => item.id === saved.id)
  if (i !== -1) { records.value.splice(i, 1, saved) }
  return true
}

async function acknowledge (feedbackId: string) {
  if (await act('Feedback Gagal Ditandai', () => api.core.acknowledgeFeedback(feedbackId))) {
    showToast('Feedback diterima', 'Status diubah menjadi Acknowledged.', 'success')
  }
}

const noteDialog = ref<{ kind: 'follow-up' | 'close'; id: string } | null>(null)
const note = ref('')
const isNoteOpen = computed({ get: () => noteDialog.value !== null, set: (open) => { if (!open) { noteDialog.value = null } } })
function openNote (kind: 'follow-up' | 'close', id: string) {
  note.value = ''
  noteDialog.value = { kind, id }
}
async function submitNote () {
  const dialog = noteDialog.value
  if (!dialog || (dialog.kind === 'follow-up' && !note.value.trim())) { return }
  const text = note.value.trim()
  const done = dialog.kind === 'follow-up'
    ? await act('Tindak Lanjut Gagal Dicatat', () => api.core.followUpFeedback(dialog.id, text))
    : await act('Feedback Gagal Ditutup', () => api.core.closeFeedback(dialog.id, text || undefined))
  if (!done) { return }
  noteDialog.value = null
  showToast(dialog.kind === 'follow-up' ? 'Ditandai' : 'Feedback ditutup', dialog.kind === 'follow-up' ? 'Feedback masuk antrean tindak lanjut.' : 'Feedback selesai ditindaklanjuti.', 'success')
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
                  <span class="text-sm font-medium text-foreground">{{ row.dto.partyName }}</span>
                  <StatusBadge :label="row.statusOption.label" :tone="row.statusOption.tone" />
                  <StatusBadge v-if="row.isDetractor" label="Detractor" tone="destructive" />
                </div>
                <NuxtLink
                  :to="`/project-orders/${row.dto.projectId}`"
                  class="text-xs text-muted-foreground hover:text-primary"
                >
                  {{ row.dto.projectName }} · {{ row.dto.projectId }}
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
                Diterima {{ formatDate(row.feedback.acknowledgedAt) }}{{ acknowledgedName(row.feedback.acknowledgedBy) }}
              </span>
              <span v-if="row.feedback.closedAt" class="text-xs text-muted-foreground">Ditutup {{ formatDate(row.feedback.closedAt) }}</span>
              <StatusBadge v-if="row.feedback.testimonialConsent" label="Boleh jadi testimoni" tone="info" />

              <span v-if="canManage" class="ml-auto flex items-center gap-2">
                <Button v-if="row.actions.followUp" variant="outline" size="sm" :disabled="gate.saving.value" @click="openNote('follow-up', row.dto.id)">
                  Tandai Perlu Tindak Lanjut
                </Button>
                <Button v-if="row.actions.acknowledge" size="sm" :disabled="gate.saving.value" @click="acknowledge(row.dto.id)">
                  Terima
                </Button>
                <Button v-if="row.actions.close" variant="outline" size="sm" :disabled="gate.saving.value" @click="openNote('close', row.dto.id)">
                  Tutup
                </Button>
              </span>
            </div>
            <p v-if="row.feedback.followUpNote" class="text-xs text-warning mt-1.5">
              Tindak lanjut: {{ row.feedback.followUpNote }}
            </p>
          </li>
        </ul>

        <EmptyState v-else-if="loadError" :icon="Star" title="Feedback belum bisa dimuat" :description="loadError">
          <Button variant="outline" size="sm" @click="load">
            Coba lagi
          </Button>
        </EmptyState>
        <EmptyState v-else :icon="Star" title="Belum ada feedback" description="Feedback muncul setelah klien mengisi form evaluasi di portal." />
      </SectionCard>

      <ResponsiveFormSheet
        v-model:open="isNoteOpen"
        :title="noteDialog?.kind === 'close' ? 'Tutup Feedback' : 'Perlu Tindak Lanjut'"
        :description="noteDialog?.kind === 'close' ? 'Catatan penutupan (opsional).' : 'Catatan wajib — apa yang akan dilakukan.'"
        content-class="max-w-md"
      >
        <div class="space-y-1.5 py-2">
          <Label for="fb-note">Catatan</Label>
          <textarea id="fb-note" v-model="note" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <template #footer>
          <Button variant="outline" @click="noteDialog = null">
            Batal
          </Button>
          <Button :disabled="gate.saving.value || (noteDialog?.kind === 'follow-up' && !note.trim())" @click="submitNote">
            Simpan
          </Button>
        </template>
      </ResponsiveFormSheet>
    </template>
  </div>
</template>
