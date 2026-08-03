<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getProjectById, getFeedbackByProject, saveFeedbackDraft, submitFeedback } from '~/data'
import { FEEDBACK_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateRange } from '~/utils/format'

/**
 * Feedback & Evaluation — Form (Repair Phase Section 7, Master Prompt bagian 17). Save Draft/Submit reuse
 * `saveFeedbackDraft`/`submitFeedback` (`app/data/index.ts`) — submit menaut ADITIF ke
 * `ProjectClosureChecklist.feedbackCollected` (`markProjectFeedbackCollected`, TIDAK menyentuh gate
 * `evaluateProjectClosureGate` LOCKED Section 24).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const project = computed(() => getProjectById(String(route.params.projectId)))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
const feedback = computed(() => (project.value ? getFeedbackByProject(project.value.id) : undefined))
useHead({ title: computed(() => project.value ? `Feedback — ${project.value.name}` : 'Tidak Ditemukan') })

const isReadonly = computed(() => Boolean(feedback.value && feedback.value.status !== 'draft' && feedback.value.status !== 'not-started'))

const form = ref({
  overallExperience: undefined as number | undefined,
  salesResponsiveness: undefined as number | undefined,
  proposalQuality: undefined as number | undefined,
  itineraryQuality: undefined as number | undefined,
  hotelRating: undefined as number | undefined,
  transportationRating: undefined as number | undefined,
  tourLeaderRating: undefined as number | undefined,
  operationSupportRating: undefined as number | undefined,
  reservationHandlingRating: undefined as number | undefined,
  communicationRating: undefined as number | undefined,
  issueResolutionRating: undefined as number | undefined,
  valueForMoneyRating: undefined as number | undefined,
  recommendationScore: undefined as number | undefined,
  comment: '',
  improvementSuggestion: '',
  testimonialConsent: false
})
const isDirty = ref(false)

const RATING_FIELDS: { key: keyof typeof form.value; label: string }[] = [
  { key: 'overallExperience', label: 'Overall Experience' },
  { key: 'salesResponsiveness', label: 'Sales Responsiveness' },
  { key: 'proposalQuality', label: 'Proposal Quality' },
  { key: 'itineraryQuality', label: 'Itinerary Quality' },
  { key: 'hotelRating', label: 'Hotel' },
  { key: 'transportationRating', label: 'Transportation' },
  { key: 'tourLeaderRating', label: 'Tour Leader' },
  { key: 'operationSupportRating', label: 'Operation Support' },
  { key: 'reservationHandlingRating', label: 'Reservation Handling' },
  { key: 'communicationRating', label: 'Communication' },
  { key: 'issueResolutionRating', label: 'Issue Resolution' },
  { key: 'valueForMoneyRating', label: 'Value for Money' }
]

watch(feedback, (value) => {
  if (!value) { return }
  form.value = {
    overallExperience: value.overallExperience,
    salesResponsiveness: value.salesResponsiveness,
    proposalQuality: value.proposalQuality,
    itineraryQuality: value.itineraryQuality,
    hotelRating: value.hotelRating,
    transportationRating: value.transportationRating,
    tourLeaderRating: value.tourLeaderRating,
    operationSupportRating: value.operationSupportRating,
    reservationHandlingRating: value.reservationHandlingRating,
    communicationRating: value.communicationRating,
    issueResolutionRating: value.issueResolutionRating,
    valueForMoneyRating: value.valueForMoneyRating,
    recommendationScore: value.recommendationScore,
    comment: value.comment ?? '',
    improvementSuggestion: value.improvementSuggestion ?? '',
    testimonialConsent: value.testimonialConsent
  }
  isDirty.value = false
}, { immediate: true })

const isValid = computed(() => form.value.overallExperience !== undefined && form.value.recommendationScore !== undefined)

function buildInput () {
  if (!project.value || !clientScopeId.value) { return undefined }
  return { projectId: project.value.id, clientPartyId: clientScopeId.value, submittedBy: currentUser.value.id, ...form.value }
}

function handleSaveDraft () {
  const input = buildInput()
  if (!input) { return }
  const result = saveFeedbackDraft(input)
  if (result) { isDirty.value = false; showToast('Draft Tersimpan', 'Feedback Anda tersimpan sebagai draft.', 'success') }
}

function handleSubmit () {
  const input = buildInput()
  if (!input || !isValid.value) { return }
  const result = submitFeedback(input)
  if (result) { isDirty.value = false; showToast('Feedback Terkirim', 'Terima kasih atas penilaian Anda.', 'success') }
}

onBeforeRouteLeave(() => {
  if (!isDirty.value || isReadonly.value) { return true }
  return window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')
})
</script>

<template>
  <div class="space-y-6">
    <template v-if="!project || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" description="Project Order ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/feedback')">
            Kembali ke Feedback & Evaluation
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="project.name"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Insights' }, { label: 'Feedback & Evaluation', to: '/client/feedback' }, { label: project.name }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(FEEDBACK_STATUSES, feedback?.status ?? 'not-started').label" :tone="findStatusOption(FEEDBACK_STATUSES, feedback?.status ?? 'not-started').tone" />
        </template>
      </PageHeader>

      <SectionCard :description="`${project.destination} · ${formatDateRange(project.travelStartDate, project.travelEndDate)}`">
        <template v-if="isReadonly">
          <p class="text-sm text-muted-foreground">
            Feedback telah dikirim{{ feedback?.submittedAt ? ` pada ${formatDate(feedback.submittedAt)}` : '' }} dan tidak dapat diubah lagi.
          </p>
          <p v-if="feedback?.status === 'follow-up-required'" class="text-sm text-warning mt-2">
            Tim kami menandai feedback ini memerlukan tindak lanjut — kami akan menghubungi Anda.
          </p>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div v-for="field in RATING_FIELDS" :key="field.key" class="flex items-center justify-between gap-3 py-1.5">
            <Label>{{ field.label }}</Label>
            <RatingInput v-model="(form[field.key] as number)" :readonly="isReadonly" @update:model-value="isDirty = true" />
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 py-1.5 mt-2 pt-4 border-t border-border">
          <Label>Recommendation Score</Label>
          <RatingInput v-model="form.recommendationScore" :readonly="isReadonly" @update:model-value="isDirty = true" />
        </div>

        <div class="space-y-1.5 mt-4">
          <Label for="fb-comment">Comment</Label>
          <textarea
            id="fb-comment"
            v-model="form.comment"
            :disabled="isReadonly"
            rows="3"
            class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            @input="isDirty = true"
          />
        </div>
        <div class="space-y-1.5 mt-4">
          <Label for="fb-improvement">Improvement Suggestion</Label>
          <textarea
            id="fb-improvement"
            v-model="form.improvementSuggestion"
            :disabled="isReadonly"
            rows="2"
            class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            @input="isDirty = true"
          />
        </div>
        <label class="flex items-center gap-2 text-sm text-foreground mt-4 cursor-pointer">
          <Checkbox v-model="form.testimonialConsent" :disabled="isReadonly" @update:model-value="isDirty = true" />Saya bersedia komentar ini dijadikan testimonial (opsional)
        </label>

        <div v-if="!isReadonly" class="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" @click="handleSaveDraft">
            Save Draft
          </Button>
          <Button :disabled="!isValid" @click="handleSubmit">
            Submit
          </Button>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
