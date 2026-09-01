<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, Plus, List, LayoutGrid, Inbox as InboxIcon } from 'lucide-vue-next'
import {
  LEADS, createLead, getLeadWorkflowStatus, getUserById, getLeadFollowUps, getLeadDuplicateCandidates
} from '~/data'
import {
  LEAD_SOURCES, LEAD_STAGES, LEAD_WORKFLOW_STATUSES, findStatusOption
} from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isFollowUpUpcoming } from '~/utils/attention'
import type { Lead, LeadSource, LeadStage } from '~/types/lead'

/** Tab "Leads" — Menu Sales > Pipeline. Dulu `/customer-journey/leads`, kini tab dalam satu menu Pipeline
 * bersama Funnel/Quotation. Sekaligus satu-satunya entry point untuk Qualify (B2B → halaman detail Lead
 * untuk Quotation, B2C → langsung Sales Order) sejak Opportunity dihapus. */

const { currentUser } = useCurrentUser()
const { canView, can, isRole } = usePermissions()

/** Toggle "Assigned to Me" — dulu khusus Account Executive, kini milik Sales yang menyerapnya. */
const showAssignedToMeToggle = computed(() => isRole('sales'))

/** Narrow role exception (pola Section 07/08) — Sales mengelola screening/qualification, AE menerima handover, Super Admin oversight. */
const canManageLead = computed(() => can('sales.manage-lead'))

const route = useRoute()

const viewMode = ref<'table' | 'kanban' | 'inbox'>('table')

const searchQuery = ref('')
/** Drill-down (Customer Journey Funnel) — `?stage=qualified` deep-link langsung ke Lead qualified. */
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

/** Lead yang sudah Won (B2B: `projectId` terisi lewat `markLeadWon`, B2C: `salesOrderId` terisi lewat
 * `qualifyLeadAndCreateSalesOrder`) sudah jadi Customer (`Party.lifecycleStatus` ikut berubah ke 'client'
 * di `markLeadWon`) — tidak lagi relevan di list Leads, dilihat lewat Customers. */
function isLeadWon (lead: Lead) {
  return Boolean(lead.projectId) || Boolean(lead.salesOrderId)
}

const filteredLeads = computed(() => {
  let result = LEADS.filter(lead => lead.archived === showArchived.value && !isLeadWon(lead))
  if (stageFilter.value !== 'all') { result = result.filter(lead => lead.stage === stageFilter.value) }
  if (ownerFilter.value !== 'all') { result = result.filter(lead => lead.ownerId === ownerFilter.value) }
  if (sourceFilter.value !== 'all') { result = result.filter(lead => lead.source === sourceFilter.value) }
  if (assignedToMeOnly.value) { result = result.filter(lead => lead.handedOverTo === currentUser.value.id) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(lead => lead.name.toLowerCase().includes(q) || (lead.companyName ?? '').toLowerCase().includes(q))
  }
  return [...result].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))
})

const leadsByStage = computed(() => {
  const map = new Map<LeadStage, Lead[]>()
  for (const stage of LEAD_STAGES) { map.set(stage.value, []) }
  for (const lead of filteredLeads.value) { map.get(lead.stage)?.push(lead) }
  return map
})

function ownerName (ownerId: string) {
  return getUserById(ownerId)?.name ?? ownerId
}

function hasUpcomingFollowUp (leadId: string) {
  return getLeadFollowUps(leadId).some(activity => isFollowUpUpcoming(activity))
}

/** Status deal (Quotation/Sales Order) — kolom pengganti visibilitas panel "Opportunities" lama yang sudah dihapus. */
function dealStatus (leadId: string) {
  const status = getLeadWorkflowStatus(leadId)
  return status ? findStatusOption(LEAD_WORKFLOW_STATUSES, status) : undefined
}

