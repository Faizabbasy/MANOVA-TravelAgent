<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Archive as ArchiveIcon, Building2, User, UserCheck, Phone, Mail, CalendarClock, Calendar } from 'lucide-vue-next'
import { matchesAnyRole } from '~/data/rbac'
import {
  USERS, getLeadById, getLeadActivities, getLeadFollowUps, createLeadActivity, archiveLead,
  qualifyLeadForQuotation, qualifyLeadAndCreateSalesOrder, updateLeadQualification, markLeadUnqualified,
  reopenLead, updateLeadContact, getLeadDuplicateCandidates, mergeLeadAsDuplicate,
  getUserById, getOpenGroupProjects, getProjectById, getProjectSeatsFilled,
  getProjectSeatsAvailable, qualifyGroupTripLead
} from '~/data'
import {
  LEAD_SOURCES, LEAD_STAGES, LEAD_SERVICE_CATEGORIES, LEAD_URGENCY_LEVELS, SERVICE_TYPES,
  PARTY_ACTIVITY_TYPES, B2C_PRICE_ACCEPTANCE_OPTIONS, B2C_BOOKING_READINESS_OPTIONS, B2C_QUALIFICATION_RESULT_OPTIONS,
  findStatusOption
} from '~/constants/status'
import { formatDate, formatDateRange, formatCurrencyIdr } from '~/utils/format'
import { isFollowUpUpcoming, MINIMUM_DP_PERCENT } from '~/utils/attention'
import type { Lead, LeadSource, LeadServiceCategory, LeadUrgency, B2cPriceAcceptance, B2cBookingReadiness, B2cQualificationResult } from '~/types/lead'
import type { ServiceTypeKey } from '~/types/project'
import type { PartyActivityType } from '~/types/party'

const props = defineProps<{
  open: boolean
  leadId: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { currentUser } = useCurrentUser()
const { can } = usePermissions()
const { showToast } = useToast()

/** Narrow role exception (pola Section 07/08) — Sales mengelola screening/qualification, AE menerima handover, Super Admin oversight. */
const canManageLead = computed(() => can('sales.manage-lead'))

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
    { icon: CalendarClock, label: 'Expected Close', value: lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—' },
    { icon: Calendar, label: 'Dibuat', value: formatDate(lead.createdAt) }
  ]
})
const selectedActivities = computed(() => (selectedLead.value ? getLeadActivities(selectedLead.value.id) : []))
const selectedFollowUps = computed(() => (selectedLead.value ? getLeadFollowUps(selectedLead.value.id) : []))
const drawerTab = ref<'overview' | 'qualification' | 'activities' | 'followups'>('overview')

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
    drawerTab.value = 'overview'
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
 * (mengumpulkan harga dulu), kategori lain (B2B) di-qualify saja lalu diarahkan ke halaman detail Lead
 * untuk membuat Quotation di sana. Lihat komentar desain di `app/types/lead.ts`.
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
  if (qualified) { navigateTo(`/crm/leads/${qualified.id}`) }
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
                <NuxtLink :to="`/crm/leads/${selectedLead.id}`" class="underline">
                  lihat Quotation & Commercial Approval
                </NuxtLink>
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
                  <Input id="qual-budget" v-model="qualBudgetRange" placeholder="mis. Rp 100 juta - Rp 150 juta" />
                </div>
                <div class="flex items-center gap-2">
                  <input id="qual-flexible" v-model="qualDateFlexible" type="checkbox" class="h-4 w-4 rounded border-input">
                  <Label for="qual-flexible" class="!mb-0">Fleksibilitas Tanggal</Label>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-decision-maker">Decision Maker</Label>
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
                  <Label for="qual-expected-close">Expected Close</Label>
                  <Input id="qual-expected-close" v-model="qualExpectedCloseDate" type="date" />
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
