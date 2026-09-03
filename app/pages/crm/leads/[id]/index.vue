<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getLeadById, getPartyById, getQuotationByLead, getPartyActivitiesByLead, getUserById,
  createQuotation, reviseQuotation, createPartyActivity,
  getLeadWorkflowStatus, updateQuotationDetails, markLeadWon,
  submitQuotationForApproval, approveQuotation, rejectQuotation,
  duplicateQuotationVersion, sendQuotationToClient, withdrawQuotationSubmission,
  getCostSheetsByLead, getCostSheetBreakdown, getUserByClientPartyId
} from '~/data'
import {
  LEAD_WORKFLOW_STATUSES, SERVICE_TYPES, PARTY_ACTIVITY_TYPES,
  QUOTATION_APPROVAL_STATUSES, LEAD_SOURCES, findStatusOption
} from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import { resolveDestinationGeo } from '~/data/geo'
import type { QuotationServiceItem } from '~/types/quotation'
import type { PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canApprove, can } = usePermissions()
const { showToast } = useToast()

/** Sama seperti `canManageParty` — pengecualian sempit, bukan mekanisme role-check baru. Account Executive
 * yang menerima handover Lead ini yang mengelola Quotation sampai Won. */
const canManageLeadPipeline = computed(() => can('sales.manage-lead-pipeline'))

/** Commercial Approval — Management/Super Admin approve/reject quotation. Setelah disetujui, AE langsung
 * "Mark as Won" satu langkah — tidak ada approval Won terpisah. */
const canApproveCommercial = computed(() => canApprove('sales'))

const lead = computed(() => getLeadById(String(route.params.id)))
useHead({ title: computed(() => lead.value ? (lead.value.title ?? lead.value.companyName ?? lead.value.name) : 'Lead Tidak Ditemukan') })

const party = computed(() => (lead.value?.partyId ? getPartyById(lead.value.partyId) : undefined))
const quotation = computed(() => (lead.value ? getQuotationByLead(lead.value.id) : undefined))
/** Lead tidak menyimpan `destinationGeo` sendiri (disederhanakan — hanya `Project` yang menyimpannya, di-resolve saat Won) — diresolusi langsung di sini untuk peta lokasi. */
const leadGeo = computed(() => (lead.value?.destination ? resolveDestinationGeo(lead.value.destination) : undefined))
const activities = computed(() => (lead.value ? getPartyActivitiesByLead(lead.value.id) : []))

/** Status workflow AE-facing — "indikator stage yang jelas", menggantikan label lama yang membingungkan. */
const workflowStatus = computed(() => (lead.value ? getLeadWorkflowStatus(lead.value.id) : undefined))

/** Product Planning dan Costing — Cost Sheet yang melekat pada Lead ini, kolaborasi Product Planner↔AE.
 * Pengelolaan lengkap (edit/apply) tetap di modul Product Planning, di sini murni ringkasan + link. */
const costSheets = computed(() => (lead.value ? getCostSheetsByLead(lead.value.id) : []))

const summaryMetadata = computed(() => {
  if (!lead.value) { return [] }
  return [
    { label: 'Party / Company', value: party.value?.name ?? '—' },
    { label: 'Contact Person', value: lead.value.name },
    { label: 'Lead Source', value: findStatusOption(LEAD_SOURCES, lead.value.source).label },
    { label: 'Account Executive', value: lead.value.handedOverTo ? (getUserById(lead.value.handedOverTo)?.name ?? '—') : '—' },
    { label: 'Destinasi', value: lead.value.destination ?? '—' },
    {
      label: 'Tanggal Perkiraan',
      value: lead.value.travelStartDate && lead.value.travelEndDate
        ? formatDateRange(lead.value.travelStartDate, lead.value.travelEndDate)
        : 'Belum ditentukan'
    },
    { label: 'Estimasi Traveler', value: lead.value.travelerEstimate ? `${lead.value.travelerEstimate} pax` : '—' },
    { label: 'Do Date', value: lead.value.expectedCloseDate ? formatDate(lead.value.expectedCloseDate) : '—' },
    { label: 'Qualified', value: lead.value.qualifiedAt ? formatDate(lead.value.qualifiedAt) : '—' }
  ]
})

/* Buat Quotation (pertama kali) */
const isProposalDialogOpen = ref(false)
const proposalQuotationAmount = ref<number | null>(null)

function openProposalDialog () {
  proposalQuotationAmount.value = null
  isProposalDialogOpen.value = true
}

