<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getOpportunityById, getPartyById, getQuotationByOpportunity, getPartyActivitiesByOpportunity, getUserById, getLeadById,
  createQuotation, reviseQuotation, advanceOpportunityStage, createPartyActivity,
  getOpportunityMissingRequirements, getOpportunityRequirementGate, getOpportunityWorkflowStatus,
  updateOpportunityRequirement, updateQuotationDetails, approveOpportunityWon,
  submitQuotationForApproval, approveQuotation, rejectQuotation,
  duplicateQuotationVersion, sendQuotationToClient, withdrawQuotationSubmission, recordClientConfirmation,
  getCostSheetsByOpportunity, getCostSheetBreakdown, getUserByClientPartyId
} from '~/data'
import {
  OPPORTUNITY_STAGES, OPPORTUNITY_WORKFLOW_STATUSES, SERVICE_TYPES, PARTY_ACTIVITY_TYPES,
  QUOTATION_APPROVAL_STATUSES, LEAD_SOURCES, findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { OpportunityStage, OpportunityRequirementDetail, QuotationServiceItem } from '~/types/opportunity'
import type { ServiceTypeKey } from '~/types/project'
import type { PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentRole, currentUser } = useCurrentUser()
const { canView, canApprove, can } = usePermissions()
const { showToast } = useToast()

/** Sama seperti `canManageParty` (Section 07) — pengecualian sempit, bukan mekanisme role-check baru.
 * Management sengaja TIDAK termasuk: level modul `crm`-nya (`APPROVE`) dikhususkan untuk approve
 * Won di Section 09, bukan untuk mengelola stage sehari-hari (docs bagian 1.2).
 * Prompt 19 (Change Request) — role dipindah dari `sales` ke `account-executive`: di bawah model role
 * baru, Sales berhenti mengelola Opportunity/Quotation (scoped ke Lead, lihat `/customer-journey/leads`),
 * Account Executive yang menerima handover dan mengelola Opportunity sampai Won. */
const canManageOpportunity = computed(() => can('sales.manage-opportunity'))

/** Commercial Approval (Prompt 19/20) — Management/Super Admin approve/reject quotation. Prompt 20 menghapus approval Won terpisah (D-053) — setelah Commercial Approval disetujui, AE langsung "Mark as Won" (`submitMarkAsWon`), reuse `canApprove('sales')`, bukan constant baru. */
const canApproveCommercial = computed(() => canApprove('sales'))

const opportunity = computed(() => getOpportunityById(String(route.params.id)))
useHead({ title: computed(() => opportunity.value ? opportunity.value.title : 'Opportunity Tidak Ditemukan') })

const party = computed(() => (opportunity.value ? getPartyById(opportunity.value.partyId) : undefined))
const quotation = computed(() => (opportunity.value ? getQuotationByOpportunity(opportunity.value.id) : undefined))
const activities = computed(() => (opportunity.value ? getPartyActivitiesByOpportunity(opportunity.value.id) : []))
const relatedLead = computed(() => (opportunity.value?.leadId ? getLeadById(opportunity.value.leadId) : undefined))

/** "Requirement validation" (Section 09) — gerbang final sebelum Won (mensyaratkan Quotation SUDAH ada). */
const missingRequirements = computed(() => (opportunity.value ? getOpportunityMissingRequirements(opportunity.value.id) : []))
/** Requirement Gate SEBELUM Quotation (Prompt 20-10) — terpisah dari `missingRequirements`, dicek sebelum membuat Quotation pertama. */
const requirementGateWarnings = computed(() => (opportunity.value ? getOpportunityRequirementGate(opportunity.value.id) : []))
/** Status workflow AE-facing (Prompt 20-10/14) — "indikator stage yang jelas", menggantikan label lama yang membingungkan. */
const workflowStatus = computed(() => (opportunity.value ? getOpportunityWorkflowStatus(opportunity.value.id) : undefined))

/** Product Planning dan Costing (Section 10) — Cost Sheet yang melekat pada Opportunity ini, kolaborasi Product Planner↔AE. Pengelolaan lengkap (edit/apply) tetap di modul Product Planning, di sini murni ringkasan + link. */
const costSheets = computed(() => (opportunity.value ? getCostSheetsByOpportunity(opportunity.value.id) : []))

const summaryMetadata = computed(() => {
  if (!opportunity.value) { return [] }
  return [
    { label: 'Party / Prospect', value: party.value?.name ?? '—' },
    { label: 'Contact Person', value: opportunity.value.contactName ?? '—' },
    { label: 'Lead Source', value: relatedLead.value ? findStatusOption(LEAD_SOURCES, relatedLead.value.source).label : '—' },
    { label: 'Account Executive', value: getUserById(opportunity.value.ownerId)?.name ?? '—' },
    { label: 'Destinasi', value: opportunity.value.destination },
    {
      label: 'Tanggal Perkiraan',
      value: opportunity.value.travelStartDate && opportunity.value.travelEndDate
        ? formatDateRange(opportunity.value.travelStartDate, opportunity.value.travelEndDate)
        : 'Belum ditentukan'
    },
    { label: 'Estimasi Traveler', value: opportunity.value.travelerEstimate ? `${opportunity.value.travelerEstimate} pax` : '—' },
    { label: 'Estimasi Nilai', value: formatCurrencyIdr(opportunity.value.estimatedValueIdr) },
    { label: 'Expected Close', value: opportunity.value.expectedCloseDate ? formatDate(opportunity.value.expectedCloseDate) : '—' },
    { label: 'Dibuat', value: formatDate(opportunity.value.createdAt) }
  ]
})

/* Stage stepper & aksi transisi */
const MAIN_STAGES: OpportunityStage[] = ['draft', 'qualification', 'requirement-gathering', 'proposal', 'negotiation', 'won-requested', 'won']
const currentStageIndex = computed(() => (opportunity.value ? MAIN_STAGES.indexOf(opportunity.value.stage) : -1))

const isProposalDialogOpen = ref(false)
const proposalQuotationAmount = ref<number | null>(null)

function goToNextSimpleStage (next: OpportunityStage) {
  if (!opportunity.value) { return }
  advanceOpportunityStage(opportunity.value.id, next)
}

function openProposalDialog () {
  if (!opportunity.value || requirementGateWarnings.value.length > 0) { return }
  if (quotation.value) {
    // Quotation sudah ada (edge case) — langsung lanjut tanpa dialog.
    goToNextSimpleStage('proposal')
    return
  }
  proposalQuotationAmount.value = null
  isProposalDialogOpen.value = true
}

/* Edit Requirement (Prompt 20-8B/9) — AE melengkapi/menyempurnakan requirement dasar + Requirement Detail. */
const isRequirementDialogOpen = ref(false)
const reqDestination = ref('')
const reqTravelStart = ref('')
const reqTravelEnd = ref('')
const reqTravelerEstimate = ref<number | null>(null)
const reqServiceScope = ref<ServiceTypeKey[]>([])
const reqRequirementNotes = ref('')
const reqContactName = ref('')
const reqEstimatedValueIdr = ref<number | null>(null)
const reqDetail = ref<OpportunityRequirementDetail>({})

function openRequirementDialog () {
  if (!opportunity.value) { return }
  reqDestination.value = opportunity.value.destination ?? ''
  reqTravelStart.value = opportunity.value.travelStartDate ?? ''
  reqTravelEnd.value = opportunity.value.travelEndDate ?? ''
  reqTravelerEstimate.value = opportunity.value.travelerEstimate ?? null
  reqServiceScope.value = [...opportunity.value.serviceScope]
  reqRequirementNotes.value = opportunity.value.requirementNotes ?? ''
  reqContactName.value = opportunity.value.contactName ?? ''
  reqEstimatedValueIdr.value = opportunity.value.estimatedValueIdr || null
  reqDetail.value = { ...opportunity.value.requirementDetail }
  isRequirementDialogOpen.value = true
}

function toggleReqServiceScope (type: ServiceTypeKey) {
  const index = reqServiceScope.value.indexOf(type)
  if (index === -1) { reqServiceScope.value.push(type) } else { reqServiceScope.value.splice(index, 1) }
}

function submitRequirement () {
  // Destinasi wajib (`Opportunity.destination` bertipe non-optional) — jangan kosongkan lewat form ini.
  if (!opportunity.value || !reqDestination.value.trim()) { return }
  updateOpportunityRequirement(opportunity.value.id, {
    destination: reqDestination.value.trim(),
    travelStartDate: reqTravelStart.value || undefined,
    travelEndDate: reqTravelEnd.value || undefined,
    travelerEstimate: reqTravelerEstimate.value ?? undefined,
    serviceScope: reqServiceScope.value,
    requirementNotes: reqRequirementNotes.value.trim(),
    contactName: reqContactName.value.trim(),
    estimatedValueIdr: reqEstimatedValueIdr.value ?? 0,
    requirementDetail: reqDetail.value
  })
  isRequirementDialogOpen.value = false
}

function submitProposal () {
  if (!opportunity.value || !proposalQuotationAmount.value || proposalQuotationAmount.value <= 0) { return }
  createQuotation(opportunity.value.id, proposalQuotationAmount.value)
  advanceOpportunityStage(opportunity.value.id, 'proposal')
  isProposalDialogOpen.value = false
}

const isLostDialogOpen = ref(false)
const lostReasonInput = ref('')

function submitLost () {
  if (!opportunity.value || !lostReasonInput.value.trim()) { return }
  advanceOpportunityStage(opportunity.value.id, 'lost', { lostReason: lostReasonInput.value.trim() })
  isLostDialogOpen.value = false
  lostReasonInput.value = ''
}

const isReviseDialogOpen = ref(false)
const revisedAmount = ref<number | null>(null)

function openReviseDialog () {
  revisedAmount.value = quotation.value?.amountIdr ?? null
  isReviseDialogOpen.value = true
}

function submitRevise () {
  if (!quotation.value || !revisedAmount.value || revisedAmount.value <= 0) { return }
  reviseQuotation(quotation.value.id, revisedAmount.value)
  isReviseDialogOpen.value = false
}

/* Edit Quotation (Prompt 20-9/11) — melengkapi detail komersial SELAGI masih draft (belum submitted/approved), tanpa menaikkan versi (beda dari "Revisi Quotation"/Create New Version di atas). */
const isEditQuotationDialogOpen = ref(false)
const editQuotationAmount = ref<number | null>(null)
/** Discount diinput sebagai persen (bukan Rp) — nilai Rp yang tersimpan di `discountIdr` tetap dihitung otomatis dari persen × Nilai Quotation, supaya seluruh halaman lain (preview, client portal) yang membaca `discountIdr` tidak perlu berubah. */
const editQuotationDiscountPercent = ref<number | null>(null)
const editQuotationDiscount = computed(() => {
  if (!editQuotationAmount.value || !editQuotationDiscountPercent.value) { return null }
  return Math.round(editQuotationAmount.value * (editQuotationDiscountPercent.value / 100))
})
const editQuotationCost = ref<number | null>(null)
/** Estimated Margin tidak lagi diinput manual — dihitung otomatis: (Nilai Quotation − Discount) − Estimated Cost. */
const editQuotationMargin = computed(() => {
  if (editQuotationAmount.value == null) { return null }
  return editQuotationAmount.value - (editQuotationDiscount.value ?? 0) - (editQuotationCost.value ?? 0)
})
const editQuotationPaymentTerms = ref('')
const editServiceBreakdown = ref<QuotationServiceItem[]>([])
/** Section 05 — field komersial tambahan: tax/fee, markup, currency, validity, terms, inclusions/exclusions. */
const editQuotationTax = ref<number | null>(null)
const editQuotationMarkup = ref<number | null>(null)
const editQuotationCurrency = ref('')
const editQuotationValidUntil = ref('')
const editQuotationTerms = ref('')
const editQuotationInclusions = ref('')
const editQuotationExclusions = ref('')

function openEditQuotationDialog () {
  if (!quotation.value) { return }
  editQuotationAmount.value = quotation.value.amountIdr
  editQuotationDiscountPercent.value = (quotation.value.discountIdr && quotation.value.amountIdr)
    ? Math.round((quotation.value.discountIdr / quotation.value.amountIdr) * 1000) / 10
    : null
  editQuotationCost.value = quotation.value.estimatedCostIdr ?? null
  editQuotationPaymentTerms.value = quotation.value.paymentTerms ?? ''
  editServiceBreakdown.value = (quotation.value.serviceBreakdown ?? []).map(item => ({ ...item }))
  editQuotationTax.value = quotation.value.taxIdr ?? null
  editQuotationMarkup.value = quotation.value.markupIdr ?? null
  editQuotationCurrency.value = quotation.value.currency ?? 'IDR'
  editQuotationValidUntil.value = quotation.value.validUntil ?? ''
  editQuotationTerms.value = quotation.value.termsAndConditions ?? ''
  editQuotationInclusions.value = quotation.value.inclusions ?? ''
  editQuotationExclusions.value = quotation.value.exclusions ?? ''
  isEditQuotationDialogOpen.value = true
}

function addBreakdownRow () {
  editServiceBreakdown.value.push({ service: 'flight', description: '', amountIdr: 0 })
}

function removeBreakdownRow (index: number) {
  editServiceBreakdown.value.splice(index, 1)
}

function submitEditQuotation () {
  if (!quotation.value || !editQuotationAmount.value || editQuotationAmount.value <= 0) { return }
  updateQuotationDetails(quotation.value.id, {
    amountIdr: editQuotationAmount.value,
    discountIdr: editQuotationDiscount.value ?? undefined,
    estimatedCostIdr: editQuotationCost.value ?? undefined,
    estimatedMarginIdr: editQuotationMargin.value ?? undefined,
    paymentTerms: editQuotationPaymentTerms.value.trim() || undefined,
    serviceBreakdown: editServiceBreakdown.value.filter(item => item.amountIdr > 0),
    taxIdr: editQuotationTax.value ?? undefined,
    markupIdr: editQuotationMarkup.value ?? undefined,
    currency: editQuotationCurrency.value.trim() || undefined,
    validUntil: editQuotationValidUntil.value || undefined,
    termsAndConditions: editQuotationTerms.value.trim() || undefined,
    inclusions: editQuotationInclusions.value.trim() || undefined,
    exclusions: editQuotationExclusions.value.trim() || undefined
  })
  isEditQuotationDialogOpen.value = false
}

/** "Duplicate Quotation" (Section 05) — salinan persis sebagai versi baru, titik awal edit dari draft yang sudah terisi. */
function submitDuplicateQuotation () {
  if (!quotation.value) { return }
  duplicateQuotationVersion(quotation.value.id)
  showToast('Quotation Diduplikasi', 'Versi baru dibuat sebagai salinan persis dari versi sebelumnya, siap diedit.', 'success')
}

const isCompareVersionsOpen = ref(false)

/* Send to Client / Withdraw / Client Confirmation (Section 05) */
function submitSendToClient () {
  if (!quotation.value) { return }
  sendQuotationToClient(quotation.value.id, currentUser.value.id)
  const clientUser = opportunity.value ? getUserByClientPartyId(opportunity.value.partyId) : undefined
  const accountMessage = clientUser
    ? ` Client login account (${clientUser.email}) dapat diakses lewat Settings > Role Switcher.`
    : ''
  showToast('Quotation Terkirim', `Simulasi pengiriman ke client tercatat (mock, bukan email/WA nyata).${accountMessage}`, 'success')
}

function submitWithdraw () {
  if (!quotation.value) { return }
  const result = withdrawQuotationSubmission(quotation.value.id)
  if (!result) {
    showToast('Withdraw Gagal', 'Quotation tidak lagi berstatus Submitted.', 'error')
    return
  }
  showToast('Quotation Ditarik', 'Kembali ke status Draft — dapat diedit ulang sebelum submit lagi.', 'warning')
}

const isClientConfirmationDialogOpen = ref(false)
const clientConfirmationNoteInput = ref('')

function submitClientConfirmation () {
  if (!opportunity.value) { return }
  recordClientConfirmation(opportunity.value.id, currentUser.value.id, clientConfirmationNoteInput.value.trim() || undefined)
  isClientConfirmationDialogOpen.value = false
  clientConfirmationNoteInput.value = ''
  showToast('Client Confirmation Dicatat', 'AE sekarang dapat melanjutkan ke Mark as Won.', 'success')
}

/**
 * Mark as Won (Prompt 20-13) — AE langsung mengeksekusi Won setelah Quotation `approved` oleh Management,
 * TANPA approval kedua terpisah dari Management (beda dari model dua-langkah lama Section 09/D-025: dulu AE
 * "Ajukan sebagai Won" lalu Management "Approve Won" terpisah). Reuse penuh `advanceOpportunityStage`+
 * `approveOpportunityWon` existing (bukan mutator baru) — dipanggil berurutan secara sinkron dalam satu klik,
 * `wonApprovedBy` diisi approver Commercial Approval yang sesungguhnya (`quotation.approvedBy`, Management),
 * bukan AE yang mengeksekusi, agar field tetap merepresentasikan siapa yang benar-benar approve secara
 * komersial. Didokumentasikan sebagai D-053 (`docs/mockup-design-decisions.md`, supersede sebagian D-025
 * khusus untuk Opportunity Won — lihat laporan section).
 */
const isMarkAsWonDialogOpen = ref(false)

function submitMarkAsWon () {
  if (!opportunity.value || !quotation.value || quotation.value.approvalStatus !== 'approved' || !opportunity.value.clientConfirmedAt) { return }
  advanceOpportunityStage(opportunity.value.id, 'won-requested')
  const project = approveOpportunityWon(opportunity.value.id, quotation.value.approvedBy ?? currentUser.value.id)
  isMarkAsWonDialogOpen.value = false
  if (!project) {
    showToast('Mark as Won Gagal', 'Requirement belum lengkap atau opportunity sudah diproses sebelumnya.', 'error')
    return
  }
  const clientUser = getUserByClientPartyId(project.partyId)
  const accountMessage = clientUser
    ? ` Client login account (${clientUser.email}) dapat diakses lewat Settings > Role Switcher.`
    : ''
  showToast('Opportunity Won', `${project.name} (${project.id}) dibuat, client aktif, dan Project Order otomatis dibuat.${accountMessage}`, 'success')
  router.push(`/project-orders/${project.id}`)
}

/* Commercial Approval (Prompt 19) — AE submit quotation untuk approval, Management approve/reject. */
const isSubmitApprovalDialogOpen = ref(false)
const isApproveCommercialDialogOpen = ref(false)
const isRejectCommercialDialogOpen = ref(false)
const commercialNoteInput = ref('')

function submitForCommercialApproval () {
  if (!quotation.value) { return }
  submitQuotationForApproval(quotation.value.id)
  isSubmitApprovalDialogOpen.value = false
  showToast('Quotation Diajukan', 'Menunggu commercial approval dari Management.', 'success')
}

function submitApproveCommercial () {
  if (!quotation.value) { return }
  const result = approveQuotation(quotation.value.id, currentUser.value.id, commercialNoteInput.value.trim() || undefined)
  isApproveCommercialDialogOpen.value = false
  commercialNoteInput.value = ''
  if (!result) {
    showToast('Approve Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Disetujui', 'AE dapat melanjutkan ke Negotiation / mengajukan sebagai Won.', 'success')
}

function submitRejectCommercial () {
  if (!quotation.value || !commercialNoteInput.value.trim()) { return }
  const result = rejectQuotation(quotation.value.id, currentUser.value.id, commercialNoteInput.value.trim())
  isRejectCommercialDialogOpen.value = false
  commercialNoteInput.value = ''
  if (!result) {
    showToast('Reject Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Ditolak', 'AE perlu merevisi quotation sebelum mengajukan ulang.', 'warning')
}

/* Catat Activity */
const isActivityDialogOpen = ref(false)
const activityType = ref<PartyActivityType>('call')
const activityMessage = ref('')
const activityDueAt = ref('')

function submitActivity () {
  if (!opportunity.value || !activityMessage.value.trim()) { return }
  createPartyActivity({
    partyId: opportunity.value.partyId,
    opportunityId: opportunity.value.id,
    type: activityType.value,
    message: activityMessage.value.trim(),
    ownerId: currentUser.value.id,
    dueAt: activityDueAt.value || undefined
  })
  activityMessage.value = ''
  activityDueAt.value = ''
  activityType.value = 'call'
  isActivityDialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!opportunity">
      <PageHeader title="Opportunity Tidak Ditemukan" :breadcrumb="[{ label: 'Sales Pipeline', to: '/sales/pipeline#opportunities' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Opportunity tidak ditemukan"
          :description="`Opportunity dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/sales/pipeline#opportunities')">
            Kembali ke Daftar Opportunity
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('sales')" module-label="modul Sales" />

    <template v-else>
      <PageHeader
        :title="opportunity.title"
        :breadcrumb="[{ label: 'Sales Pipeline', to: '/sales/pipeline#opportunities' }, { label: opportunity.title }]"
      >
        <template #actions>
          <StatusBadge
            v-if="workflowStatus"
            :label="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, workflowStatus).label"
            :tone="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, workflowStatus).tone"
          />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div class="mt-4">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Peta Lokasi
          </p>
          <DestinationMap :geo="opportunity.destinationGeo" :destination-text="opportunity.destination" />
        </div>
        <div class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Service Scope
          </p>
          <div class="flex flex-wrap gap-2 mb-4">
            <StatusBadge
              v-for="type in SERVICE_TYPES.filter(t => opportunity!.serviceScope.includes(t.value))"
              :key="type.value"
              :label="type.label"
              :tone="type.tone"
            />
          </div>
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Qualification Summary
          </p>
          <p class="text-sm text-foreground">
            {{ opportunity.requirementNotes || 'Requirement belum digali.' }}
          </p>
          <div v-if="relatedLead" class="mt-3">
            <NuxtLink to="/sales/pipeline#leads" class="text-sm text-primary hover:underline">
              Related Lead: {{ relatedLead.id }} — {{ relatedLead.name }} →
            </NuxtLink>
          </div>
        </div>
      </SectionCard>

      <!-- Requirement Detail (Prompt 20 — Change Request) -->
      <SectionCard title="Requirement Detail" description="Dilengkapi Account Executive — menyempurnakan requirement awal dari Sales tanpa menghapus histori qualification.">
        <template v-if="canManageOpportunity && !['won', 'lost'].includes(opportunity.stage)" #actions>
          <Button size="sm" variant="outline" @click="openRequirementDialog">
            Edit Requirement
          </Button>
        </template>

        <div v-if="requirementGateWarnings.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3 mb-4">
          <p class="text-sm font-medium text-warning">
            Requirement belum lengkap untuk Quotation:
          </p>
          <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
            <li v-for="item in requirementGateWarnings" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-success mb-4">
          Requirement minimum lengkap — siap dibuatkan Quotation.
        </p>

        <DetailMetadataList
          :items="[
            { label: 'Itinerary Concept', value: opportunity.requirementDetail?.itineraryConcept || '—' },
            { label: 'Departure City', value: opportunity.requirementDetail?.departureCity || '—' },
            { label: 'Destination Detail', value: opportunity.requirementDetail?.destinationDetail || '—' },
            { label: 'Traveler Composition', value: opportunity.requirementDetail?.travelerComposition || '—' },
            { label: 'Room Requirement', value: opportunity.requirementDetail?.roomRequirement || '—' },
            { label: 'Flight Preference', value: opportunity.requirementDetail?.flightPreference || '—' },
            { label: 'Transport Requirement', value: opportunity.requirementDetail?.transportRequirement || '—' },
            { label: 'MICE Requirement', value: opportunity.requirementDetail?.miceRequirement || '—' },
            { label: 'Special Request', value: opportunity.requirementDetail?.specialRequest || '—' },
            { label: 'Decision Maker', value: opportunity.requirementDetail?.decisionMaker || '—' },
            { label: 'Payment Terms', value: opportunity.requirementDetail?.paymentTerms || '—' },
            { label: 'Commercial Notes', value: opportunity.requirementDetail?.commercialNotes || '—' },
            { label: 'Operational Notes', value: opportunity.requirementDetail?.operationalNotes || '—' },
            { label: 'Risk Notes', value: opportunity.requirementDetail?.riskNotes || '—' },
          ]"
        />

        <Dialog v-model:open="isRequirementDialogOpen">
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Requirement</DialogTitle>
              <DialogDescription>Melengkapi/menyempurnakan requirement dasar dan Requirement Detail.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="req-destination">Destinasi</Label>
                <Input id="req-destination" v-model="reqDestination" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="req-start">Mulai Perjalanan</Label>
                  <Input id="req-start" v-model="reqTravelStart" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-end">Selesai Perjalanan</Label>
                  <Input id="req-end" v-model="reqTravelEnd" type="date" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="req-traveler">Estimasi Traveler</Label>
                <Input id="req-traveler" v-model.number="reqTravelerEstimate" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label>Service Scope</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in SERVICE_TYPES"
                    :key="type.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs transition-colors"
                    :class="reqServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                    @click="toggleReqServiceScope(type.value)"
                  >
                    {{ type.label }}
                  </button>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="req-summary">Ringkasan Kebutuhan (Requirement Summary)</Label>
                <textarea id="req-summary" v-model="reqRequirementNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div class="space-y-1.5">
                <Label for="req-contact">Contact Person</Label>
                <Input id="req-contact" v-model="reqContactName" />
              </div>
              <div class="space-y-1.5">
                <Label for="req-estimated-value">Estimasi Nilai (Rp)</Label>
                <Input id="req-estimated-value" v-model.number="reqEstimatedValueIdr" type="number" />
              </div>
              <div class="pt-2 border-t border-border space-y-4">
                <p class="text-xs font-medium text-muted-foreground">
                  Requirement Detail (AE)
                </p>
                <div class="space-y-1.5">
                  <Label for="req-itinerary">Itinerary Concept</Label><Input id="req-itinerary" v-model="reqDetail.itineraryConcept" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-departure">Departure City</Label><Input id="req-departure" v-model="reqDetail.departureCity" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-dest-detail">Destination Detail</Label><Input id="req-dest-detail" v-model="reqDetail.destinationDetail" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-traveler-comp">Traveler Composition</Label><Input id="req-traveler-comp" v-model="reqDetail.travelerComposition" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-room">Room Requirement</Label><Input id="req-room" v-model="reqDetail.roomRequirement" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-flight">Flight Preference</Label><Input id="req-flight" v-model="reqDetail.flightPreference" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-transport">Transport Requirement</Label><Input id="req-transport" v-model="reqDetail.transportRequirement" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-mice">MICE Requirement</Label><Input id="req-mice" v-model="reqDetail.miceRequirement" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-special">Special Request</Label><Input id="req-special" v-model="reqDetail.specialRequest" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-decision-maker">Decision Maker</Label><Input id="req-decision-maker" v-model="reqDetail.decisionMaker" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-payment-terms">Payment Terms</Label><Input id="req-payment-terms" v-model="reqDetail.paymentTerms" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-commercial-notes">Commercial Notes</Label><Input id="req-commercial-notes" v-model="reqDetail.commercialNotes" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-operational-notes">Operational Notes</Label><Input id="req-operational-notes" v-model="reqDetail.operationalNotes" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-risk-notes">Risk Notes</Label><Input id="req-risk-notes" v-model="reqDetail.riskNotes" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isRequirementDialogOpen = false">
                Batal
              </Button>
              <Button :disabled="!reqDestination.trim()" @click="submitRequirement">
                Simpan Requirement
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </SectionCard>

      <!-- Stage Stepper -->
      <SectionCard title="Stage Opportunity">
        <div v-if="opportunity.stage !== 'lost'" class="flex flex-wrap items-center gap-2 mb-4">
          <template v-for="(stage, index) in MAIN_STAGES" :key="stage">
            <StatusBadge
              :label="findStatusOption(OPPORTUNITY_STAGES, stage).label"
              :tone="index <= currentStageIndex ? findStatusOption(OPPORTUNITY_STAGES, stage).tone : 'neutral'"
            />
            <span v-if="index < MAIN_STAGES.length - 1" class="text-muted-foreground text-xs">→</span>
          </template>
          <template v-if="opportunity.stage === 'on-hold'">
            <span class="text-muted-foreground text-xs">↳</span>
            <StatusBadge label="On Hold" tone="warning" />
          </template>
        </div>
        <p v-else class="text-sm text-destructive mb-4">
          Lost — {{ opportunity.lostReason }}
        </p>

        <div v-if="opportunity.stage === 'won' && opportunity.projectId" class="mb-4">
          <NuxtLink :to="`/project-orders/${opportunity.projectId}`" class="text-sm text-primary hover:underline">
            Lihat Project hasil konversi ({{ opportunity.projectId }}) →
          </NuxtLink>
        </div>
        <template v-else-if="opportunity.stage === 'won-requested'">
          <!-- Transisi internal sesaat (Prompt 20-13) — AE "Mark as Won" mengeksekusi `won-requested → won`
               secara sinkron dalam satu klik (lihat `submitMarkAsWon`), state ini seharusnya tidak pernah
               terlihat persisten di data demo manapun. Dipertahankan sebagai fallback informatif saja. -->
          <p class="mb-4 text-sm text-muted-foreground">
            Sedang diproses sebagai Won...
          </p>
        </template>

        <div v-if="canManageOpportunity" class="flex flex-wrap gap-2">
          <Button v-if="opportunity.stage === 'draft'" size="sm" @click="goToNextSimpleStage('qualification')">
            Lanjut ke Qualification
          </Button>
          <Button v-if="opportunity.stage === 'qualification'" size="sm" @click="goToNextSimpleStage('requirement-gathering')">
            Lanjut ke Requirement Gathering
          </Button>
          <template v-if="opportunity.stage === 'requirement-gathering'">
            <Button
              size="sm"
              :disabled="requirementGateWarnings.length > 0"
              :title="requirementGateWarnings.length > 0 ? 'Requirement belum lengkap — lihat section Requirement Detail' : undefined"
              @click="openProposalDialog"
            >
              Buat Quotation
            </Button>
            <p v-if="requirementGateWarnings.length > 0" class="text-xs text-muted-foreground basis-full">
              Lengkapi Requirement Detail (section di atas) sebelum Quotation dapat dibuat.
            </p>
          </template>
          <Button v-if="opportunity.stage === 'proposal'" size="sm" @click="goToNextSimpleStage('negotiation')">
            Lanjut ke Negotiation
          </Button>

          <template v-if="opportunity.stage === 'negotiation'">
            <Dialog v-model:open="isMarkAsWonDialogOpen">
              <DialogTrigger as-child>
                <Button
                  size="sm"
                  :disabled="quotation?.approvalStatus !== 'approved' || missingRequirements.length > 0 || !opportunity.clientConfirmedAt"
                  :title="quotation?.approvalStatus !== 'approved' ? 'Quotation harus disetujui (Commercial Approval) oleh Management sebelum Mark as Won' : (!opportunity.clientConfirmedAt ? 'Client confirmation belum dicatat' : undefined)"
                >
                  Mark as Won
                </Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark as Won</DialogTitle>
                  <DialogDescription>
                    Project baru akan otomatis dibuat dari opportunity ini (destinasi {{ opportunity.destination }},
                    {{ opportunity.travelerEstimate }} pax<template v-if="party?.lifecycleStatus === 'prospect'">
                      , dan {{ party?.name }} akan berubah status menjadi Active Client
                    </template>).
                    Aksi ini tidak dapat dibatalkan pada mockup ini.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="isMarkAsWonDialogOpen = false">
                    Batal
                  </Button>
                  <Button @click="submitMarkAsWon">
                    Mark as Won
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <p v-if="quotation?.approvalStatus !== 'approved'" class="text-xs text-muted-foreground basis-full">
              Quotation harus melalui Commercial Approval (lihat section di bawah) sebelum AE dapat Mark as Won.
            </p>
            <p v-else-if="!opportunity.clientConfirmedAt" class="text-xs text-muted-foreground basis-full">
              Client confirmation belum dicatat (lihat section Commercial Approval di bawah) sebelum AE dapat Mark as Won.
            </p>
            <p v-else-if="missingRequirements.length > 0" class="text-xs text-muted-foreground basis-full">
              Requirement belum lengkap: {{ missingRequirements.join(', ') }}.
            </p>
            <Button size="sm" variant="outline" @click="goToNextSimpleStage('on-hold')">
              Tahan (On Hold)
            </Button>
            <Dialog v-model:open="isLostDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm" variant="destructive">
                  Tandai Lost
                </Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Tandai Opportunity sebagai Lost</DialogTitle>
                  <DialogDescription>Aksi ini bersifat final (terminal) untuk mockup ini.</DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="lost-reason">Alasan</Label>
                  <Input id="lost-reason" v-model="lostReasonInput" placeholder="mis. Budget internal client dipotong" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isLostDialogOpen = false">
                    Batal
                  </Button>
                  <Button variant="destructive" :disabled="!lostReasonInput.trim()" @click="submitLost">
                    Tandai Lost
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </template>

          <Button v-if="opportunity.stage === 'on-hold'" size="sm" @click="goToNextSimpleStage('negotiation')">
            Lanjutkan Kembali
          </Button>
        </div>

        <Dialog v-model:open="isProposalDialogOpen">
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Siapkan Quotation Awal</DialogTitle>
              <DialogDescription>Masukkan nilai quotation untuk melanjutkan opportunity ini ke stage Proposal.</DialogDescription>
            </DialogHeader>
            <div class="space-y-1.5 py-2">
              <Label for="proposal-amount">Nilai Quotation (Rp)</Label>
              <Input id="proposal-amount" v-model.number="proposalQuotationAmount" type="number" placeholder="mis. 100000000" />
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isProposalDialogOpen = false">
                Batal
              </Button>
              <Button :disabled="!proposalQuotationAmount || proposalQuotationAmount <= 0" @click="submitProposal">
                Simpan dan Lanjut
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionCard>

      <!-- Product Planning & Costing (Section 10) -->
      <SectionCard title="Product Planning & Costing" description="Cost Sheet yang disiapkan Product Planner untuk Opportunity ini — kolaborasi sebelum Quotation dibentuk.">
        <template #actions>
          <NuxtLink :to="`/product-planning?opportunityId=${opportunity.id}&create=1#cost-sheets`">
            <Button size="sm" variant="outline">
              <Plus class="h-4 w-4 mr-1.5" />Buat Cost Sheet
            </Button>
          </NuxtLink>
        </template>
        <ul v-if="costSheets.length > 0" class="divide-y divide-border">
          <li v-for="sheet in costSheets" :key="sheet.id" class="py-2.5 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <NuxtLink :to="`/product-planning/cost-sheets/${sheet.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                {{ sheet.name }}
              </NuxtLink>
              <p class="text-xs text-muted-foreground">
                v{{ sheet.version }} · {{ sheet.travelerCount }} pax
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm text-foreground">{{ formatCurrencyIdr(getCostSheetBreakdown(sheet).totalSellIdr) }}</span>
              <StatusBadge :label="sheet.status === 'final' ? 'Final' : 'Draft'" :tone="sheet.status === 'final' ? 'success' : 'neutral'" />
              <StatusBadge v-if="sheet.appliedToQuotationId" label="Applied" tone="info" />
            </div>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Cost Sheet" description="Product Planner belum menyiapkan estimasi biaya untuk Opportunity ini." />
      </SectionCard>

      <!-- Quotation -->
      <SectionCard title="Quotation">
        <template v-if="quotation" #actions>
          <div class="flex flex-wrap gap-2">
            <NuxtLink :to="`/crm/opportunities/${opportunity.id}/quotation-preview`" target="_blank">
              <Button size="sm" variant="outline">
                PDF / Print Preview
              </Button>
            </NuxtLink>
            <template v-if="canManageOpportunity && !['won', 'lost'].includes(opportunity.stage)">
              <Button
                v-if="(quotation.approvalStatus ?? 'draft') === 'draft'"
                size="sm"
                variant="outline"
                @click="openEditQuotationDialog"
              >
                Edit Quotation
              </Button>
              <Button
                v-if="(quotation.approvalStatus ?? 'draft') === 'draft'"
                size="sm"
                variant="outline"
                @click="submitDuplicateQuotation"
              >
                Duplicate Quotation
              </Button>
              <Dialog v-model:open="isReviseDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline" @click="openReviseDialog">
                    Create New Version
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Revisi Quotation (Versi Baru)</DialogTitle>
                    <DialogDescription>Nilai lama akan tersimpan sebagai versi sebelumnya; status approval direset ke Draft.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="revise-amount">Nilai Quotation Baru (Rp)</Label>
                    <Input id="revise-amount" v-model.number="revisedAmount" type="number" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isReviseDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!revisedAmount || revisedAmount <= 0" @click="submitRevise">
                      Simpan Revisi
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
          </div>
        </template>

        <div v-if="quotation" class="space-y-2">
          <div class="flex items-center gap-2">
            <p class="text-2xl font-bold text-foreground">
              {{ formatCurrencyIdr(quotation.amountIdr) }}
            </p>
            <StatusBadge :label="`Versi ${quotation.version}`" tone="info" />
            <StatusBadge v-if="quotation.accepted" label="Accepted" tone="success" />
            <StatusBadge v-if="quotation.sentToClientAt" label="Terkirim ke Client" tone="info" />
          </div>
          <div v-if="quotation.supersededAmountIdr" class="text-xs text-muted-foreground">
            <p>Direvisi dari {{ formatCurrencyIdr(quotation.supersededAmountIdr) }}</p>
            <button type="button" class="text-primary hover:underline" @click="isCompareVersionsOpen = !isCompareVersionsOpen">
              {{ isCompareVersionsOpen ? 'Sembunyikan' : 'Bandingkan' }} dengan versi sebelumnya
            </button>
            <div v-if="isCompareVersionsOpen" class="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Versi Sebelumnya
                </p>
                <p class="text-sm text-foreground">
                  {{ formatCurrencyIdr(quotation.supersededAmountIdr) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Versi {{ quotation.version }} (Saat Ini)
                </p>
                <p class="text-sm text-foreground">
                  {{ formatCurrencyIdr(quotation.amountIdr) }}
                </p>
              </div>
              <p class="col-span-2 text-[11px] text-muted-foreground">
                Hanya nilai total yang disimpan per versi sebelumnya (bukan histori breakdown penuh) — perbandingan lain (discount/tax/markup/service breakdown) mengikuti nilai versi saat ini.
              </p>
            </div>
          </div>
          <p v-if="quotation.sentToClientAt" class="text-xs text-muted-foreground">
            Terkirim ke client pada {{ formatDate(quotation.sentToClientAt) }} (simulasi, bukan email/WA nyata).
          </p>
          <p class="text-xs text-muted-foreground">
            Dibuat {{ formatDate(quotation.createdAt) }}
          </p>

          <div class="mt-2 pt-2 border-t border-border">
            <DetailMetadataList
              :items="[
                { label: 'Discount', value: quotation.discountIdr ? formatCurrencyIdr(quotation.discountIdr) : '—' },
                { label: 'Tax / Fee', value: quotation.taxIdr ? formatCurrencyIdr(quotation.taxIdr) : '—' },
                { label: 'Markup', value: quotation.markupIdr ? formatCurrencyIdr(quotation.markupIdr) : '—' },
                { label: 'Estimated Cost', value: quotation.estimatedCostIdr ? formatCurrencyIdr(quotation.estimatedCostIdr) : '—' },
                { label: 'Estimated Margin', value: quotation.estimatedMarginIdr ? formatCurrencyIdr(quotation.estimatedMarginIdr) : '—' },
                { label: 'Currency', value: quotation.currency || 'IDR' },
                { label: 'Valid Until', value: quotation.validUntil ? formatDate(quotation.validUntil) : '—' },
                { label: 'Payment Terms', value: quotation.paymentTerms || '—' },
              ]"
            />
          </div>
          <div v-if="quotation.serviceBreakdown && quotation.serviceBreakdown.length > 0" class="mt-2">
            <p class="text-xs font-medium text-muted-foreground mb-2">
              Service Breakdown
            </p>
            <ul class="divide-y divide-border">
              <li v-for="(item, index) in quotation.serviceBreakdown" :key="index" class="py-2 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm text-foreground">
                    {{ findStatusOption(SERVICE_TYPES, item.service).label }}
                  </p>
                  <p v-if="item.description" class="text-xs text-muted-foreground truncate">
                    {{ item.description }}
                  </p>
                </div>
                <p class="text-sm text-foreground shrink-0">
                  {{ formatCurrencyIdr(item.amountIdr) }}
                </p>
              </li>
            </ul>
          </div>
          <div v-if="quotation.termsAndConditions || quotation.inclusions || quotation.exclusions" class="mt-2 pt-2 border-t border-border grid gap-3 sm:grid-cols-3">
            <div v-if="quotation.inclusions">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Inclusions
              </p>
              <p class="text-xs text-foreground whitespace-pre-line">
                {{ quotation.inclusions }}
              </p>
            </div>
            <div v-if="quotation.exclusions">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Exclusions
              </p>
              <p class="text-xs text-foreground whitespace-pre-line">
                {{ quotation.exclusions }}
              </p>
            </div>
            <div v-if="quotation.termsAndConditions">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Terms &amp; Conditions
              </p>
              <p class="text-xs text-foreground whitespace-pre-line">
                {{ quotation.termsAndConditions }}
              </p>
            </div>
          </div>
        </div>
        <EmptyState v-else title="Belum ada quotation" description="Quotation akan dibuat saat opportunity ini lanjut ke stage Proposal." />

        <Dialog v-model:open="isEditQuotationDialogOpen">
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Quotation</DialogTitle>
              <DialogDescription>Melengkapi detail komersial selagi quotation masih Draft.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="edit-quo-amount">Nilai Quotation (Rp)</Label>
                <Input id="edit-quo-amount" v-model.number="editQuotationAmount" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-discount">Discount (%)</Label>
                <Input id="edit-quo-discount" v-model.number="editQuotationDiscountPercent" type="number" min="0" max="100" step="0.1" />
                <p v-if="editQuotationDiscount" class="text-xs text-muted-foreground">
                  &asymp; {{ formatCurrencyIdr(editQuotationDiscount) }}
                </p>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-cost">Estimated Cost (Rp)</Label>
                <Input id="edit-quo-cost" v-model.number="editQuotationCost" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label>Estimated Margin (Rp)</Label>
                <div class="px-3 py-2 text-sm rounded-lg border border-input bg-muted/40 text-foreground">
                  {{ editQuotationMargin != null ? formatCurrencyIdr(editQuotationMargin) : '—' }}
                </div>
                <p class="text-xs text-muted-foreground">
                  Dihitung otomatis: Nilai Quotation &minus; Discount &minus; Estimated Cost.
                </p>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-payment-terms">Payment Terms</Label>
                <Input id="edit-quo-payment-terms" v-model="editQuotationPaymentTerms" placeholder="mis. DP 50%, pelunasan H-7" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="edit-quo-tax">Tax / Fee (Rp)</Label>
                  <Input id="edit-quo-tax" v-model.number="editQuotationTax" type="number" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-quo-markup">Markup (Rp)</Label>
                  <Input id="edit-quo-markup" v-model.number="editQuotationMarkup" type="number" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="edit-quo-currency">Currency</Label>
                  <Input id="edit-quo-currency" v-model="editQuotationCurrency" placeholder="IDR" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-quo-valid-until">Valid Until</Label>
                  <Input id="edit-quo-valid-until" v-model="editQuotationValidUntil" type="date" />
                </div>
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label class="!mb-0">Service Breakdown</Label>
                  <Button size="sm" variant="outline" type="button" @click="addBreakdownRow">
                    Tambah Baris
                  </Button>
                </div>
                <div v-for="(item, index) in editServiceBreakdown" :key="index" class="flex items-center gap-2">
                  <select v-model="item.service" class="appearance-none px-2 py-2 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                  <Input v-model="item.description" placeholder="Deskripsi" class="flex-1" />
                  <Input v-model.number="item.amountIdr" type="number" placeholder="Rp" class="w-32" />
                  <Button size="sm" variant="ghost" type="button" @click="removeBreakdownRow(index)">
                    Hapus
                  </Button>
                </div>
                <p v-if="editServiceBreakdown.length === 0" class="text-xs text-muted-foreground">
                  Belum ada baris service breakdown.
                </p>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-inclusions">Inclusions</Label>
                <textarea id="edit-quo-inclusions" v-model="editQuotationInclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Tiket pesawat PP, hotel 3 malam, transportasi lokal" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-exclusions">Exclusions</Label>
                <textarea id="edit-quo-exclusions" v-model="editQuotationExclusions" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Pengeluaran pribadi, asuransi perjalanan" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-quo-terms">Terms &amp; Conditions</Label>
                <textarea id="edit-quo-terms" v-model="editQuotationTerms" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Harga berlaku selama masa validity, DP tidak dapat dikembalikan" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isEditQuotationDialogOpen = false">
                Batal
              </Button>
              <Button :disabled="!editQuotationAmount || editQuotationAmount <= 0" @click="submitEditQuotation">
                Simpan
              </Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </SectionCard>

      <!-- Commercial Approval (Prompt 19 — Change Request) -->
      <SectionCard v-if="quotation" title="Commercial Approval" description="Workflow: Draft → Submitted for Approval → Approved by Management → Negotiation / Final Confirmation → Opportunity Won.">
        <div class="flex items-center gap-2 mb-4">
          <StatusBadge
            :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').label"
            :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').tone"
          />
          <span v-if="quotation.approvedBy" class="text-xs text-muted-foreground">
            oleh {{ getUserById(quotation.approvedBy)?.name ?? quotation.approvedBy }}
          </span>
        </div>
        <p v-if="quotation.approvalNote" class="text-sm text-muted-foreground mb-4">
          Catatan: {{ quotation.approvalNote }}
        </p>

        <div v-if="canManageOpportunity && (quotation.approvalStatus ?? 'draft') === 'draft'">
          <Dialog v-model:open="isSubmitApprovalDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm">
                Submit for Approval
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Quotation for Approval</DialogTitle>
                <DialogDescription>Quotation {{ formatCurrencyIdr(quotation.amountIdr) }} akan diajukan ke Management untuk commercial approval.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" @click="isSubmitApprovalDialogOpen = false">
                  Batal
                </Button>
                <Button @click="submitForCommercialApproval">
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div v-else-if="quotation.approvalStatus === 'submitted'">
          <div v-if="canManageOpportunity" class="mb-2">
            <p class="text-sm text-muted-foreground mb-2">
              Menunggu commercial approval dari Management/Super Admin.
            </p>
            <Button size="sm" variant="outline" @click="submitWithdraw">
              Withdraw Submission
            </Button>
          </div>
          <p v-else-if="!canApproveCommercial" class="text-sm text-muted-foreground">
            Menunggu commercial approval dari Management/Super Admin.
          </p>
          <div v-if="canApproveCommercial" class="flex flex-wrap gap-2">
            <Dialog v-model:open="isApproveCommercialDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm">
                  Approve Commercial
                </Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Approve Commercial Terms</DialogTitle>
                  <DialogDescription>
                    Meninjau nilai quotation {{ formatCurrencyIdr(quotation.amountIdr) }}, discount, estimated margin, payment terms, service scope,
                    kompleksitas project, dan commercial risk. Setelah disetujui, AE dapat melanjutkan ke Negotiation / mengajukan sebagai Won.
                  </DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="approve-commercial-note">Catatan (opsional)</Label>
                  <Input id="approve-commercial-note" v-model="commercialNoteInput" placeholder="mis. Disetujui sesuai standar margin" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isApproveCommercialDialogOpen = false">
                    Batal
                  </Button>
                  <Button @click="submitApproveCommercial">
                    Approve
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog v-model:open="isRejectCommercialDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm" variant="outline">
                  Reject Commercial
                </Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Reject Commercial Terms</DialogTitle>
                  <DialogDescription>AE perlu merevisi quotation sebelum submit ulang.</DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="reject-commercial-note">Catatan</Label>
                  <Input id="reject-commercial-note" v-model="commercialNoteInput" placeholder="mis. Margin terlalu rendah, revisi harga" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isRejectCommercialDialogOpen = false">
                    Batal
                  </Button>
                  <Button variant="destructive" :disabled="!commercialNoteInput.trim()" @click="submitRejectCommercial">
                    Reject
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div v-else-if="quotation.approvalStatus === 'rejected'" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p class="text-sm text-destructive">
            Ditolak — revisi quotation lalu submit ulang untuk approval.
          </p>
        </div>

        <div v-else-if="quotation.approvalStatus === 'approved'">
          <p class="text-sm text-success mb-4">
            Disetujui — AE dapat mengajukan opportunity ini sebagai Won pada stage Negotiation, setelah quotation dikirim dan client mengonfirmasi.
          </p>

          <div class="pt-4 border-t border-border space-y-3">
            <p class="text-xs font-medium text-muted-foreground">
              Send to Client
            </p>
            <div v-if="quotation.sentToClientAt" class="flex items-center gap-2">
              <StatusBadge label="Terkirim ke Client" tone="info" />
              <span class="text-xs text-muted-foreground">pada {{ formatDate(quotation.sentToClientAt) }}</span>
            </div>
            <Button v-if="canManageOpportunity" size="sm" variant="outline" @click="submitSendToClient">
              {{ quotation.sentToClientAt ? 'Kirim Ulang ke Client' : 'Send to Client' }}
            </Button>
          </div>

          <div class="pt-4 mt-4 border-t border-border space-y-3">
            <p class="text-xs font-medium text-muted-foreground">
              Client Confirmation
            </p>
            <template v-if="opportunity.clientConfirmedAt">
              <div class="flex items-center gap-2">
                <StatusBadge label="Client Confirmed" tone="success" />
                <span class="text-xs text-muted-foreground">pada {{ formatDate(opportunity.clientConfirmedAt) }}</span>
              </div>
              <p v-if="opportunity.clientConfirmationNote" class="text-sm text-muted-foreground">
                Catatan: {{ opportunity.clientConfirmationNote }}
              </p>
            </template>
            <template v-else>
              <p class="text-sm text-muted-foreground">
                Belum dikonfirmasi client — gerbang tambahan sebelum AE dapat Mark as Won.
              </p>
              <Dialog v-if="canManageOpportunity" v-model:open="isClientConfirmationDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm">
                    Catat Client Confirmation
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Catat Client Confirmation</DialogTitle>
                    <DialogDescription>Mencatat bahwa client sudah mengonfirmasi quotation ini (verbal/email/WA — mock, bukan integrasi nyata).</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="client-confirmation-note">Catatan (opsional)</Label>
                    <Input id="client-confirmation-note" v-model="clientConfirmationNoteInput" placeholder="mis. Dikonfirmasi via WhatsApp oleh decision maker" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isClientConfirmationDialogOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitClientConfirmation">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>
          </div>
        </div>
      </SectionCard>

      <!-- Activity / Follow-up -->
      <SectionCard title="Activity / Follow-up">
        <template v-if="canManageOpportunity" #actions>
          <Dialog v-model:open="isActivityDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Catat Activity
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Activity Baru</DialogTitle>
                <DialogDescription>Activity akan dicatat untuk opportunity ini dan tampil juga di Party Detail.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="opp-activity-type">Jenis Activity</Label>
                  <select
                    id="opp-activity-type"
                    v-model="activityType"
                    class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="opp-activity-message">Catatan</Label>
                  <Input id="opp-activity-message" v-model="activityMessage" placeholder="mis. Follow-up keputusan quotation" />
                </div>
                <div class="space-y-1.5">
                  <Label for="opp-activity-due">Jadwal Follow-up Mendatang (opsional)</Label>
                  <Input id="opp-activity-due" v-model="activityDueAt" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isActivityDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!activityMessage.trim()" @click="submitActivity">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>

        <ul class="divide-y divide-border">
          <li v-for="activity in activities" :key="activity.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-foreground">
                {{ activity.message }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(activity.createdAt) }}<template v-if="activity.dueAt">
                  · Follow-up dijadwalkan {{ formatDate(activity.dueAt) }}
                </template>
              </p>
            </div>
            <StatusBadge
              :label="findStatusOption(PARTY_ACTIVITY_TYPES, activity.type).label"
              :tone="findStatusOption(PARTY_ACTIVITY_TYPES, activity.type).tone"
            />
          </li>
        </ul>
        <EmptyState v-if="activities.length === 0" title="Belum ada activity untuk opportunity ini" />
      </SectionCard>
    </template>
  </div>
</template>