/** Sinyal cepat duplikat di Table view (Section 04) — aksi lengkap "Tandai sebagai Duplikat" ada di drawer Overview. */
function hasDuplicateCandidates (lead: Lead) {
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

function resetCreateForm () {
  newName.value = ''
  newCompanyName.value = ''
  newSource.value = 'website'
  newPhone.value = ''
  newEmail.value = ''
}

function submitCreate () {
  if (!newName.value.trim()) { return }
  createLead({
    name: newName.value.trim(),
    companyName: newCompanyName.value.trim() || undefined,
    source: newSource.value,
    ownerId: currentUser.value.id,
    phone: newPhone.value.trim() || undefined,
    email: newEmail.value.trim() || undefined
  })
  resetCreateForm()
  isCreateOpen.value = false
}

/* Detail drawer */
const isDrawerOpen = ref(false)
const selectedLeadId = ref<string | null>(null)

function openDrawer (lead: Lead) {
  selectedLeadId.value = lead.id
  isDrawerOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('sales')" module-label="modul Sales" />

    <template v-else>
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="relative flex-1 w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari nama atau company..." class="pl-9" />
        </div>
        <select v-model="stageFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Stage
          </option>
          <option v-for="stage in LEAD_STAGES" :key="stage.value" :value="stage.value">
            {{ stage.label }}
          </option>
        </select>
        <select v-model="ownerFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Owner
          </option>
          <option v-for="user in ownerOptions" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
        <select v-model="sourceFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Sumber
          </option>
          <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">
            {{ source.label }}
          </option>
        </select>

        <Button
          v-if="showAssignedToMeToggle"
          :variant="assignedToMeOnly ? 'default' : 'outline'"
          size="sm"
          @click="assignedToMeOnly = !assignedToMeOnly"
        >
          Assigned to Me
        </Button>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button :variant="viewMode === 'table' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'table'">
              <List class="h-4 w-4" />
            </Button>
            <Button :variant="viewMode === 'kanban' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'kanban'">
              <LayoutGrid class="h-4 w-4" />
            </Button>
            <Button :variant="viewMode === 'inbox' ? 'secondary' : 'ghost'" size="sm" @click="viewMode = 'inbox'">
              <InboxIcon class="h-4 w-4" />
            </Button>
          </div>

          <Dialog v-if="canManageLead" v-model:open="isCreateOpen">
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
                    <option v-for="source in LEAD_SOURCES" :key="source.value" :value="source.value">
                      {{ source.label }}
                    </option>
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
                <Button variant="outline" @click="isCreateOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newName.trim()" @click="submitCreate">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <TableHead>Status Deal</TableHead>
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
              <TableCell>
                <StatusBadge v-if="dealStatus(lead.id)" :label="dealStatus(lead.id)?.label ?? ''" :tone="dealStatus(lead.id)?.tone ?? 'neutral'" />
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ ownerName(lead.ownerId) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(lead.lastUpdatedAt) }}
              </TableCell>
              <TableCell>
                <StatusBadge v-if="hasUpcomingFollowUp(lead.id)" label="Follow-up Mendatang" tone="warning" />
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="filteredLeads.length === 0" :colspan="7">
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
              <p class="text-sm font-medium text-foreground truncate">
                {{ lead.name }}
              </p>
              <p v-if="lead.companyName" class="text-xs text-muted-foreground truncate">
                {{ lead.companyName }}
              </p>
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
                <p class="text-sm font-medium text-foreground truncate">
                  {{ lead.name }}
                </p>
                <span v-if="lead.companyName" class="text-xs text-muted-foreground truncate">· {{ lead.companyName }}</span>
              </div>
              <p class="text-xs text-muted-foreground truncate">
                {{ lead.qualificationNotes || `Lead dari ${findStatusOption(LEAD_SOURCES, lead.source).label}` }}
              </p>
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
    <LeadDetailSheet v-model:open="isDrawerOpen" :lead-id="selectedLeadId" />
  </div>
</template>