function submitProposal () {
  if (!lead.value || !proposalQuotationAmount.value || proposalQuotationAmount.value <= 0) { return }
  createQuotation(lead.value.id, proposalQuotationAmount.value)
  isProposalDialogOpen.value = false
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

/* Edit Quotation — melengkapi detail komersial SELAGI masih draft (belum submitted/approved), tanpa menaikkan versi (beda dari "Revisi Quotation"/Create New Version di atas). */
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

/** "Duplicate Quotation" — salinan persis sebagai versi baru, titik awal edit dari draft yang sudah terisi. */
function submitDuplicateQuotation () {
  if (!quotation.value) { return }
  duplicateQuotationVersion(quotation.value.id)
  showToast('Quotation Diduplikasi', 'Versi baru dibuat sebagai salinan persis dari versi sebelumnya, siap diedit.', 'success')
}

const isCompareVersionsOpen = ref(false)

/* Send to Client / Withdraw */
function submitSendToClient () {
  if (!quotation.value || !lead.value?.partyId) { return }
  sendQuotationToClient(quotation.value.id, currentUser.value.id)
  const clientUser = getUserByClientPartyId(lead.value.partyId)
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

/**
 * Mark as Won — AE langsung mengeksekusi Won setelah Quotation `approved` oleh Management, satu langkah
 * (tidak ada approval Won kedua terpisah dari Management — disederhanakan sejak Opportunity dihapus).
 */
const isMarkAsWonDialogOpen = ref(false)

function submitMarkAsWon () {
  if (!lead.value || !quotation.value || quotation.value.approvalStatus !== 'approved') { return }
  const project = markLeadWon(lead.value.id, quotation.value.approvedBy ?? currentUser.value.id)
  isMarkAsWonDialogOpen.value = false
  if (!project) {
    showToast('Mark as Won Gagal', 'Data belum lengkap atau lead sudah diproses sebelumnya.', 'error')
    return
  }
  const clientUser = getUserByClientPartyId(project.partyId)
  const accountMessage = clientUser
    ? ` Client login account (${clientUser.email}) dapat diakses lewat Settings > Role Switcher.`
    : ''
  showToast('Lead Won', `${project.name} (${project.id}) dibuat, client aktif, dan Project Order otomatis dibuat.${accountMessage}`, 'success')
  router.push(`/project-orders/${project.id}`)
}

/* Commercial Approval — AE submit quotation untuk approval, Management approve/reject. */
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
  showToast('Quotation Disetujui', 'AE dapat melanjutkan ke Mark as Won.', 'success')
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
  if (!lead.value?.partyId || !activityMessage.value.trim()) { return }
  createPartyActivity({
    partyId: lead.value.partyId,
    leadId: lead.value.id,
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
    <template v-if="!lead">
      <PageHeader title="Lead Tidak Ditemukan" :breadcrumb="[{ label: 'Sales Pipeline', to: '/sales/pipeline#leads' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Lead tidak ditemukan"
          :description="`Lead dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/sales/pipeline#leads')">
            Kembali ke Daftar Lead
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('sales')" module-label="modul Sales" />

    <template v-else>
      <PageHeader
        :title="lead.title ?? lead.companyName ?? lead.name"
        :breadcrumb="[{ label: 'Sales Pipeline', to: '/sales/pipeline#leads' }, { label: lead.title ?? lead.name }]"
      >
        <template #actions>
          <StatusBadge
            v-if="workflowStatus"
            :label="findStatusOption(LEAD_WORKFLOW_STATUSES, workflowStatus).label"
            :tone="findStatusOption(LEAD_WORKFLOW_STATUSES, workflowStatus).tone"
          />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div class="mt-4">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Peta Lokasi
          </p>
          <DestinationMap :geo="leadGeo" :destination-text="lead.destination" />
        </div>
        <div class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Service Scope
          </p>
          <div class="flex flex-wrap gap-2 mb-4">
            <StatusBadge
              v-for="type in SERVICE_TYPES.filter(t => lead!.serviceScope?.includes(t.value))"
              :key="type.value"
              :label="type.label"
              :tone="type.tone"
            />
          </div>
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Qualification Summary
          </p>
          <p class="text-sm text-foreground">
            {{ lead.requirementSummary || 'Requirement belum digali.' }}
          </p>
        </div>
      </SectionCard>

      <!-- Project Planning & Costing -->
      <SectionCard title="Product Planning & Costing" description="Cost Sheet yang disiapkan Product Planner untuk Lead ini — kolaborasi sebelum Quotation dibentuk.">
        <template #actions>
          <NuxtLink :to="`/product-planning?leadId=${lead.id}&create=1#cost-sheets`">
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
        <EmptyState v-else title="Belum ada Cost Sheet" description="Product Planner belum menyiapkan estimasi biaya untuk Lead ini." />
      </SectionCard>

      <!-- Quotation -->
      <SectionCard title="Quotation">
        <template v-if="quotation" #actions>
          <div class="flex flex-wrap gap-2">
            <NuxtLink :to="`/crm/leads/${lead.id}/quotation-preview`" target="_blank">
              <Button size="sm" variant="outline">
                PDF / Print Preview
              </Button>
            </NuxtLink>
            <template v-if="canManageLeadPipeline && !lead.projectId">
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
                    <CurrencyInput id="revise-amount" v-model="revisedAmount" />
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
        <EmptyState v-else :icon="FileX" title="Belum ada quotation" description="Buat quotation untuk melanjutkan Lead ini ke commercial approval.">
          <Dialog v-if="canManageLeadPipeline" v-model:open="isProposalDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" @click="openProposalDialog">
                Buat Quotation
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Buat Quotation</DialogTitle>
                <DialogDescription>Masukkan nilai quotation awal untuk Lead ini.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="proposal-amount">Nilai Quotation (Rp)</Label>
                <CurrencyInput id="proposal-amount" v-model="proposalQuotationAmount" placeholder="mis. 100000000" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isProposalDialogOpen = false">
                  Batal
                </Button>
                <Button :disabled="!proposalQuotationAmount || proposalQuotationAmount <= 0" @click="submitProposal">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </EmptyState>

        <Dialog v-model:open="isEditQuotationDialogOpen">
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Quotation</DialogTitle>
              <DialogDescription>Melengkapi detail komersial selagi quotation masih Draft.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="edit-quo-amount">Nilai Quotation (Rp)</Label>
                <CurrencyInput id="edit-quo-amount" v-model="editQuotationAmount" />
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
                <CurrencyInput id="edit-quo-cost" v-model="editQuotationCost" />
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
                  <CurrencyInput id="edit-quo-tax" v-model="editQuotationTax" />
                </div>
                <div class="space-y-1.5">
                  <Label for="edit-quo-markup">Markup (Rp)</Label>
                  <CurrencyInput id="edit-quo-markup" v-model="editQuotationMarkup" />
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
                  <CurrencyInput v-model="item.amountIdr" placeholder="Rp" class="w-32" />
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

      <!-- Commercial Approval & Mark as Won -->
      <SectionCard v-if="quotation" title="Commercial Approval" description="Workflow: Draft → Submitted for Approval → Approved by Management → Mark as Won.">
        <div v-if="lead.projectId" class="rounded-lg border border-success/30 bg-success/5 p-3">
          <p class="text-sm font-medium text-success">
            Won
          </p>
          <NuxtLink :to="`/project-orders/${lead.projectId}`" class="text-sm text-primary hover:underline">
            Lihat Project hasil konversi ({{ lead.projectId }}) →
          </NuxtLink>
        </div>

        <template v-else>
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

          <div v-if="canManageLeadPipeline && (quotation.approvalStatus ?? 'draft') === 'draft'">
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
            <div v-if="canManageLeadPipeline" class="mb-2">
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
                      kompleksitas project, dan commercial risk. Setelah disetujui, AE dapat langsung Mark as Won.
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
              Disetujui — AE dapat langsung Mark as Won.
            </p>

            <div class="pt-4 border-t border-border space-y-3">
              <p class="text-xs font-medium text-muted-foreground">
                Send to Client
              </p>
              <div v-if="quotation.sentToClientAt" class="flex items-center gap-2">
                <StatusBadge label="Terkirim ke Client" tone="info" />
                <span class="text-xs text-muted-foreground">pada {{ formatDate(quotation.sentToClientAt) }}</span>
              </div>
              <Button v-if="canManageLeadPipeline" size="sm" variant="outline" @click="submitSendToClient">
                {{ quotation.sentToClientAt ? 'Kirim Ulang ke Client' : 'Send to Client' }}
              </Button>
            </div>

            <div v-if="canManageLeadPipeline" class="pt-4 mt-4 border-t border-border">
              <Dialog v-model:open="isMarkAsWonDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm">
                    Mark as Won
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Mark as Won</DialogTitle>
                    <DialogDescription>
                      Project baru akan otomatis dibuat dari Lead ini (destinasi {{ lead.destination }},
                      {{ lead.travelerEstimate }} pax<template v-if="party?.lifecycleStatus === 'prospect'">
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
            </div>
          </div>
        </template>
      </SectionCard>

      <!-- Activity / Follow-up -->
      <SectionCard title="Activity / Follow-up">
        <template v-if="canManageLeadPipeline" #actions>
          <Dialog v-model:open="isActivityDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Catat Activity
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Activity Baru</DialogTitle>
                <DialogDescription>Activity akan dicatat untuk Lead ini dan tampil juga di Party Detail.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="lead-activity-type">Jenis Activity</Label>
                  <select
                    id="lead-activity-type"
                    v-model="activityType"
                    class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="lead-activity-message">Catatan</Label>
                  <Input id="lead-activity-message" v-model="activityMessage" placeholder="mis. Follow-up keputusan quotation" />
                </div>
                <div class="space-y-1.5">
                  <Label for="lead-activity-due">Jadwal Follow-up Mendatang (opsional)</Label>
                  <Input id="lead-activity-due" v-model="activityDueAt" type="date" />
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
        <EmptyState v-if="activities.length === 0" title="Belum ada activity untuk Lead ini" />
      </SectionCard>
    </template>
  </div>
</template>
