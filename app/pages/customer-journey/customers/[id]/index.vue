<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getPartyById, getContactsByParty, getLeadsByParty, getProjectsByParty, getPartyActivities,
  getDocumentsByParty, getUserById, getQuotationByLead, createProject,
  ensureProjectServiceForBudget, updateProjectServiceBudget
} from '~/data'
import { QUOTATION_APPROVAL_STATUSES, PROJECT_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { StatusOption } from '~/types/common'
import type { PartyLifecycleStatus } from '~/types/party'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canManage } = usePermissions()
const { showToast } = useToast()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10) — narrow exception. */
const hasAccess = computed(() => canView('crm'))

/** "Buat Project" langsung di tab Project halaman ini (Database Customer) — sebelumnya user harus loncat
 * dulu ke Party Detail (CRM) cuma untuk tombol ini, padahal entitasnya sama. Mirror persis flow "Buat
 * Project" di `crm/parties/[id]` (`createProject`, sama gate `canManage('operations')`), disatukan di sini
 * supaya tidak ada dua tempat berbeda untuk aksi yang sama pada customer yang sama. */
const canManageProject = computed(() => canManage('operations'))
const isCreateProjectOpen = ref(false)
const newProjectName = ref('')
const newProjectDestination = ref('')
const newProjectStartDate = ref('')
const newProjectEndDate = ref('')
const newProjectTravelerCount = ref<number | null>(null)
const newProjectServiceScope = ref<ServiceTypeKey[]>([])
const newProjectAmountIdr = ref<number | null>(null)
/** Budget per layanan langsung di form "Buat Project" — muncul begitu chip Service Scope dicentang, opsional,
 * memakai mesin yang sama dengan "Edit Budget" tab Finance (`ensureProjectServiceForBudget`/
 * `updateProjectServiceBudget`, `app/data/index.ts`) supaya tidak perlu bolak-balik ke halaman lain. */
const newProjectServiceBudgets = ref<Partial<Record<ServiceTypeKey, number | null>>>({})

function toggleNewProjectServiceScope (type: ServiceTypeKey) {
  const index = newProjectServiceScope.value.indexOf(type)
  if (index === -1) { newProjectServiceScope.value.push(type) } else { newProjectServiceScope.value.splice(index, 1) }
}

function resetCreateProjectForm () {
  newProjectName.value = ''
  newProjectDestination.value = ''
  newProjectStartDate.value = ''
  newProjectEndDate.value = ''
  newProjectTravelerCount.value = null
  newProjectServiceScope.value = []
  newProjectAmountIdr.value = null
  newProjectServiceBudgets.value = {}
}

const isNewProjectFormValid = computed(() => Boolean(
  newProjectName.value.trim() &&
  newProjectDestination.value.trim() &&
  newProjectStartDate.value &&
  newProjectEndDate.value &&
  newProjectTravelerCount.value &&
  newProjectServiceScope.value.length &&
  newProjectAmountIdr.value
))

const newProjectServiceBudgetsTotal = computed(() =>
  newProjectServiceScope.value.reduce((sum, type) => sum + (newProjectServiceBudgets.value[type] ?? 0), 0)
)

function submitCreateProject () {
  if (!party.value || !isNewProjectFormValid.value) { return }
  const project = createProject({
    partyId: party.value.id,
    name: newProjectName.value.trim(),
    destination: newProjectDestination.value.trim(),
    travelStartDate: newProjectStartDate.value,
    travelEndDate: newProjectEndDate.value,
    travelerCount: newProjectTravelerCount.value!,
    serviceScope: newProjectServiceScope.value,
    quotationAmountIdr: newProjectAmountIdr.value!
  })
  if (!project) { showToast('Gagal Membuat Project', 'Periksa kembali tanggal dan data yang diisi.', 'error'); return }
  for (const type of newProjectServiceScope.value) {
    const amount = newProjectServiceBudgets.value[type]
    if (!amount) { continue }
    const label = findStatusOption(SERVICE_TYPES, type).label
    const service = ensureProjectServiceForBudget(project.id, type, label)
    updateProjectServiceBudget(service.id, amount)
  }
  resetCreateProjectForm()
  isCreateProjectOpen.value = false
  showToast('Project Dibuat', `${project.id} tercatat berstatus "Draft".`, 'success')
}

const LIFECYCLE_STATUSES: StatusOption<PartyLifecycleStatus>[] = [
  { value: 'prospect', label: 'Prospect', tone: 'warning', order: 1 },
  { value: 'client', label: 'Active Client', tone: 'success', order: 2 }
]

