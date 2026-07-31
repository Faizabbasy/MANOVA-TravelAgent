<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, List, LayoutGrid, Inbox as InboxIcon, Archive as ArchiveIcon } from 'lucide-vue-next'
import {
  LEADS, USERS, getLeadActivities, getLeadFollowUps, createLead, createLeadActivity, archiveLead,
  qualifyLeadAndCreateOpportunity, getLeadMissingQualification, updateLeadQualification, markLeadUnqualified,
  reopenLead, updateLeadContact, getLeadDuplicateCandidates, mergeLeadAsDuplicate,
  getUserById,
} from '~/data'
import { LEAD_SOURCES, LEAD_STAGES, LEAD_SERVICE_CATEGORIES, LEAD_URGENCY_LEVELS, SERVICE_TYPES, PARTY_ACTIVITY_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isFollowUpUpcoming } from '~/utils/attention'
import type { Lead, LeadSource, LeadStage, LeadServiceCategory, LeadUrgency } from '~/types/lead'
import type { ServiceTypeKey } from '~/types/project'
import type { PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Leads' })

const { currentUser, currentRole } = useCurrentUser()
const { canView } = usePermissions()

/** Narrow role exception (pola Section 07/08) — Sales mengelola screening/qualification, AE menerima handover, Super Admin oversight. */
const canManageLead = computed(() => ['sales', 'account-executive', 'super-admin'].includes(currentRole.value))

const route = useRoute()

const viewMode = ref<'table' | 'kanban' | 'inbox'>('table')

const searchQuery = ref('')
/** Drill-down (Section 07, Customer Journey Funnel) — `?stage=qualified` dari `/customer-journey` deep-link langsung ke Lead qualified. */
const stageFilter = ref<'all' | LeadStage>((route.query.stage as LeadStage) || 'all')
const ownerFilter = ref<'all' | string>('all')
const sourceFilter = ref<'all' | LeadSource>('all')
const showArchived = ref(false)

/** "Assigned Leads" (Section 05) — AE melihat Lead yang di-handover ke dirinya (`handedOverTo`), terpisah dari `ownerFilter` (Sales owner). */
const assignedToMeOnly = ref(false)

const ownerOptions = computed(() => {
  const ids = [...new Set(LEADS.map(lead => lead.ownerId))]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

const filteredLeads = computed(() => {
  let result = LEADS.filter(lead => lead.archived === showArchived.value)
  if (stageFilter.value !== 'all') result = result.filter(lead => lead.stage === stageFilter.value)
  if (ownerFilter.value !== 'all') result = result.filter(lead => lead.ownerId === ownerFilter.value)
  if (sourceFilter.value !== 'all') result = result.filter(lead => lead.source === sourceFilter.value)
  if (assignedToMeOnly.value) result = result.filter(lead => lead.handedOverTo === currentUser.value.id)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(lead => lead.name.toLowerCase().includes(q) || (lead.companyName ?? '').toLowerCase().includes(q))
  }
  return [...result].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
})

const leadsByStage = computed(() => {
  const map = new Map<LeadStage, Lead[]>()
  for (const stage of LEAD_STAGES) map.set(stage.value, [])
  for (const lead of filteredLeads.value) map.get(lead.stage)?.push(lead)
  return map
})

function ownerName(ownerId: string) {
  return getUserById(ownerId)?.name ?? ownerId
}

function hasUpcomingFollowUp(leadId: string) {
  return getLeadFollowUps(leadId).some(activity => isFollowUpUpcoming(activity))
}

/** Sinyal cepat duplikat di Table view (Section 04) — aksi lengkap "Tandai sebagai Duplikat" ada di drawer Overview. */
function hasDuplicateCandidates(lead: Lead) {
  return getLeadDuplicateCandidates({ phone: lead.phone, email: lead.email, excludeLeadId: lead.id }).length > 0
}

/* New Lead */
const isCreateOpen = ref(false)
const newName = ref('')
const newCompanyName = ref('')
const newSource = ref<LeadSource>('website')
const newPhone = ref('')
const newEmail = ref('')

/** Duplicate suggestion (Section 04) — pola sama dengan `/lead-intake` (Section 03), reuse selector bersama. */
const newLeadDuplicates = computed(() => getLeadDuplicateCandidates({ phone: newPhone.value, email: newEmail.value }))

function resetCreateForm() {
  newName.value = ''
  newCompanyName.value = ''
  newSource.value = 'website'
  newPhone.value = ''
  newEmail.value = ''
}

function submitCreate() {
  if (!newName.value.trim()) return
  createLead({
    name: newName.value.trim(),
    companyName: newCompanyName.value.trim() || undefined,
    source: newSource.value,
    ownerId: currentUser.value.id,
    phone: newPhone.value.trim() || undefined,
    email: newEmail.value.trim() || undefined,
  })
  resetCreateForm()
  isCreateOpen.value = false
}

/* Detail drawer */
const isDrawerOpen = ref(false)
const selectedLeadId = ref<string | null>(null)
const selectedLead = computed(() => LEADS.find(lead => lead.id === selectedLeadId.value) ?? null)
const selectedActivities = computed(() => (selectedLead.value ? getLeadActivities(selectedLead.value.id) : []))
const selectedFollowUps = computed(() => (selectedLead.value ? getLeadFollowUps(selectedLead.value.id) : []))
const drawerTab = ref<'overview' | 'qualification' | 'activities' | 'followups'>('overview')

const aeOptions = computed(() => USERS.filter(user => user.role === 'account-executive'))

/**
 * Qualification form (Prompt 20 — Change Request) — refs lokal disinkronkan dari `selectedLead` saat
 * drawer dibuka, ditulis balik lewat `updateLeadQualification` ("Simpan Draft") atau sebagai bagian dari
 * "Qualify & Create Opportunity" (draft disimpan dulu, baru gate dicek).
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

function syncQualificationForm(lead: Lead) {
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
}

function toggleQualServiceScope(type: ServiceTypeKey) {
  const index = qualServiceScope.value.indexOf(type)
  if (index === -1) qualServiceScope.value.push(type)
  else qualServiceScope.value.splice(index, 1)
}

/** Mirror `getLeadMissingQualification` (app/data/index.ts) terhadap state form LIVE (belum tersimpan), agar gate terlihat real-time saat mengisi form. */
const qualificationMissing = computed(() => {
  const missing: string[] = []
  if (!qualServiceCategory.value) missing.push('Jenis kebutuhan')
  if (!qualDestination.value.trim()) missing.push('Destinasi belum diisi')
  if (!qualTravelStart.value || !qualTravelEnd.value) missing.push('Periode perjalanan belum diisi')
  if (!qualTravelerEstimate.value) missing.push('Estimasi traveler belum diisi')
  if (qualServiceScope.value.length === 0) missing.push('Service scope belum dipilih')
  if (!qualHandedOverTo.value) missing.push('Account Executive belum dipilih')
  if (!qualRequirementSummary.value.trim()) missing.push('Ringkasan kebutuhan belum diisi')
  return missing
})
const qualificationCompletedCount = computed(() => 7 - qualificationMissing.value.length)

function openDrawer(lead: Lead) {
  selectedLeadId.value = lead.id
  drawerTab.value = 'overview'
  syncQualificationForm(lead)
  isDrawerOpen.value = true
}

function doArchive() {
  if (!selectedLead.value) return
  archiveLead(selectedLead.value.id)
  isDrawerOpen.value = false
}

/** "Reopen" (Section 04) — kebalikan Archive, drawer tetap terbuka agar Sales bisa lanjut mengerjakan. */
function doReopen() {
  if (!selectedLead.value) return
  reopenLead(selectedLead.value.id)
}

/** "Edit Lead" (Section 04) — field kontak dasar, terpisah dari form Qualification. */
const isEditLeadOpen = ref(false)
const editName = ref('')
const editCompanyName = ref('')
const editSource = ref<LeadSource>('website')
const editPhone = ref('')
const editEmail = ref('')

function openEditLeadDialog() {
  if (!selectedLead.value) return
  editName.value = selectedLead.value.name
  editCompanyName.value = selectedLead.value.companyName ?? ''
  editSource.value = selectedLead.value.source
  editPhone.value = selectedLead.value.phone ?? ''
  editEmail.value = selectedLead.value.email ?? ''
  isEditLeadOpen.value = true
}

function submitEditLead() {
  if (!selectedLead.value || !editName.value.trim()) return
  updateLeadContact(selectedLead.value.id, {
    name: editName.value.trim(),
    companyName: editCompanyName.value.trim() || undefined,
    source: editSource.value,
    phone: editPhone.value.trim() || undefined,
    email: editEmail.value.trim() || undefined,
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

function openMergeDialog(candidate: Lead) {
  mergeTarget.value = candidate
  isMergeDialogOpen.value = true
}

function doMergeDuplicate() {
  if (!selectedLead.value || !mergeTarget.value) return
  mergeLeadAsDuplicate(selectedLead.value.id, mergeTarget.value.id, currentUser.value.id)
  isMergeDialogOpen.value = false
  mergeTarget.value = null
  isDrawerOpen.value = false
}

function saveQualificationDraft() {
  if (!selectedLead.value) return
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
  })
}

const isQualifyDialogOpen = ref(false)
function doQualifyAndCreateOpportunity() {
  if (!selectedLead.value || qualificationMissing.value.length > 0) return
  saveQualificationDraft()
  const opportunity = qualifyLeadAndCreateOpportunity(selectedLead.value.id)
  isQualifyDialogOpen.value = false
  if (opportunity) navigateTo(`/crm/opportunities/${opportunity.id}`)
}

const isUnqualifyDialogOpen = ref(false)
const unqualifyNote = ref('')
function doMarkUnqualified() {
  if (!selectedLead.value) return
  saveQualificationDraft()
  markLeadUnqualified(selectedLead.value.id, unqualifyNote.value.trim() || undefined)
  unqualifyNote.value = ''
  isUnqualifyDialogOpen.value = false
  isDrawerOpen.value = false
}

/* Catat Activity/Follow-up dari drawer */
const isActivityDialogOpen = ref(false)
const activityType = ref<PartyActivityType>('call')
const activityMessage = ref('')
const activityDueAt = ref('')

function submitActivity() {
  if (!selectedLead.value || !activityMessage.value.trim()) return
  createLeadActivity({
    leadId: selectedLead.value.id,
    type: activityType.value,
    message: activityMessage.value.trim(),
    ownerId: currentUser.value.id,
    dueAt: activityDueAt.value || undefined,
  })
  activityMessage.value = ''
  activityDueAt.value = ''
  activityType.value = 'call'
  isActivityDialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Leads"
      description="Screening dan qualification lead sebelum diserahkan ke Account Executive."
      :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Leads' }]"
    >
      <template v-if="canManageLead" #actions>
        <Dialog v-model:open="isCreateOpen">
          <DialogTrigger as-child>
            <Button><Plus class="h-4 w-4 mr-1.5" />New Lead</Button>
          </DialogTrigger>
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Lead Baru</DialogTitle>
              <DialogDescription>Lead baru masuk dengan stage "New", ditugaskan ke Anda.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="lead-name">Nama Kontak</Label>
                <Input id="lead-name" v-model="newName" placeholder="Nama pemilik/kontak lead" />
              </div>
              <div class="space-y-1.5">
                <Label for="lead-company">Nama Company (opsional)</Label>
                <Input id="lead-company" v-model="newCompanyName" placeholder="mis. PT Nama Perusahaan" />
              </div>
              <div class="space-y-1.5">
                <Label for="lead-source">Sumber Lead</Label>
                <select id="lead-source" v-model="newSource" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">{{ source.label }}</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="lead-phone">Telepon (opsional)</Label>
                <Input id="lead-phone" v-model="newPhone" placeholder="08xx-xxxx-xxxx" />
              </div>
              <div class="space-y-1.5">
                <Label for="lead-email">Email (opsional)</Label>
                <Input id="lead-email" v-model="newEmail" type="email" placeholder="nama@example.com" />
              </div>
              <div v-if="newLeadDuplicates.length > 0" class="rounded-lg border border-info/30 bg-info/5 p-3">
                <p class="text-sm text-info">
                  Sepertinya sudah ada lead dengan kontak ini:
                  {{ newLeadDuplicates.map(d => `${d.name} (${d.id})`).join(', ') }}. Tetap bisa disimpan sebagai lead baru bila memang berbeda.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isCreateOpen = false">Batal</Button>
              <Button :disabled="!newName.trim()" @click="submitCreate">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('crm')" module-label="modul Customer Journey" />

    <template v-else>
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama atau company..." class="pl-9" />
        </div>
        <select v-model="stageFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Stage</option>
          <option v-for="stage in LEAD_STAGES" :key="stage.value" :value="stage.value">{{ stage.label }}</option>
        </select>
        <select v-model="ownerFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Owner</option>
          <option v-for="user in ownerOptions" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
        <select v-model="sourceFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">Semua Sumber</option>
          <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">{{ source.label }}</option>
        </select>

        <Button
          v-if="currentRole === 'account-executive'"
          :variant="assignedToMeOnly ? 'default' : 'outline'"
          size="sm"
          @click="assignedToMeOnly = !assignedToMeOnly"
        >Assigned to Me</Button>

        <div class="flex items-center gap-1 ml-auto">
          <Button :variant="!showArchived ? 'default' : 'outline'" size="sm" @click="showArchived = false">Aktif</Button>
          <Button :variant="showArchived ? 'default' : 'outline'" size="sm" @click="showArchived = true"><ArchiveIcon class="h-3.5 w-3.5 mr-1" />Archived</Button>
        </div>
        <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Button :variant="viewMode === 'table' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'table'"><List class="h-4 w-4" /></Button>
          <Button :variant="viewMode === 'kanban' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'kanban'"><LayoutGrid class="h-4 w-4" /></Button>
          <Button :variant="viewMode === 'inbox' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'inbox'"><InboxIcon class="h-4 w-4" /></Button>
        </div>
      </div>

      <!-- Table view -->
      <SectionCard v-if="viewMode === 'table'">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Update Terakhir</TableHead>
              <TableHead>Follow-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="lead in filteredLeads" :key="lead.id" class="cursor-pointer hover:bg-muted/50" @click="openDrawer(lead)">
              <TableCell class="font-medium text-foreground">
                <span class="inline-flex items-center gap-1.5">
                  {{ lead.name }}
                  <StatusBadge v-if="hasDuplicateCandidates(lead)" label="Possible Duplicate" tone="warning" />
                </span>
                <span v-if="lead.companyName" class="block text-xs text-muted-foreground font-normal">{{ lead.companyName }}</span>
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(LEAD_SOURCES, lead.source).label" :tone="findStatusOption(LEAD_SOURCES, lead.source).tone" />
              </TableCell>
              <TableCell>
                <StatusBadge :label="findStatusOption(LEAD_STAGES, lead.stage).label" :tone="findStatusOption(LEAD_STAGES, lead.stage).tone" />
              </TableCell>
              <TableCell class="text-muted-foreground">{{ ownerName(lead.ownerId) }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatDate(lead.lastUpdatedAt) }}</TableCell>
              <TableCell>
                <StatusBadge v-if="hasUpcomingFollowUp(lead.id)" label="Follow-up Mendatang" tone="warning" />
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="filteredLeads.length === 0" :colspan="6">
              {{ searchQuery || stageFilter !== 'all' || ownerFilter !== 'all' || sourceFilter !== 'all' ? 'Tidak ada lead yang cocok dengan filter.' : (showArchived ? 'Belum ada lead diarsipkan.' : 'Belum ada lead.') }}
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <!-- Kanban view -->
      <div v-else-if="viewMode === 'kanban'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="stage in LEAD_STAGES" :key="stage.value" class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <StatusBadge :label="stage.label" :tone="stage.tone" />
            <span class="text-xs text-muted-foreground">{{ leadsByStage.get(stage.value)?.length ?? 0 }}</span>
          </div>
          <div class="space-y-2 min-h-[80px]">
            <button
              v-for="lead in leadsByStage.get(stage.value)"
              :key="lead.id"
              class="w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
              @click="openDrawer(lead)"
            >
              <p class="text-sm font-medium text-foreground truncate">{{ lead.name }}</p>
              <p v-if="lead.companyName" class="text-xs text-muted-foreground truncate">{{ lead.companyName }}</p>
              <div class="flex items-center justify-between mt-2">
                <StatusBadge :label="findStatusOption(LEAD_SOURCES, lead.source).label" :tone="findStatusOption(LEAD_SOURCES, lead.source).tone" />
                <StatusBadge v-if="hasUpcomingFollowUp(lead.id)" label="Follow-up" tone="warning" />
              </div>
            </button>
            <EmptyState v-if="(leadsByStage.get(stage.value)?.length ?? 0) === 0" title="Kosong" />
          </div>
        </div>
      </div>

      <!-- Inbox view -->
      <SectionCard v-else-if="viewMode === 'inbox'">
        <ul class="divide-y divide-border">
          <li
            v-for="lead in filteredLeads"
            :key="lead.id"
            class="py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 -mx-6 px-6"
            @click="openDrawer(lead)"
          >
            <Avatar class="h-9 w-9 shrink-0">
              <AvatarFallback>{{ lead.name.slice(0, 2).toUpperCase() }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-foreground truncate">{{ lead.name }}</p>
                <span v-if="lead.companyName" class="text-xs text-muted-foreground truncate">· {{ lead.companyName }}</span>
              </div>
              <p class="text-xs text-muted-foreground truncate">{{ lead.qualificationNotes || `Lead dari ${findStatusOption(LEAD_SOURCES, lead.source).label}` }}</p>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge :label="findStatusOption(LEAD_STAGES, lead.stage).label" :tone="findStatusOption(LEAD_STAGES, lead.stage).tone" />
              <span class="text-xs text-muted-foreground">{{ formatDate(lead.lastUpdatedAt) }}</span>
            </div>
          </li>
        </ul>
        <EmptyState v-if="filteredLeads.length === 0" :icon="InboxIcon" title="Tidak ada lead" />
      </SectionCard>
    </template>

    <!-- Detail Drawer -->
    <Sheet v-model:open="isDrawerOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
        <template v-if="selectedLead">
          <SheetHeader>
            <SheetTitle>{{ selectedLead.name }}</SheetTitle>
            <SheetDescription>{{ selectedLead.companyName || 'Individual lead' }}</SheetDescription>
          </SheetHeader>

          <div class="flex flex-wrap items-center gap-2 mt-4">
            <StatusBadge :label="findStatusOption(LEAD_STAGES, selectedLead.stage).label" :tone="findStatusOption(LEAD_STAGES, selectedLead.stage).tone" />
            <StatusBadge :label="findStatusOption(LEAD_SOURCES, selectedLead.source).label" :tone="findStatusOption(LEAD_SOURCES, selectedLead.source).tone" />
            <StatusBadge v-if="selectedLead.archived" label="Archived" tone="neutral" />
            <!-- Completion indicator + status handover (Prompt 20-14) -->
            <StatusBadge
              v-if="!selectedLead.opportunityId && selectedLead.stage !== 'unqualified'"
              :label="`Qualification ${qualificationCompletedCount}/7`"
              :tone="qualificationMissing.length === 0 ? 'success' : 'warning'"
            />
            <StatusBadge v-if="selectedLead.handedOverTo" label="Sudah diserahkan ke AE" tone="info" />
          </div>

          <Tabs v-model="drawerTab" class="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="qualification">Qualification</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" class="space-y-4">
              <div v-if="canManageLead && !selectedLead.archived" class="flex justify-end">
                <Button size="sm" variant="outline" @click="openEditLeadDialog">Edit Lead</Button>
              </div>
              <DetailMetadataList :items="[
                { label: 'Nama Company', value: selectedLead.companyName || '—' },
                { label: 'Owner (Sales)', value: ownerName(selectedLead.ownerId) },
                { label: 'Account Executive Tujuan', value: selectedLead.handedOverTo ? ownerName(selectedLead.handedOverTo) : 'Belum ditentukan' },
                { label: 'Telepon', value: selectedLead.phone || '—' },
                { label: 'Email', value: selectedLead.email || '—' },
                { label: 'Expected Close', value: selectedLead.expectedCloseDate ? formatDate(selectedLead.expectedCloseDate) : '—' },
                { label: 'Dibuat', value: formatDate(selectedLead.createdAt) },
              ]" />
              <div>
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Qualification Summary</p>
                <p class="text-sm text-foreground">{{ selectedLead.requirementSummary || 'Belum diisi — lihat tab Qualification.' }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Catatan Hasil Komunikasi</p>
                <p class="text-sm text-foreground">{{ selectedLead.qualificationNotes || 'Belum ada catatan.' }}</p>
              </div>
              <div v-if="selectedLead.opportunityId" class="rounded-lg border border-success/30 bg-success/5 p-3">
                <p class="text-sm text-success">
                  Sudah dikonversi —
                  <NuxtLink :to="`/crm/opportunities/${selectedLead.opportunityId}`" class="underline">lihat Opportunity {{ selectedLead.opportunityId }}</NuxtLink>
                </p>
              </div>

              <!-- Merge suggestion (Section 04) -->
              <div v-if="selectedLeadDuplicates.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p class="text-sm font-medium text-warning mb-2">Lead Serupa Terdeteksi</p>
                <ul class="space-y-2">
                  <li v-for="candidate in selectedLeadDuplicates" :key="candidate.id" class="flex items-center justify-between gap-2">
                    <span class="text-xs text-foreground">{{ candidate.name }} ({{ candidate.id }})<span v-if="candidate.companyName"> — {{ candidate.companyName }}</span></span>
                    <Button v-if="canManageLead" size="sm" variant="outline" @click="openMergeDialog(candidate)">Tandai sebagai Duplikat</Button>
                  </li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="qualification" class="space-y-4">
              <div v-if="selectedLead.opportunityId" class="rounded-lg border border-success/30 bg-success/5 p-3">
                <p class="text-sm text-success">Lead ini sudah di-qualify dan dikonversi menjadi Opportunity — data qualification di bawah bersifat riwayat (read-only).</p>
              </div>
              <fieldset :disabled="!canManageLead || selectedLead.archived || Boolean(selectedLead.opportunityId)" class="space-y-4">
                <div class="space-y-1.5">
                  <Label for="qual-service-category">Jenis Kebutuhan</Label>
                  <select id="qual-service-category" v-model="qualServiceCategory" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">Pilih jenis kebutuhan</option>
                    <option v-for="opt in LEAD_SERVICE_CATEGORIES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
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
                <div class="space-y-1.5">
                  <Label>Service Scope</Label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="type in SERVICE_TYPES"
                      :key="type.value"
                      type="button"
                      class="rounded-full border px-3 py-1 text-xs transition-colors"
                      :class="qualServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                      @click="toggleQualServiceScope(type.value)"
                    >{{ type.value === 'additional' ? 'Other' : type.label }}</button>
                  </div>
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-summary">Ringkasan Kebutuhan Awal</Label>
                  <textarea id="qual-summary" v-model="qualRequirementSummary" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ringkasan singkat kebutuhan perjalanan client" />
                </div>
                <div class="space-y-1.5">
                  <Label for="qual-ae">Account Executive yang Menerima Lead</Label>
                  <select id="qual-ae" v-model="qualHandedOverTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option value="">Pilih Account Executive</option>
                    <option v-for="ae in aeOptions" :key="ae.id" :value="ae.id">{{ ae.name }}</option>
                  </select>
                </div>

                <div class="pt-2 border-t border-border space-y-4">
                  <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Field Opsional</p>
                  <div class="space-y-1.5">
                    <Label for="qual-budget">Estimasi Budget / Budget Range</Label>
                    <Input id="qual-budget" v-model="qualBudgetRange" placeholder="mis. Rp 100 juta - Rp 150 juta" />
                  </div>
                  <div class="flex items-center gap-2">
                    <input id="qual-flexible" v-model="qualDateFlexible" type="checkbox" class="h-4 w-4 rounded border-input" />
                    <Label for="qual-flexible" class="!mb-0">Fleksibilitas Tanggal</Label>
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-decision-maker">Decision Maker</Label>
                    <Input id="qual-decision-maker" v-model="qualDecisionMaker" placeholder="mis. Direktur Operasional" />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="qual-urgency">Tingkat Urgensi</Label>
                    <select id="qual-urgency" v-model="qualUrgency" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                      <option value="">Belum ditentukan</option>
                      <option v-for="opt in LEAD_URGENCY_LEVELS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
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
                <p class="text-sm font-medium text-warning">Belum bisa di-Qualify — field berikut belum lengkap:</p>
                <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
                  <li v-for="item in qualificationMissing" :key="item">{{ item }}</li>
                </ul>
              </div>

              <div v-if="canManageLead && !selectedLead.archived && !selectedLead.opportunityId" class="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" @click="saveQualificationDraft">Simpan Draft</Button>
                <Dialog v-model:open="isQualifyDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" :disabled="qualificationMissing.length > 0">Qualify &amp; Create Opportunity</Button>
                  </DialogTrigger>
                  <DialogContent class="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Qualify &amp; Create Opportunity</DialogTitle>
                      <DialogDescription>
                        Lead akan ditandai Qualified dan sebuah Opportunity baru dibuat (Company baru dibuat bila belum ada
                        yang cocok dengan nama "{{ selectedLead.companyName || selectedLead.name }}"), lengkap dengan seluruh data qualification di atas.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" @click="isQualifyDialogOpen = false">Batal</Button>
                      <Button @click="doQualifyAndCreateOpportunity">Qualify &amp; Create Opportunity</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog v-model:open="isUnqualifyDialogOpen">
                  <DialogTrigger as-child>
                    <Button size="sm" variant="destructive">Mark as Unqualified</Button>
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
                      <Button variant="outline" @click="isUnqualifyDialogOpen = false">Batal</Button>
                      <Button variant="destructive" @click="doMarkUnqualified">Mark as Unqualified</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="activities">
              <ul v-if="selectedActivities.length" class="divide-y divide-border">
                <li v-for="activity in selectedActivities" :key="activity.id" class="py-3">
                  <p class="text-sm text-foreground">{{ activity.message }}</p>
                  <p class="text-xs text-muted-foreground">{{ ownerName(activity.ownerId) }} · {{ formatDate(activity.createdAt) }}</p>
                </li>
              </ul>
              <EmptyState v-else title="Belum ada activity" />
            </TabsContent>

            <TabsContent value="followups">
              <ul v-if="selectedFollowUps.length" class="divide-y divide-border">
                <li v-for="activity in selectedFollowUps" :key="activity.id" class="py-3 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm text-foreground truncate">{{ activity.message }}</p>
                    <p class="text-xs text-muted-foreground">{{ ownerName(activity.ownerId) }}</p>
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
                <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Catat Activity / Follow-up</Button>
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
                      <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
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
                  <Button variant="outline" @click="isActivityDialogOpen = false">Batal</Button>
                  <Button :disabled="!activityMessage.trim()" @click="submitActivity">Simpan</Button>
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
                    <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">{{ source.label }}</option>
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
                <Button variant="outline" @click="isEditLeadOpen = false">Batal</Button>
                <Button :disabled="!editName.trim()" @click="submitEditLead">Simpan</Button>
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
                <Button variant="outline" @click="isMergeDialogOpen = false">Batal</Button>
                <Button variant="destructive" @click="doMergeDuplicate">Tandai sebagai Duplikat</Button>
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
          </SheetFooter>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
