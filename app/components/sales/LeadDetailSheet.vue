<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Archive as ArchiveIcon, Building2, User, UserCheck, Phone, Mail, CalendarClock, Calendar, FileX } from 'lucide-vue-next'
import { matchesAnyRole } from '~/data/rbac'
import {
  USERS, getLeadById, getLeadActivities, getLeadFollowUps, createLeadActivity, archiveLead,
  qualifyLeadForQuotation, qualifyLeadAndCreateSalesOrder, updateLeadQualification, markLeadUnqualified,
  reopenLead, updateLeadContact, getLeadDuplicateCandidates, mergeLeadAsDuplicate,
  getUserById, getOpenGroupProjects, getProjectById, getProjectSeatsFilled,
  getProjectSeatsAvailable, qualifyGroupTripLead,
  getQuotationByLead, createQuotation, reviseQuotation, updateQuotationDetails,
  submitQuotationForApproval, approveQuotation, rejectQuotation, duplicateQuotationVersion,
  sendQuotationToClient, withdrawQuotationSubmission, markLeadWon,
  getCostSheetsByLead, getCostSheetBreakdown, getUserByClientPartyId
} from '~/data'
import {
  LEAD_SOURCES, LEAD_STAGES, LEAD_SERVICE_CATEGORIES, LEAD_URGENCY_LEVELS, SERVICE_TYPES,
  PARTY_ACTIVITY_TYPES, B2C_PRICE_ACCEPTANCE_OPTIONS, B2C_BOOKING_READINESS_OPTIONS, B2C_QUALIFICATION_RESULT_OPTIONS,
  QUOTATION_APPROVAL_STATUSES,
  findStatusOption
} from '~/constants/status'
import { formatDate, formatDateRange, formatCurrencyIdr } from '~/utils/format'
import { isFollowUpUpcoming, MINIMUM_DP_PERCENT } from '~/utils/attention'
import type { Lead, LeadSource, LeadServiceCategory, LeadUrgency, B2cPriceAcceptance, B2cBookingReadiness, B2cQualificationResult } from '~/types/lead'
import type { ServiceTypeKey } from '~/types/project'
import type { QuotationServiceItem } from '~/types/quotation'
import type { PartyActivityType } from '~/types/party'