type CustomerDetailTab = 'overview' | 'contacts' | 'leads' | 'project-orders' | 'activities' | 'documents'

const party = computed(() => getPartyById(String(route.params.id)))
useHead({ title: computed(() => party.value ? party.value.name : 'Company Tidak Ditemukan') })

const contacts = computed(() => (party.value ? getContactsByParty(party.value.id) : []))
const leadDeals = computed(() => (party.value ? getLeadsByParty(party.value.id) : []))
const leadDealRows = computed(() => leadDeals.value.map(lead => ({ lead, quotation: getQuotationByLead(lead.id) })))
const projectOrders = computed(() => (party.value ? getProjectsByParty(party.value.id) : []))
const activities = computed(() => (party.value ? getPartyActivities(party.value.id) : []))
const documents = computed(() => (party.value ? getDocumentsByParty(party.value.id) : []))

const summaryMetadata = computed(() => {
  if (!party.value) { return [] }
  return [
    { label: 'Status', value: findStatusOption(LIFECYCLE_STATUSES, party.value.lifecycleStatus).label },
    { label: 'Account Owner', value: party.value.accountOwnerId ? getUserById(party.value.accountOwnerId)?.name ?? '—' : '—' },
    { label: 'Industri', value: party.value.industry ?? '—' },
    { label: 'Ukuran Perusahaan', value: party.value.size ?? '—' },
    { label: 'Kota', value: party.value.city ?? '—' },
    { label: 'Telepon', value: party.value.phone ?? '—' },
    { label: 'Total Leads', value: String(leadDeals.value.length) },
    { label: 'Total Project Orders', value: String(projectOrders.value.length) }
  ]
})

