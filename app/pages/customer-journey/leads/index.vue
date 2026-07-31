<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Plus, List, LayoutGrid, Inbox as InboxIcon, Archive as ArchiveIcon } from 'lucide-vue-next'
import {
  LEADS, getLeadActivities, getLeadFollowUps, createLead, createLeadActivity, archiveLead,
  qualifyLeadAndCreateOpportunity, getUserById,
} from '~/data'
import { LEAD_SOURCES, LEAD_STAGES, PARTY_ACTIVITY_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isFollowUpUpcoming } from '~/utils/attention'
import type { Lead, LeadSource, LeadStage } from '~/types/lead'
import type { PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Leads' })

const { currentUser, currentRole } = useCurrentUser()
const { canView } = usePermissions()

/** Narrow role exception (pola Section 07/08) — Sales mengelola screening/qualification, AE menerima handover, Super Admin oversight. */
const canManageLead = computed(() => ['sales', 'account-executive', 'super-admin'].includes(currentRole.value))

const viewMode = ref<'table' | 'kanban' | 'inbox'>('table')

const searchQuery = ref('')
const stageFilter = ref<'all' | LeadStage>('all')
const ownerFilter = ref<'all' | string>('all')
const sourceFilter = ref<'all' | LeadSource>('all')
const showArchived = ref(false)

const ownerOptions = computed(() => {
  const ids = [...new Set(LEADS.map(lead => lead.ownerId))]
  return ids.map(id => getUserById(id)).filter((user): user is NonNullable<typeof user> => Boolean(user))
})

const filteredLeads = computed(() => {
  let result = LEADS.filter(lead => lead.archived === showArchived.value)
  if (stageFilter.value !== 'all') result = result.filter(lead => lead.stage === stageFilter.value)
  if (ownerFilter.value !== 'all') result = result.filter(lead => lead.ownerId === ownerFilter.value)
  if (sourceFilter.value !== 'all') result = result.filter(lead => lead.source === sourceFilter.value)
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

/* New Lead */
const isCreateOpen = ref(false)
const newName = ref('')
const newCompanyName = ref('')
const newSource = ref<LeadSource>('website')
const newPhone = ref('')
const newEmail = ref('')

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
const drawerTab = ref<'overview' | 'activities' | 'followups'>('overview')

function openDrawer(lead: Lead) {
  selectedLeadId.value = lead.id
  drawerTab.value = 'overview'
  isDrawerOpen.value = true
}

function doArchive() {
  if (!selectedLead.value) return
  archiveLead(selectedLead.value.id)
  isDrawerOpen.value = false
}

const isQualifyDialogOpen = ref(false)
function doQualifyAndCreateOpportunity() {
  if (!selectedLead.value) return
  const accountExecutiveId = currentRole.value === 'account-executive' ? currentUser.value.id : (selectedLead.value.handedOverTo ?? currentUser.value.id)
  const opportunity = qualifyLeadAndCreateOpportunity(selectedLead.value.id, accountExecutiveId)
  isQualifyDialogOpen.value = false
  if (opportunity) navigateTo(`/crm/opportunities/${opportunity.id}`)
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
                {{ lead.name }}
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

          <div class="flex items-center gap-2 mt-4">
            <StatusBadge :label="findStatusOption(LEAD_STAGES, selectedLead.stage).label" :tone="findStatusOption(LEAD_STAGES, selectedLead.stage).tone" />
            <StatusBadge :label="findStatusOption(LEAD_SOURCES, selectedLead.source).label" :tone="findStatusOption(LEAD_SOURCES, selectedLead.source).tone" />
            <StatusBadge v-if="selectedLead.archived" label="Archived" tone="neutral" />
          </div>

          <Tabs v-model="drawerTab" class="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" class="space-y-4">
              <DetailMetadataList :items="[
                { label: 'Owner', value: ownerName(selectedLead.ownerId) },
                { label: 'Diserahkan ke AE', value: selectedLead.handedOverTo ? ownerName(selectedLead.handedOverTo) : '—' },
                { label: 'Telepon', value: selectedLead.phone || '—' },
                { label: 'Email', value: selectedLead.email || '—' },
                { label: 'Expected Close', value: selectedLead.expectedCloseDate ? formatDate(selectedLead.expectedCloseDate) : '—' },
                { label: 'Dibuat', value: formatDate(selectedLead.createdAt) },
              ]" />
              <div>
                <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Qualification Notes</p>
                <p class="text-sm text-foreground">{{ selectedLead.qualificationNotes || 'Belum ada catatan qualifikasi.' }}</p>
              </div>
              <div v-if="selectedLead.opportunityId" class="rounded-lg border border-success/30 bg-success/5 p-3">
                <p class="text-sm text-success">
                  Sudah dikonversi —
                  <NuxtLink :to="`/crm/opportunities/${selectedLead.opportunityId}`" class="underline">lihat Opportunity {{ selectedLead.opportunityId }}</NuxtLink>
                </p>
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

          <SheetFooter class="mt-6 flex-row justify-end gap-2">
            <Button v-if="canManageLead && !selectedLead.archived" variant="outline" @click="doArchive">
              <ArchiveIcon class="h-4 w-4 mr-1.5" />Archive
            </Button>
            <Dialog v-if="canManageLead && !selectedLead.opportunityId && !selectedLead.archived" v-model:open="isQualifyDialogOpen">
              <DialogTrigger as-child>
                <Button>Qualify &amp; Create Opportunity</Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Qualify &amp; Create Opportunity</DialogTitle>
                  <DialogDescription>
                    Lead akan ditandai Qualified dan sebuah Opportunity baru dibuat (Company baru dibuat bila belum ada
                    yang cocok dengan nama "{{ selectedLead.companyName || selectedLead.name }}").
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="isQualifyDialogOpen = false">Batal</Button>
                  <Button @click="doQualifyAndCreateOpportunity">Qualify &amp; Create Opportunity</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SheetFooter>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