const props = defineProps<{
  open: boolean
  leadId: string | null
  /** Tab yang aktif saat sheet dibuka — dipakai caller seperti `SalesQuotationsPanel` yang mau langsung
   * membuka tab "Quotation" (bukan selalu "overview") tanpa user harus klik tab manual. */
  initialTab?: 'overview' | 'qualification' | 'quotation' | 'activities' | 'followups'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { currentUser } = useCurrentUser()
const { can, canApprove } = usePermissions()
const { showToast } = useToast()

/** Narrow role exception (pola Section 07/08) — Sales mengelola screening/qualification, AE menerima handover, Super Admin oversight. */
const canManageLead = computed(() => can('sales.manage-lead'))
/** Permission Quotation/Commercial Approval BEDA dari qualification di atas — AE yang mengelola quotation sampai Won, bukan Sales. */
const canManageLeadPipeline = computed(() => can('sales.manage-lead-pipeline'))
/** Management/Super Admin approve/reject quotation. Setelah disetujui, AE langsung "Mark as Won" satu langkah — tidak ada approval Won terpisah. */
const canApproveCommercial = computed(() => canApprove('sales'))

function ownerName (ownerId: string) {
  return getUserById(ownerId)?.name ?? ownerId
}

/* Detail drawer */
const selectedLead = computed(() => (props.leadId ? getLeadById(props.leadId) ?? null : null))

/** Baris detail tab Overview — ikon + label + value satu kolom, pola sama "Ringkasan Layanan"
 * (app/pages/project-orders/[id]/index.vue), menggantikan grid 4-kolom DetailMetadataList yang
 * ragged di lebar Sheet ini. */
const overviewDetailRows = computed(() => {
  const lead = selectedLead.value
  if (!lead) { return [] }
  return [
    { icon: Building2, label: 'Nama Company', value: lead.companyName || '—' },
    { icon: User, label: 'Owner (Sales)', value: ownerName(lead.ownerId) },
    { icon: UserCheck, label: 'Account Executive Tujuan', value: lead.handedOverTo ? ownerName(lead.handedOverTo) : 'Belum ditentukan' },
    { icon: Phone, label: 'Telepon', value: lead.phone || '—' },
    { icon: Mail, label: 'Email', value: lead.email || '—' },
    { icon: CalendarClock, label: 'Do Date', value: lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—' },
    { icon: Calendar, label: 'Dibuat', value: formatDate(lead.createdAt) }
  ]
})
const selectedActivities = computed(() => (selectedLead.value ? getLeadActivities(selectedLead.value.id) : []))
const selectedFollowUps = computed(() => (selectedLead.value ? getLeadFollowUps(selectedLead.value.id) : []))
/** Quotation + Cost Sheet tab (B2B) — sebelumnya halaman tersendiri `/crm/leads/[id]`, sekarang tab di sheet ini supaya alur qualify → quotation tidak pindah layar. */
const quotation = computed(() => (selectedLead.value ? getQuotationByLead(selectedLead.value.id) : undefined))
const costSheets = computed(() => (selectedLead.value ? getCostSheetsByLead(selectedLead.value.id) : []))
const drawerTab = ref<'overview' | 'qualification' | 'quotation' | 'activities' | 'followups'>('overview')

/** Tujuan handover Lead — dulu role `account-executive`, kini melebur ke `sales`. */
const aeOptions = computed(() => USERS.filter(user => matchesAnyRole(user.role, ['account-executive'])))

/**
 * Qualification form (Prompt 20 — Change Request) — refs lokal disinkronkan dari `selectedLead` saat
 * drawer dibuka, ditulis balik lewat `updateLeadQualification` ("Simpan Draft") atau sebagai bagian dari
 * "Qualify" (draft disimpan dulu, baru gate dicek).
 */
const qualServiceCategory = ref<LeadServiceCategory | ''>('')
const qualDestination = ref('')
const qualTravelStart = ref('')
const qualTravelEnd = ref('')
const qualTravelerEstimate = ref<number | null>(null)
const qualServiceScope = ref<ServiceTypeKey[]>([])
const qualRequirementSummary = ref('')
const qualHandedOverTo = ref('')
const qualBudgetRange = ref('')

/** Kategori Estimasi Budget (dulu free-text) — pilihan tetap supaya data lebih konsisten untuk filtering/reporting. */
const BUDGET_RANGE_OPTIONS = [
  '< Rp 50 Juta',
  'Rp 50 Juta - Rp 100 Juta',
  'Rp 100 Juta - Rp 200 Juta',
  'Rp 200 Juta - Rp 500 Juta',
  'Rp 500 Juta - Rp 1 Miliar',
  '> Rp 1 Miliar'
]
/** Lead lama yang budget-nya masih free-text (belum cocok kategori di atas) tetap tampil sebagai pilihan
 * sendiri, supaya nilai tersimpannya tidak diam-diam hilang saat drawer dibuka. */
const budgetRangeOptions = computed(() => (
  qualBudgetRange.value && !BUDGET_RANGE_OPTIONS.includes(qualBudgetRange.value)
    ? [qualBudgetRange.value, ...BUDGET_RANGE_OPTIONS]
    : BUDGET_RANGE_OPTIONS
))
const qualDateFlexible = ref(false)
const qualDecisionMaker = ref('')
const qualUrgency = ref<LeadUrgency | ''>('')
const qualSpecialRequestNote = ref('')
const qualCommunicationNotes = ref('')
const qualExpectedCloseDate = ref('')

/** Group Trip B2C Qualification — hanya relevan saat `qualServiceCategory === 'individual-travel'` DAN
 * `qualGroupTripProjectId` terisi (Lead B2C tanpa pilih Project tetap pakai flow lama, tidak berubah). */
const qualGroupTripProjectId = ref('')
const qualAdultCount = ref<number | null>(null)
const qualChildCount = ref<number | null>(null)
const qualInfantCount = ref<number | null>(null)
const qualPriceAcceptance = ref<B2cPriceAcceptance | ''>('')
const qualBookingReadiness = ref<B2cBookingReadiness | ''>('')
const qualB2cResult = ref<B2cQualificationResult | ''>('')
const qualNextFollowUpDate = ref('')
const qualPackagePriceIdr = ref<number | null>(null)

function syncQualificationForm (lead: Lead) {
  qualServiceCategory.value = lead.serviceCategory ?? ''
  qualDestination.value = lead.destination ?? ''
  qualTravelStart.value = lead.travelStartDate ?? ''
  qualTravelEnd.value = lead.travelEndDate ?? ''
  qualTravelerEstimate.value = lead.travelerEstimate ?? null
  qualServiceScope.value = [...(lead.serviceScope ?? [])]
  qualRequirementSummary.value = lead.requirementSummary ?? ''
  qualHandedOverTo.value = lead.handedOverTo ?? ''
  qualBudgetRange.value = lead.budgetRange ?? ''
  qualDateFlexible.value = lead.dateFlexible ?? false
  qualDecisionMaker.value = lead.decisionMaker ?? ''
  qualUrgency.value = lead.urgency ?? ''
  qualSpecialRequestNote.value = lead.specialRequestNote ?? ''
  qualCommunicationNotes.value = lead.qualificationNotes ?? ''
  qualExpectedCloseDate.value = lead.expectedCloseDate ?? ''
  qualGroupTripProjectId.value = lead.groupTripProjectId ?? ''
  qualAdultCount.value = lead.b2cAdultCount ?? null
  qualChildCount.value = lead.b2cChildCount ?? null
  qualInfantCount.value = lead.b2cInfantCount ?? null
  qualPriceAcceptance.value = lead.b2cPriceAcceptance ?? ''
  qualBookingReadiness.value = lead.b2cBookingReadiness ?? ''
  qualB2cResult.value = lead.b2cQualificationResult ?? ''
  qualNextFollowUpDate.value = lead.b2cNextFollowUpDate ?? ''
  qualPackagePriceIdr.value = null
}

watch(() => props.open, (isOpen) => {
  if (isOpen && selectedLead.value) {
    drawerTab.value = props.initialTab ?? 'overview'
    syncQualificationForm(selectedLead.value)
  }
})

/** Project B2C terpilih (untuk ringkasan read-only) dan turunan seat/harga — dipakai template & watcher di bawah. */
const qualSelectedGroupTripProject = computed(() => (qualGroupTripProjectId.value ? getProjectById(qualGroupTripProjectId.value) : undefined))
const qualRequestedPax = computed(() => (qualAdultCount.value ?? 0) + (qualChildCount.value ?? 0) + (qualInfantCount.value ?? 0))
const qualSeatsAvailable = computed(() => (qualSelectedGroupTripProject.value ? getProjectSeatsAvailable(qualSelectedGroupTripProject.value.id) : 0))
const qualPricePerPax = computed(() => {
  const project = qualSelectedGroupTripProject.value
  return project && project.travelerCount > 0 ? Math.round(project.quotationAmountIdr / project.travelerCount) : 0
})

/** Destinasi/tanggal/estimasi-traveler/service-scope di-auto-isi dari Project B2C dipilih — supaya gate
 * `getLeadMissingQualification`/`qualificationMissing` (field yang sama, tidak diubah) tetap lolos tanpa
 * user isi manual field yang sudah ditampilkan read-only dari Project. */
watch(qualSelectedGroupTripProject, (project) => {
  if (!project) { return }
  qualDestination.value = project.destination
  qualTravelStart.value = project.travelStartDate
  qualTravelEnd.value = project.travelEndDate
  qualServiceScope.value = [...project.serviceScope]
})
watch(qualRequestedPax, (pax) => {
  if (qualGroupTripProjectId.value) { qualTravelerEstimate.value = pax || null }
})
watch([qualSelectedGroupTripProject, qualRequestedPax], ([project, pax]) => {
  if (project && pax > 0) { qualPackagePriceIdr.value = qualPricePerPax.value * pax }
})

function toggleQualServiceScope (type: ServiceTypeKey) {
  const index = qualServiceScope.value.indexOf(type)
  if (index === -1) { qualServiceScope.value.push(type) } else { qualServiceScope.value.splice(index, 1) }
}

/** Mirror `getLeadMissingQualification` (app/data/index.ts) terhadap state form LIVE (belum tersimpan), agar gate terlihat real-time saat mengisi form. */
const qualificationMissing = computed(() => {
  const missing: string[] = []
  if (!qualServiceCategory.value) { missing.push('Jenis kebutuhan') }
  if (!qualDestination.value.trim()) { missing.push('Destinasi belum diisi') }
  if (!qualTravelStart.value || !qualTravelEnd.value) { missing.push('Periode perjalanan belum diisi') }
  if (!qualTravelerEstimate.value) { missing.push('Estimasi traveler belum diisi') }
  if (qualServiceScope.value.length === 0) { missing.push('Service scope belum dipilih') }
  if (qualServiceCategory.value !== 'individual-travel' && !qualHandedOverTo.value) { missing.push('Account Executive belum dipilih') }
  if (!qualRequirementSummary.value.trim()) { missing.push('Ringkasan kebutuhan belum diisi') }
  return missing
})
const qualificationCompletedCount = computed(() => 7 - qualificationMissing.value.length)

function doArchive () {
  if (!selectedLead.value) { return }
  archiveLead(selectedLead.value.id)
  emit('update:open', false)
}

/** "Reopen" (Section 04) — kebalikan Archive, drawer tetap terbuka agar Sales bisa lanjut mengerjakan. */
function doReopen () {
  if (!selectedLead.value) { return }
  reopenLead(selectedLead.value.id)
}

/** "Edit Lead" (Section 04) — field kontak dasar, terpisah dari form Qualification. */
const isEditLeadOpen = ref(false)
const editName = ref('')
const editCompanyName = ref('')
const editSource = ref<LeadSource>('website')
const editPhone = ref('')
const editEmail = ref('')

function openEditLeadDialog () {
  if (!selectedLead.value) { return }
  editName.value = selectedLead.value.name
  editCompanyName.value = selectedLead.value.companyName ?? ''
  editSource.value = selectedLead.value.source
  editPhone.value = selectedLead.value.phone ?? ''
  editEmail.value = selectedLead.value.email ?? ''
  isEditLeadOpen.value = true
}

function submitEditLead () {
  if (!selectedLead.value || !editName.value.trim()) { return }
  updateLeadContact(selectedLead.value.id, {
    name: editName.value.trim(),
    companyName: editCompanyName.value.trim() || undefined,
    source: editSource.value,
    phone: editPhone.value.trim() || undefined,
    email: editEmail.value.trim() || undefined
  })
  isEditLeadOpen.value = false
}

/** Merge suggestion (Section 04) — kandidat duplikat lead yang sedang dibuka di drawer. */
const selectedLeadDuplicates = computed(() => (
  selectedLead.value
    ? getLeadDuplicateCandidates({ phone: selectedLead.value.phone, email: selectedLead.value.email, excludeLeadId: selectedLead.value.id })
    : []
))
const isMergeDialogOpen = ref(false)
const mergeTarget = ref<Lead | null>(null)

function openMergeDialog (candidate: Lead) {
  mergeTarget.value = candidate
  isMergeDialogOpen.value = true
}

function doMergeDuplicate () {
  if (!selectedLead.value || !mergeTarget.value) { return }
  mergeLeadAsDuplicate(selectedLead.value.id, mergeTarget.value.id, currentUser.value.id)
  isMergeDialogOpen.value = false
  mergeTarget.value = null
  emit('update:open', false)
}

function saveQualificationDraft () {
  if (!selectedLead.value) { return }
  updateLeadQualification(selectedLead.value.id, {
    serviceCategory: qualServiceCategory.value || undefined,
    destination: qualDestination.value.trim() || undefined,
    travelStartDate: qualTravelStart.value || undefined,
    travelEndDate: qualTravelEnd.value || undefined,
    travelerEstimate: qualTravelerEstimate.value ?? undefined,
    serviceScope: qualServiceScope.value,
    requirementSummary: qualRequirementSummary.value.trim() || undefined,
    handedOverTo: qualHandedOverTo.value || undefined,
    budgetRange: qualBudgetRange.value.trim() || undefined,
    dateFlexible: qualDateFlexible.value,
    decisionMaker: qualDecisionMaker.value.trim() || undefined,
    urgency: qualUrgency.value || undefined,
    specialRequestNote: qualSpecialRequestNote.value.trim() || undefined,
    qualificationNotes: qualCommunicationNotes.value.trim() || undefined,
    expectedCloseDate: qualExpectedCloseDate.value || undefined,
    groupTripProjectId: qualGroupTripProjectId.value || undefined
  })
}

/**
 * Qualify — dispatch berdasarkan `serviceCategory`: individual-travel (B2C) langsung jadi Sales Order
 * (mengumpulkan harga dulu), kategori lain (B2B) di-qualify saja lalu tab sheet pindah ke tab "Quotation"
 * untuk membuat Quotation di sana (dulu navigateTo halaman terpisah, sekarang tetap di sheet yang sama).
 * Lihat komentar desain di `app/types/lead.ts`.
 */
const isIndividualTravel = computed(() => selectedLead.value?.serviceCategory === 'individual-travel')
/** Sudah lanjut ke deal (Quotation/Project/Sales Order) — pengganti cek `Boolean(selectedLead.opportunityId)` lama. */
const isLeadConverted = computed(() => Boolean(selectedLead.value?.quotationId || selectedLead.value?.projectId || selectedLead.value?.salesOrderId))
const isQualifyDialogOpen = ref(false)
const qualifySalesOrderPriceIdr = ref<number | null>(null)

function openQualifyDialog () {
  qualifySalesOrderPriceIdr.value = null
  isQualifyDialogOpen.value = true
}

/**
 * Qualify — Lead B2C tanpa Project B2C dipilih (`qualGroupTripProjectId` kosong) TETAP pakai jalur lama
 * persis (Dialog kecil isi harga → `qualifyLeadAndCreateSalesOrder` langsung, booking standalone). Lead B2C
 * DENGAN Project dipilih dipisah ke `doQualifyGroupTrip` (tombol beda, tidak lewat Dialog ini).
 */
function doQualify () {
  if (!selectedLead.value || qualificationMissing.value.length > 0) { return }
  saveQualificationDraft()

  if (isIndividualTravel.value) {
    if (!qualifySalesOrderPriceIdr.value || qualifySalesOrderPriceIdr.value <= 0) { return }
    const order = qualifyLeadAndCreateSalesOrder(selectedLead.value.id, { priceIdr: qualifySalesOrderPriceIdr.value })
    isQualifyDialogOpen.value = false
    if (order) { navigateTo(`/sales-orders/${order.id}`) }
    return
  }

  const qualified = qualifyLeadForQuotation(selectedLead.value.id)
  isQualifyDialogOpen.value = false
  /** Dulu navigateTo halaman terpisah `/crm/leads/[id]` — sekarang cukup pindah tab dalam sheet yang sama, tidak membingungkan user dengan pindah layar. */
  if (qualified) { drawerTab.value = 'quotation' }
}

/** Group Trip B2C — Lead dengan `qualGroupTripProjectId` terisi. Dispatch berdasarkan Qualification Result
 * yang dipilih user, bukan lewat Dialog "Qualify" biasa (hasilnya sudah eksplisit di dropdown). */
function doQualifyGroupTrip () {
  if (!selectedLead.value || !qualGroupTripProjectId.value) { return }
  saveQualificationDraft()

  if (qualB2cResult.value === 'not-qualified') {
    markLeadUnqualified(selectedLead.value.id, qualSpecialRequestNote.value.trim() || undefined)
    emit('update:open', false)
    return
  }

  if (qualB2cResult.value === 'follow-up') {
    updateLeadQualification(selectedLead.value.id, {
      b2cQualificationResult: 'follow-up',
      b2cNextFollowUpDate: qualNextFollowUpDate.value || undefined
    })
    if (qualNextFollowUpDate.value) {
      createLeadActivity({ leadId: selectedLead.value.id, type: 'note', message: 'Follow-up dijadwalkan', ownerId: currentUser.value.id, dueAt: qualNextFollowUpDate.value })
    }
    showToast('Follow-up Disimpan', 'Lead tetap aktif, ditandai untuk follow-up berikutnya.', 'success')
    return
  }

  // 'qualified' atau 'waitlist' (pilihan manual) — qualifyGroupTripLead yang final-kan; bisa di-downgrade
  // paksa jadi waitlist kalau ternyata seat sudah tidak cukup saat submit.
  const result = qualifyGroupTripLead(selectedLead.value.id, {
    adultCount: qualAdultCount.value ?? 0,
    childCount: qualChildCount.value ?? 0,
    infantCount: qualInfantCount.value ?? 0,
    priceAcceptance: qualPriceAcceptance.value || 'need-discussion',
    bookingReadiness: qualBookingReadiness.value || 'still-considering',
    priceIdr: qualPackagePriceIdr.value ?? 0
  })
  if (result?.outcome === 'waitlist') {
    showToast('Masuk Waitlist', 'Seat tidak cukup — Lead ditandai Waitlist untuk Project ini.', 'warning')
  } else if (result?.outcome === 'qualified') {
    showToast('Qualified — Awaiting DP', `${result.order.id} dibuat, menunggu DP.`, 'success')
    emit('update:open', false)
  }
}

const isUnqualifyDialogOpen = ref(false)
const unqualifyNote = ref('')
function doMarkUnqualified () {
  if (!selectedLead.value) { return }
  saveQualificationDraft()
  markLeadUnqualified(selectedLead.value.id, unqualifyNote.value.trim() || undefined)
  unqualifyNote.value = ''
  isUnqualifyDialogOpen.value = false
  emit('update:open', false)
}

/* Tab Quotation (B2B) — buat Quotation pertama kali */
const isProposalDialogOpen = ref(false)
const proposalQuotationAmount = ref<number | null>(null)

function openProposalDialog () {
  proposalQuotationAmount.value = null
  isProposalDialogOpen.value = true
}

function submitProposal () {
  if (!selectedLead.value || !proposalQuotationAmount.value || proposalQuotationAmount.value <= 0) { return }
  createQuotation(selectedLead.value.id, proposalQuotationAmount.value)
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
  if (!quotation.value || !selectedLead.value?.partyId) { return }
  sendQuotationToClient(quotation.value.id, currentUser.value.id)
  const clientUser = getUserByClientPartyId(selectedLead.value.partyId)
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
  if (!selectedLead.value || !quotation.value || quotation.value.approvalStatus !== 'approved') { return }
  const project = markLeadWon(selectedLead.value.id, quotation.value.approvedBy ?? currentUser.value.id)
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
  emit('update:open', false)
  navigateTo(`/project-orders/${project.id}`)
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

/* Catat Activity/Follow-up dari drawer */
const isActivityDialogOpen = ref(false)
const activityType = ref<PartyActivityType>('call')
const activityMessage = ref('')
const activityDueAt = ref('')

function submitActivity () {
  if (!selectedLead.value || !activityMessage.value.trim()) { return }
  createLeadActivity({
    leadId: selectedLead.value.id,
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
  <Sheet :open="open" @update:open="value => emit('update:open', value)">
    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
      <template v-if="selectedLead">
        <SheetHeader>
          <SheetTitle>{{ selectedLead.name }}</SheetTitle>
          <SheetDescription>{{ selectedLead.companyName || 'Individual lead' }} · {{ selectedLead.id }}</SheetDescription>
        </SheetHeader>

        <div class="flex flex-wrap items-center gap-2 mt-4">
          <StatusBadge :label="findStatusOption(LEAD_STAGES, selectedLead.stage).label" :tone="findStatusOption(LEAD_STAGES, selectedLead.stage).tone" />
          <StatusBadge :label="findStatusOption(LEAD_SOURCES, selectedLead.source).label" :tone="findStatusOption(LEAD_SOURCES, selectedLead.source).tone" />
          <StatusBadge v-if="selectedLead.archived" label="Archived" tone="neutral" />
          <!-- Completion indicator + status handover (Prompt 20-14) -->
          <StatusBadge
            v-if="!isLeadConverted && selectedLead.stage !== 'unqualified'"
            :label="`Qualification ${qualificationCompletedCount}/7`"
            :tone="qualificationMissing.length === 0 ? 'success' : 'warning'"
          />
          <StatusBadge v-if="selectedLead.handedOverTo" label="Sudah diserahkan ke AE" tone="info" />
        </div>

        <Tabs v-model="drawerTab" class="mt-4">
          <TabsList>
            <TabsTrigger value="overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="qualification">
              Qualification
            </TabsTrigger>
            <TabsTrigger v-if="!isIndividualTravel" value="quotation">
              Quotation
            </TabsTrigger>
            <TabsTrigger value="activities">
              Activities
            </TabsTrigger>
            <TabsTrigger value="followups">
              Follow-ups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" class="space-y-4">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Detail Lead
              </p>
              <ul class="space-y-3">
                <li v-for="row in overviewDetailRows" :key="row.label" class="flex items-center justify-between gap-3 text-sm">
                  <span class="flex items-center gap-2 text-muted-foreground">
                    <component :is="row.icon" class="h-4 w-4 shrink-0 text-primary" />{{ row.label }}
                  </span>
                  <span class="font-medium text-foreground text-right">{{ row.value }}</span>
                </li>
              </ul>
            </div>

            <div class="pt-4 mt-4 border-t border-border space-y-4">
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Catatan
              </p>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">
                  Qualification Summary
                </p>
                <p class="text-sm text-foreground">
                  {{ selectedLead.requirementSummary || 'Belum diisi — lihat tab Qualification.' }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1">
                  Catatan Hasil Komunikasi
                </p>
                <p class="text-sm text-foreground">
                  {{ selectedLead.qualificationNotes || 'Belum ada catatan.' }}
                </p>
              </div>
            </div>
            <div v-if="selectedLead.quotationId" class="rounded-lg border border-success/30 bg-success/5 p-3">
              <p class="text-sm text-success">
                Sudah di-qualify —
                <button type="button" class="underline" @click="drawerTab = 'quotation'">
                  lihat Quotation & Commercial Approval
                </button>
              </p>
            </div>
            <div v-else-if="selectedLead.salesOrderId" class="rounded-lg border border-success/30 bg-success/5 p-3">
              <p class="text-sm text-success">
                Sudah dikonversi —
                <NuxtLink :to="`/sales-orders/${selectedLead.salesOrderId}`" class="underline">
                  lihat Sales Order {{ selectedLead.salesOrderId }}
                </NuxtLink>
              </p>
            </div>

            <!-- Merge suggestion (Section 04) -->
            <div v-if="selectedLeadDuplicates.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p class="text-sm font-medium text-warning mb-2">
                Lead Serupa Terdeteksi
              </p>
              <ul class="space-y-2">
                <li v-for="candidate in selectedLeadDuplicates" :key="candidate.id" class="flex items-center justify-between gap-2">
                  <span class="text-xs text-foreground">{{ candidate.name }} ({{ candidate.id }})<span v-if="candidate.companyName"> — {{ candidate.companyName }}</span></span>
                  <Button v-if="canManageLead" size="sm" variant="outline" @click="openMergeDialog(candidate)">
                    Tandai sebagai Duplikat
                  </Button>
                </li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="qualification" class="space-y-4">
            <div v-if="isLeadConverted" class="rounded-lg border border-success/30 bg-success/5 p-3">
              <p class="text-sm text-success">
                Lead ini sudah di-qualify — data qualification di bawah bersifat riwayat (read-only).
              </p>
            </div>
            <fieldset :disabled="!canManageLead || selectedLead.archived || isLeadConverted" class="space-y-4">
              <div class="space-y-1.5">
                <Label for="qual-service-category">Jenis Kebutuhan</Label>
                <select id="qual-service-category" v-model="qualServiceCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Pilih jenis kebutuhan
                  </option>
                  <option v-for="opt in LEAD_SERVICE_CATEGORIES" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div v-if="qualServiceCategory === 'individual-travel'" class="space-y-1.5">
                <Label for="qual-group-trip-project">Project B2C (Group Trip)</Label>
                <select id="qual-group-trip-project" v-model="qualGroupTripProjectId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    — Booking standalone (tanpa Group Project) —
                  </option>
                  <option v-for="project in getOpenGroupProjects()" :key="project.id" :value="project.id">
                    {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }} · {{ getProjectSeatsAvailable(project.id) }} seat tersisa
                  </option>
                </select>
              </div>

              <div v-if="qualServiceCategory === 'individual-travel' && qualGroupTripProjectId && qualSelectedGroupTripProject" class="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p class="text-xs font-semibold text-muted-foreground">
                  Data Project (read-only)
                </p>
                <DetailMetadataList
                  :items="[
                    { label: 'Destination', value: qualSelectedGroupTripProject.destination },
                    { label: 'Departure & Return', value: formatDateRange(qualSelectedGroupTripProject.travelStartDate, qualSelectedGroupTripProject.travelEndDate) },
                    { label: 'Duration', value: `${Math.round((new Date(qualSelectedGroupTripProject.travelEndDate).getTime() - new Date(qualSelectedGroupTripProject.travelStartDate).getTime()) / 86400000)} hari` },
                    { label: 'Price / Pax', value: formatCurrencyIdr(qualPricePerPax) },
                    { label: 'Capacity', value: String(qualSelectedGroupTripProject.travelerCount) },
                    { label: 'Booked/Confirmed Pax', value: String(getProjectSeatsFilled(qualSelectedGroupTripProject.id)) },
                    { label: 'Available Seat', value: String(qualSeatsAvailable) },
                    { label: 'Minimal DP', value: `${formatCurrencyIdr(Math.ceil((qualPackagePriceIdr ?? 0) * MINIMUM_DP_PERCENT / 100))} (${MINIMUM_DP_PERCENT}% dari total harga)` },
                    ...(qualSelectedGroupTripProject.meetingPoint ? [{ label: 'Meeting Point', value: qualSelectedGroupTripProject.meetingPoint }] : [])
                  ]"
                />
              </div>

              <template v-if="!(qualServiceCategory === 'individual-travel' && qualGroupTripProjectId)">
                <div class="space-y-1.5">
                  <Label for="qual-destination">Destinasi / Area Tujuan</Label>
                  <Input id="qual-destination" v-model="qualDestination" placeholder="mis. Bali, Indonesia" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="qual-start">Mulai Perjalanan</Label>
                    <Input id="qual-start" v-model="qualTravelStart" type="date" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-end">Selesai Perjalanan</Label>
                    <Input id="qual-end" v-model="qualTravelEnd" type="date" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-traveler">Estimasi Jumlah Traveler</Label>
                  <Input id="qual-traveler" v-model.number="qualTravelerEstimate" type="number" placeholder="mis. 30" />
                </div>
              </template>

              <div v-if="qualServiceCategory === 'individual-travel' && qualGroupTripProjectId" class="space-y-4">
                <div class="grid grid-cols-3 gap-3">
                  <div class="space-y-1.5">
                    <Label for="qual-adult">Adult</Label>
                    <Input id="qual-adult" v-model.number="qualAdultCount" type="number" min="0" placeholder="0" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-child">Child</Label>
                    <Input id="qual-child" v-model.number="qualChildCount" type="number" min="0" placeholder="0" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-infant">Infant</Label>
                    <Input id="qual-infant" v-model.number="qualInfantCount" type="number" min="0" placeholder="0" />
                  </div>
                </div>
                <p class="text-xs" :class="qualRequestedPax > qualSeatsAvailable ? 'text-destructive' : 'text-muted-foreground'">
                  Total Requested Pax: {{ qualRequestedPax }} · Seat Availability: {{ qualSeatsAvailable }}
                  <span v-if="qualRequestedPax > qualSeatsAvailable"> — melebihi seat tersisa, akan otomatis masuk Waitlist</span>
                </p>
                <div class="space-y-1.5">
                  <Label for="qual-package-price">Total Harga Paket (Rp)</Label>
                  <CurrencyInput id="qual-package-price" v-model="qualPackagePriceIdr" placeholder="mis. 15000000" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <Label for="qual-price-acceptance">Price Acceptance</Label>
                    <select id="qual-price-acceptance" v-model="qualPriceAcceptance" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option value="">
                        Pilih
                      </option>
                      <option v-for="opt in B2C_PRICE_ACCEPTANCE_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-booking-readiness">Booking Readiness</Label>
                    <select id="qual-booking-readiness" v-model="qualBookingReadiness" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option value="">
                        Pilih
                      </option>
                      <option v-for="opt in B2C_BOOKING_READINESS_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-b2c-result">Qualification Result</Label>
                  <select id="qual-b2c-result" v-model="qualB2cResult" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Pilih hasil
                    </option>
                    <option v-for="opt in B2C_QUALIFICATION_RESULT_OPTIONS" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div v-if="qualB2cResult === 'follow-up'" class="space-y-1.5">
                  <Label for="qual-next-follow-up">Next Follow-up Date</Label>
                  <Input id="qual-next-follow-up" v-model="qualNextFollowUpDate" type="date" />
                </div>
              </div>

              <div v-if="!(qualServiceCategory === 'individual-travel' && qualGroupTripProjectId)" class="space-y-1.5">
                <Label>Service Scope</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in SERVICE_TYPES"
                    :key="type.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs transition-colors"
                    :class="qualServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                    @click="toggleQualServiceScope(type.value)"
                  >
                    {{ type.value === 'additional' ? 'Other' : type.label }}
                  </button>
                </div>
              </div>
              <div v-else class="space-y-1.5">
                <Label>Service Scope</Label>
                <p class="text-sm text-muted-foreground">
                  Mengikuti layanan Project B2C: {{ qualServiceScope.map(type => SERVICE_TYPES.find(t => t.value === type)?.label ?? type).join(', ') || '—' }}
                </p>
              </div>
              <div class="space-y-1.5">
                <Label for="qual-summary">Ringkasan Kebutuhan Awal</Label>
                <textarea id="qual-summary" v-model="qualRequirementSummary" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ringkasan singkat kebutuhan perjalanan client" />
              </div>
              <div v-if="qualServiceCategory !== 'individual-travel'" class="space-y-1.5">
                <Label for="qual-ae">Account Executive yang Menerima Lead</Label>
                <select id="qual-ae" v-model="qualHandedOverTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">
                    Pilih Account Executive
                  </option>
                  <option v-for="ae in aeOptions" :key="ae.id" :value="ae.id">
                    {{ ae.name }}
                  </option>
                </select>
              </div>

              <div v-if="qualServiceCategory !== 'individual-travel'" class="pt-2 border-t border-border space-y-4">
                <p class="text-xs font-medium text-muted-foreground">
                  Field Opsional
                </p>
                <div class="space-y-1.5">
                  <Label for="qual-budget">Estimasi Budget / Budget Range</Label>
                  <select id="qual-budget" v-model="qualBudgetRange" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Pilih kategori budget
                    </option>
                    <option v-for="range in budgetRangeOptions" :key="range" :value="range">
                      {{ range }}
                    </option>
                  </select>
                </div>
                <div class="flex items-center gap-2">
                  <input id="qual-flexible" v-model="qualDateFlexible" type="checkbox" class="h-4 w-4 rounded border-input">
                  <Label for="qual-flexible" class="!mb-0">Fleksibilitas Tanggal</Label>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-decision-maker">PIC</Label>
                  <Input id="qual-decision-maker" v-model="qualDecisionMaker" placeholder="mis. Direktur Operasional" />
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-urgency">Tingkat Urgensi</Label>
                  <select id="qual-urgency" v-model="qualUrgency" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">
                      Belum ditentukan
                    </option>
                    <option v-for="opt in LEAD_URGENCY_LEVELS" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-expected-close">Do Date</Label>
                  <Input id="qual-expected-close" v-model="qualExpectedCloseDate" type="date" />
                  <p class="text-xs text-muted-foreground">
                    Ekspektasi tanggal Lead ini perlu di-follow-up berikutnya.
                  </p>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-special-request">Special Request Awal</Label>
                  <textarea id="qual-special-request" v-model="qualSpecialRequestNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-communication-notes">Catatan Hasil Komunikasi</Label>
                  <textarea id="qual-communication-notes" v-model="qualCommunicationNotes" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </fieldset>

            <div v-if="qualificationMissing.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p class="text-sm font-medium text-warning">
                Belum bisa di-Qualify — field berikut belum lengkap:
              </p>
              <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
                <li v-for="item in qualificationMissing" :key="item">
                  {{ item }}
                </li>
              </ul>
            </div>

            <div v-if="canManageLead && !selectedLead.archived && !isLeadConverted" class="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" @click="saveQualificationDraft">
                Simpan Draft
              </Button>

              <Button
                v-if="qualServiceCategory === 'individual-travel' && qualGroupTripProjectId"
                size="sm"
                :disabled="qualificationMissing.length > 0 || !qualB2cResult"
                @click="doQualifyGroupTrip"
              >
                Submit Qualification
              </Button>

              <Dialog v-else v-model:open="isQualifyDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" :disabled="qualificationMissing.length > 0" @click="openQualifyDialog">
                    {{ isIndividualTravel ? 'Qualify & Create Sales Order' : 'Qualify' }}
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{{ isIndividualTravel ? 'Qualify & Create Sales Order' : 'Qualify Lead' }}</DialogTitle>
                    <DialogDescription v-if="isIndividualTravel">
                      Lead akan ditandai Qualified dan sebuah Sales Order langsung dibuat (Customer individual baru dibuat
                      bila belum ada yang cocok dengan nama "{{ selectedLead.name }}"). Masukkan harga paket untuk customer ini.
                    </DialogDescription>
                    <DialogDescription v-else>
                      Lead akan ditandai Qualified (Company baru dibuat bila belum ada yang cocok dengan nama
                      "{{ selectedLead.companyName || selectedLead.name }}"). Quotation dibuat sebagai langkah berikutnya
                      di halaman detail Lead.
                    </DialogDescription>
                  </DialogHeader>

                  <div v-if="isIndividualTravel" class="space-y-1.5 py-2">
                    <Label for="qualify-so-price">Harga Paket (Rp)</Label>
                    <CurrencyInput id="qualify-so-price" v-model="qualifySalesOrderPriceIdr" placeholder="mis. 15000000" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isQualifyDialogOpen = false">
                      Batal
                    </Button>
                    <Button
                      :disabled="isIndividualTravel && (!qualifySalesOrderPriceIdr || qualifySalesOrderPriceIdr <= 0)"
                      @click="doQualify"
                    >
                      {{ isIndividualTravel ? 'Qualify & Create Sales Order' : 'Qualify' }}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog v-model:open="isUnqualifyDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="destructive">
                    Mark as Unqualified
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tandai Lead sebagai Unqualified</DialogTitle>
                    <DialogDescription>Aksi ini bersifat final (terminal) untuk mockup ini.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="unqualify-note">Catatan (opsional)</Label>
                    <Input id="unqualify-note" v-model="unqualifyNote" placeholder="mis. Tidak ada budget/timeline konkret" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isUnqualifyDialogOpen = false">
                      Batal
                    </Button>
                    <Button variant="destructive" @click="doMarkUnqualified">
                      Mark as Unqualified
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          <TabsContent v-if="!isIndividualTravel" value="quotation" class="space-y-4">
            <div>
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Product Planning &amp; Costing
                </p>
                <NuxtLink :to="`/product-planning?leadId=${selectedLead.id}&create=1#cost-sheets`">
                  <Button size="sm" variant="outline">
                    <Plus class="h-3.5 w-3.5 mr-1" />Cost Sheet
                  </Button>
                </NuxtLink>
              </div>
              <ul v-if="costSheets.length > 0" class="divide-y divide-border rounded-lg border border-border px-3">
                <li v-for="sheet in costSheets" :key="sheet.id" class="py-2.5 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <NuxtLink :to="`/product-planning/cost-sheets/${sheet.id}`" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {{ sheet.name }}
                    </NuxtLink>
                    <p class="text-xs text-muted-foreground">
                      v{{ sheet.version }} · {{ sheet.travelerCount }} pax
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-xs text-foreground">{{ formatCurrencyIdr(getCostSheetBreakdown(sheet).totalSellIdr) }}</span>
                    <StatusBadge :label="sheet.status === 'final' ? 'Final' : 'Draft'" :tone="sheet.status === 'final' ? 'success' : 'neutral'" />
                  </div>
                </li>
              </ul>
              <p v-else class="text-xs text-muted-foreground">
                Belum ada Cost Sheet untuk Lead ini.
              </p>
            </div>

            <div class="pt-4 border-t border-border">
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quotation
                </p>
                <div v-if="quotation" class="flex flex-wrap gap-1.5">
                  <NuxtLink :to="`/crm/leads/${selectedLead.id}/quotation-preview`" target="_blank">
                    <Button size="sm" variant="outline">
                      PDF / Print
                    </Button>
                  </NuxtLink>
                  <template v-if="canManageLeadPipeline && !selectedLead.projectId">
                    <Button
                      v-if="(quotation.approvalStatus ?? 'draft') === 'draft'"
                      size="sm"
                      variant="outline"
                      @click="openEditQuotationDialog"
                    >
                      Edit
                    </Button>
                    <Button
                      v-if="(quotation.approvalStatus ?? 'draft') === 'draft'"
                      size="sm"
                      variant="outline"
                      @click="submitDuplicateQuotation"
                    >
                      Duplicate
                    </Button>
                    <Dialog v-model:open="isReviseDialogOpen">
                      <DialogTrigger as-child>
                        <Button size="sm" variant="outline" @click="openReviseDialog">
                          Versi Baru
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
              </div>

              <div v-if="quotation" class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
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
                      Hanya nilai total yang disimpan per versi sebelumnya (bukan histori breakdown penuh).
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
                <div v-if="quotation.inclusions" class="mt-2 pt-2 border-t border-border">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Inclusions
                  </p>
                  <p class="text-xs text-foreground whitespace-pre-line">
                    {{ quotation.inclusions }}
                  </p>
                </div>
                <div v-if="quotation.exclusions" class="mt-2">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Exclusions
                  </p>
                  <p class="text-xs text-foreground whitespace-pre-line">
                    {{ quotation.exclusions }}
                  </p>
                </div>
                <div v-if="quotation.termsAndConditions" class="mt-2">
                  <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Terms &amp; Conditions
                  </p>
                  <p class="text-xs text-foreground whitespace-pre-line">
                    {{ quotation.termsAndConditions }}
                  </p>
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
                      <Input
                        id="edit-quo-discount"
                        v-model.number="editQuotationDiscountPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                      />
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
                      <div v-for="(item, index) in editServiceBreakdown" :key="index" class="flex flex-wrap items-center gap-2">
                        <select v-model="item.service" class="appearance-none px-2 py-2 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                          <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                            {{ type.label }}
                          </option>
                        </select>
                        <Input v-model="item.description" placeholder="Deskripsi" class="flex-1" />
                        <CurrencyInput v-model="item.amountIdr" placeholder="Rp" class="w-28" />
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
            </div>

            <!-- Commercial Approval & Mark as Won -->
            <div v-if="quotation" class="pt-4 border-t border-border">
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Commercial Approval
              </p>
              <p class="mb-3 text-xs text-muted-foreground">
                Workflow: Draft → Submitted for Approval → Approved by Management → Mark as Won.
              </p>

              <div v-if="selectedLead.projectId" class="rounded-lg border border-success/30 bg-success/5 p-3">
                <p class="text-sm font-medium text-success">
                  Won
                </p>
                <NuxtLink :to="`/project-orders/${selectedLead.projectId}`" class="text-sm text-primary hover:underline">
                  Lihat Project hasil konversi ({{ selectedLead.projectId }}) →
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
                            Project baru akan otomatis dibuat dari Lead ini (destinasi {{ selectedLead.destination }},
                            {{ selectedLead.travelerEstimate }} pax). Aksi ini tidak dapat dibatalkan pada mockup ini.
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
            </div>
          </TabsContent>

          <TabsContent value="activities">
            <ul v-if="selectedActivities.length" class="divide-y divide-border">
              <li v-for="activity in selectedActivities" :key="activity.id" class="py-3">
                <p class="text-sm text-foreground">
                  {{ activity.message }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ ownerName(activity.ownerId) }} · {{ formatDate(activity.createdAt) }}
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada activity" />
          </TabsContent>

          <TabsContent value="followups">
            <ul v-if="selectedFollowUps.length" class="divide-y divide-border">
              <li v-for="activity in selectedFollowUps" :key="activity.id" class="py-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm text-foreground truncate">
                    {{ activity.message }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ ownerName(activity.ownerId) }}
                  </p>
                </div>
                <StatusBadge :label="`Jadwal ${formatDate(activity.dueAt ?? '')}`" :tone="isFollowUpUpcoming(activity) ? 'warning' : 'neutral'" />
              </li>
            </ul>
            <EmptyState v-else title="Tidak ada follow-up terjadwal" />
          </TabsContent>
        </Tabs>

        <div v-if="canManageLead" class="mt-4">
          <Dialog v-model:open="isActivityDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Catat Activity / Follow-up
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Activity Baru</DialogTitle>
                <DialogDescription>Isi jadwal follow-up bila activity ini perlu ditindaklanjuti.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="lead-activity-type">Jenis</Label>
                  <select id="lead-activity-type" v-model="activityType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="lead-activity-message">Catatan</Label>
                  <Input id="lead-activity-message" v-model="activityMessage" placeholder="mis. Follow-up kebutuhan traveler" />
                </div>
                <div class="space-y-1.5">
                  <Label for="lead-activity-due">Jadwal Follow-up (opsional)</Label>
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
        </div>

        <!-- Edit Lead (Section 04) -->
        <Dialog v-model:open="isEditLeadOpen">
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>Perbarui data kontak dasar. Data qualification tidak terpengaruh.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="edit-lead-name">Nama Kontak</Label>
                <Input id="edit-lead-name" v-model="editName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-lead-company">Nama Company (opsional)</Label>
                <Input id="edit-lead-company" v-model="editCompanyName" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-lead-source">Sumber Lead</Label>
                <select id="edit-lead-source" v-model="editSource" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">
                    {{ source.label }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="edit-lead-phone">Telepon (opsional)</Label>
                <Input id="edit-lead-phone" v-model="editPhone" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-lead-email">Email (opsional)</Label>
                <Input id="edit-lead-email" v-model="editEmail" type="email" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isEditLeadOpen = false">
                Batal
              </Button>
              <Button :disabled="!editName.trim()" @click="submitEditLead">
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- Merge suggestion confirm (Section 04) -->
        <Dialog v-model:open="isMergeDialogOpen">
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tandai sebagai Duplikat</DialogTitle>
              <DialogDescription>
                Lead "{{ selectedLead.name }}" ({{ selectedLead.id }}) akan diarsipkan dengan catatan referensi ke
                "{{ mergeTarget?.name }}" ({{ mergeTarget?.id }}) sebagai lead canonical. Kedua lead tetap tersimpan sebagai histori.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" @click="isMergeDialogOpen = false">
                Batal
              </Button>
              <Button variant="destructive" @click="doMergeDuplicate">
                Tandai sebagai Duplikat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SheetFooter class="mt-6 flex-row justify-end gap-2">
          <Button v-if="canManageLead && selectedLead.archived" variant="outline" @click="doReopen">
            Reopen
          </Button>
          <Button v-if="canManageLead && !selectedLead.archived" variant="outline" @click="doArchive">
            <ArchiveIcon class="h-4 w-4 mr-1.5" />Archive
          </Button>
          <Button v-if="canManageLead && !selectedLead.archived" variant="outline" @click="openEditLeadDialog">
            Edit Lead
          </Button>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