const activeTab = computed<CustomerDetailTab>({
  get: () => (route.query.tab as CustomerDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

const TABS: { value: CustomerDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'leads', label: 'Leads' },
  { value: 'project-orders', label: 'Project' },
  { value: 'activities', label: 'Activities' },
  { value: 'documents', label: 'Documents' }
]
</script>

<template>
  <div class="space-y-6">
    <template v-if="!party">
      <PageHeader title="Company Tidak Ditemukan" :breadcrumb="[{ label: 'Database Customer', to: '/customer-journey/customers' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Company tidak ditemukan" :description="`Company dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/customer-journey/customers')">
            Kembali ke Daftar Customers
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul CRM" />

    <template v-else>
      <PageHeader
        :title="party.name"
        :breadcrumb="[{ label: 'Database Customer', to: '/customer-journey/customers' }, { label: party.name }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(LIFECYCLE_STATUSES, party.lifecycleStatus).label" :tone="findStatusOption(LIFECYCLE_STATUSES, party.lifecycleStatus).tone" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard title="Ringkasan">
            <p class="text-sm text-muted-foreground">
              Company ini merepresentasikan entitas Party/CRM yang sama dengan `/crm/prospects`/`/crm/clients` —
              lihat juga <NuxtLink :to="`/crm/parties/${party.id}`" class="text-primary hover:underline">
                Party Detail (CRM)
              </NuxtLink> untuk tab Overview/Contacts/Leads/Activities standar.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="contacts">
          <SectionCard title="Contacts">
            <ul v-if="contacts.length" class="divide-y divide-border">
              <li v-for="contact in contacts" :key="contact.id" class="py-3">
                <p class="text-sm font-medium text-foreground">
                  {{ contact.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ contact.title }}<template v-if="contact.email">
                    · {{ contact.email }}
                  </template><template v-if="contact.phone">
                    · {{ contact.phone }}
                  </template>
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada contact person" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="leads">
          <SectionCard title="Leads">
            <Table v-if="leadDealRows.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status Quotation</TableHead>
                  <TableHead>Account Executive</TableHead>
                  <TableHead>Nilai Quotation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in leadDealRows" :key="row.lead.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/crm/leads/${row.lead.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ row.lead.title ?? row.lead.companyName ?? row.lead.name }}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      v-if="row.quotation"
                      :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, row.quotation.approvalStatus ?? 'draft').label"
                      :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, row.quotation.approvalStatus ?? 'draft').tone"
                    />
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ getUserById(row.lead.handedOverTo ?? row.lead.ownerId)?.name ?? '—' }}
                  </TableCell>
                  <TableCell>{{ row.quotation ? formatCurrencyIdr(row.quotation.amountIdr) : '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else title="Belum ada lead" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="project-orders">
          <SectionCard title="Project Orders">
            <template #actions>
              <Sheet v-if="canManageProject" v-model:open="isCreateProjectOpen">
                <SheetTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Buat Project
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Buat Project Baru</SheetTitle>
                    <SheetDescription>Untuk: {{ party?.name }} — tanpa lewat Lead, status awal "Draft".</SheetDescription>
                  </SheetHeader>
                  <div class="space-y-4 py-4">
                    <div class="space-y-1.5">
                      <Label for="cust-prj-name">Nama Project</Label>
                      <Input id="cust-prj-name" v-model="newProjectName" placeholder="mis. Jakarta Business Trip Q1 2027" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="cust-prj-destination">Destinasi</Label>
                      <Input id="cust-prj-destination" v-model="newProjectDestination" placeholder="mis. Bali" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="cust-prj-start">Tanggal Berangkat</Label>
                        <Input id="cust-prj-start" v-model="newProjectStartDate" type="date" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="cust-prj-end">Tanggal Pulang</Label>
                        <Input id="cust-prj-end" v-model="newProjectEndDate" type="date" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="cust-prj-travelers">Jumlah Traveler</Label>
                        <Input id="cust-prj-travelers" v-model.number="newProjectTravelerCount" type="number" min="1" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="cust-prj-amount">Nilai Kontrak (Rp)</Label>
                        <CurrencyInput id="cust-prj-amount" v-model="newProjectAmountIdr" />
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <Label>Service Scope</Label>
                      <div class="flex flex-wrap gap-2">
                        <button
                          v-for="type in SERVICE_TYPES"
                          :key="type.value"
                          type="button"
                          class="rounded-full border px-3 py-1 text-xs transition-colors"
                          :class="newProjectServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                          @click="toggleNewProjectServiceScope(type.value)"
                        >
                          {{ type.value === 'additional' ? 'Other' : type.label }}
                        </button>
                      </div>
                    </div>
                    <div v-if="newProjectServiceScope.length" class="space-y-3">
                      <Label>Budget per Layanan (opsional)</Label>
                      <div v-for="type in SERVICE_TYPES.filter(t => newProjectServiceScope.includes(t.value))" :key="type.value" class="space-y-1.5">
                        <Label :for="`cust-prj-budget-${type.value}`" class="text-xs text-muted-foreground">
                          {{ type.value === 'additional' ? 'Other' : type.label }}
                        </Label>
                        <CurrencyInput :id="`cust-prj-budget-${type.value}`" v-model="newProjectServiceBudgets[type.value]" placeholder="mis. 100000000" />
                      </div>
                      <p v-if="newProjectAmountIdr" class="text-xs text-muted-foreground">
                        Nilai Kontrak: <span class="font-medium text-foreground">{{ formatCurrencyIdr(newProjectAmountIdr) }}</span>
                        · Sudah Dialokasikan: <span class="font-medium text-foreground">{{ formatCurrencyIdr(newProjectServiceBudgetsTotal) }}</span>
                      </p>
                    </div>
                  </div>
                  <SheetFooter class="flex-row justify-end gap-2">
                    <Button variant="outline" @click="resetCreateProjectForm(); isCreateProjectOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!isNewProjectFormValid" @click="submitCreateProject">
                      Simpan
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </template>

            <Table v-if="projectOrders.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Project Order</TableHead>
                  <TableHead>Destinasi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="project in projectOrders" :key="project.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/project-orders/${project.id}`)">
                  <TableCell class="font-medium text-foreground">
                    {{ project.name }}<span class="block text-xs text-muted-foreground font-normal">{{ project.id }}</span>
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ project.destination }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                  </TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else title="Belum ada Project Order" description="Company ini belum memiliki Project Order (belum ada Lead yang Won)." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="activities">
          <SectionCard title="Activities">
            <ul v-if="activities.length" class="divide-y divide-border">
              <li v-for="activity in activities" :key="activity.id" class="py-3">
                <p class="text-sm text-foreground">
                  {{ activity.message }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ formatDate(activity.createdAt) }}<template v-if="activity.dueAt">
                    · Follow-up dijadwalkan {{ formatDate(activity.dueAt) }}
                  </template>
                </p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada activity" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents">
          <SectionCard title="Documents" description="Union dokumen lintas seluruh Project Order milik company ini.">
            <ul v-if="documents.length" class="divide-y divide-border">
              <li v-for="document in documents" :key="document.id" class="py-3 flex items-center justify-between gap-3">
                <span class="text-sm text-foreground truncate">{{ document.name }}</span>
                <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(document.uploadedAt) }}</span>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada dokumen" />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
