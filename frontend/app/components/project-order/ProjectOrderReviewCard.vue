<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star, CheckCircle2 } from 'lucide-vue-next'
import { getProjectClosureSummary, getFeedbackByProject } from '~/data'
import { formatCurrencyIdr } from '~/utils/format'
import type { Project } from '~/types/project'

const props = defineProps<{
  project: Project
  canClose: boolean
  /** Blocker step Done — ditampilkan langsung di sini agar Review tuntas tanpa pindah halaman. */
  blockers: string[]
}>()

const emit = defineEmits<{
  close: [payload: { finalNote: string; clientFeedback: string }]
}>()

const finalNote = ref('')
const clientFeedback = ref('')

const isClosed = computed(() => Boolean(props.project.closedAt))
const summary = computed(() => getProjectClosureSummary(props.project.id))
/** Satu record feedback per project (`getFeedbackByProject` mengembalikan `Feedback | undefined`). */
const feedback = computed(() => getFeedbackByProject(props.project.id))

const summaryRows = computed(() => [
  { label: 'Total Service', value: String(summary.value.totalServices) },
  { label: 'Total Booking', value: String(summary.value.totalBookings) },
  { label: 'Total Ditagihkan', value: formatCurrencyIdr(summary.value.totalInvoicedIdr) },
  { label: 'Total Diterima', value: formatCurrencyIdr(summary.value.totalPaidIdr) },
  { label: 'Incident Selesai', value: `${summary.value.incidentsResolved}/${summary.value.incidentsTotal}` },
  { label: 'Change Request Diterapkan', value: `${summary.value.changeRequestsImplemented}/${summary.value.changeRequestsTotal}` }
])

function submit () {
  if (!finalNote.value.trim()) { return }
  emit('close', { finalNote: finalNote.value, clientFeedback: clientFeedback.value })
}
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-1">
      <Star class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Closing & Review
      </h3>
    </div>
    <p class="text-xs text-muted-foreground mb-4">
      Langkah terakhir alur 6 step: laporan akhir, berita acara, dan review klien.
    </p>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
      <div v-for="row in summaryRows" :key="row.label" class="rounded-lg bg-muted/40 px-3 py-2">
        <p class="text-xs text-muted-foreground">
          {{ row.label }}
        </p>
        <p class="text-sm font-semibold text-foreground mt-0.5">
          {{ row.value }}
        </p>
      </div>
    </div>

    <template v-if="isClosed">
      <div class="rounded-lg border border-success/40 bg-success/5 px-3 py-2.5 flex gap-2">
        <CheckCircle2 class="h-4 w-4 text-success shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-foreground">
            Project Order ditutup pada {{ project.closedAt }}
          </p>
          <p v-if="project.closureChecklist?.finalNote" class="text-xs text-muted-foreground mt-1">
            Final note: {{ project.closureChecklist.finalNote }}
          </p>
          <p v-if="project.closureChecklist?.clientFeedback" class="text-xs text-muted-foreground mt-0.5">
            Feedback klien: {{ project.closureChecklist.clientFeedback }}
          </p>
        </div>
      </div>
    </template>

    <template v-else-if="canClose">
      <ProjectOrderGateList
        :blockers="blockers"
        title="Belum dapat ditutup"
        ready-message="Seluruh syarat penutupan terpenuhi — isi laporan akhir untuk menutup."
      />

      <div class="space-y-3 mt-3">
        <div class="space-y-1.5">
          <Label>Laporan Akhir / Final Note <span class="text-destructive">*</span></Label>
          <textarea
            v-model="finalNote"
            rows="3"
            placeholder="Ringkasan pelaksanaan, kendala, dan hasil akhir project."
            class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
        <div class="space-y-1.5">
          <Label>Review / Feedback Klien</Label>
          <textarea
            v-model="clientFeedback"
            rows="2"
            placeholder="Opsional — kutipan atau ringkasan feedback dari klien."
            class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
        <Button :disabled="!finalNote.trim() || blockers.length > 0" @click="submit">
          Tutup Project Order
        </Button>
      </div>
    </template>

    <p v-else class="text-sm text-muted-foreground">
      Anda tidak memiliki wewenang menutup Project Order.
    </p>

    <template v-if="feedback">
      <Separator class="my-4" />
      <p class="text-xs font-medium text-muted-foreground mb-2">
        Feedback Klien Tercatat
      </p>
      <div class="rounded-lg border border-border px-3 py-2">
        <div class="flex items-center gap-1">
          <Star
            v-for="index in 5"
            :key="index"
            class="h-3.5 w-3.5"
            :class="index <= (feedback.overallExperience ?? 0) ? 'text-warning fill-warning' : 'text-muted-foreground'"
          />
          <span class="text-xs text-muted-foreground ml-1.5">Overall experience</span>
        </div>
        <p v-if="feedback.comment" class="text-sm text-foreground mt-1.5">
          {{ feedback.comment }}
        </p>
        <p v-if="feedback.improvementSuggestion" class="text-xs text-muted-foreground mt-1">
          Saran perbaikan: {{ feedback.improvementSuggestion }}
        </p>
      </div>
    </template>
  </SectionCard>
</template>
