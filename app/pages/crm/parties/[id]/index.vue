<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, MessageCircle } from 'lucide-vue-next'
import { buildWhatsAppLink } from '~/data/crm-engagement'
import {
  getPartyById, getContactsByParty, getLeadsByParty, getPartyActivities, getProjectsByParty,
  getQuotationByLead, createContact, createPartyActivity, createProject, getInvoicesByProject, getFeedbackByProject,
  getUserByClientPartyId, isManovaClient, ensureProjectServiceForBudget, updateProjectServiceBudget
} from '~/data'
import { getLoyaltyAccount } from '~/data/crm-engagement'
import { QUOTATION_APPROVAL_STATUSES, PROJECT_STATUSES, SERVICE_TYPES, PARTY_ACTIVITY_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange, formatNumber } from '~/utils/format'
import { daysUntil } from '~/utils/format'
import type { PartyDetailTab, PartyActivityType } from '~/types/party'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentRole, currentUser } = useCurrentUser()
const { canView, can, canManage } = usePermissions()
const { showToast } = useToast()

/** Hyperlink WhatsApp (revisi.md #9) — nomor dinormalkan ke format internasional oleh `buildWhatsAppLink`. */
function whatsAppLink (phone: string | undefined, name: string): string | undefined {
  return buildWhatsAppLink(phone, `Halo ${name}, saya dari MANOVA Travel.`)
}

/** Lihat catatan yang sama di `crm/prospects.vue` — pengecualian sempit, bukan mekanisme role-check baru.
 * `account-executive` ditambahkan Prompt 19 — AE "mengelola relationship dengan prospect/client" (literal
 * responsibility split), Sales tetap dipertahankan (tidak ada larangan eksplisit Party-level di Prompt 19). */
const canManageParty = computed(() => can('crm.manage-party'))

const party = computed(() => getPartyById(String(route.params.id)))
useHead({ title: computed(() => party.value ? party.value.name : 'Party Tidak Ditemukan') })

const contacts = computed(() => (party.value ? getContactsByParty(party.value.id) : []))
const leadDeals = computed(() => (party.value ? getLeadsByParty(party.value.id) : []))
const leadDealRows = computed(() => leadDeals.value.map(lead => ({ lead, quotation: getQuotationByLead(lead.id) })))
const activities = computed(() => (party.value ? getPartyActivities(party.value.id) : []))
const projects = computed(() => (party.value ? getProjectsByParty(party.value.id) : []))
const linkedClientUser = computed(() => (party.value ? getUserByClientPartyId(party.value.id) : undefined))
const isPartyManovaClient = computed(() => (party.value ? isManovaClient(party.value.id) : false))

/** Tab "Projects" kondisional — tampil untuk seluruh Client (dulu mensyaratkan minimal 1 project; kini juga
 * tampil saat kosong supaya tombol "Buat Project" di tab ini terjangkau untuk Client baru/belum punya project). */
const showProjectsTab = computed(() => party.value?.lifecycleStatus === 'client')

/** Buat Project untuk party ini — mirror flow "Buat Project" di `/project-orders`, customer terkunci ke
 * party halaman ini (bukan dropdown). Digerbangi `canManage('operations')` (modul yang sama, bukan
 * `canManageParty`/CRM) karena membuat Project adalah aksi modul Operations. */
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

const activeTab = computed<PartyDetailTab>({
  get: () => (route.query.tab as PartyDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } })
})

const TABS = computed(() => {
  const base: { value: PartyDetailTab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'leads', label: 'Leads' },
    { value: 'activities', label: 'Activities' }
  ]
  if (showProjectsTab.value) { base.push({ value: 'projects', label: 'Projects' }) }
  base.push({ value: 'travel-history', label: 'Riwayat & Preferensi' })
  return base
})

/**
 * Riwayat Perjalanan & Preferensi (`revisi.md` #5). SELURUHNYA diturunkan dari project, invoice, dan
 * feedback yang sudah tercatat — bukan profil terpisah yang harus diisi ulang dan berpotensi basi.
 * Satu-satunya field tersimpan adalah `Party.travelPreferences` (catatan bebas) yang memang sudah ada.
 */
const travelHistory = computed(() => [...projects.value]
  .sort((a, b) => b.travelStartDate.localeCompare(a.travelStartDate))
  .map(project => ({
    project,
    invoicedIdr: getInvoicesByProject(project.id).reduce((sum, invoice) => sum + invoice.amountIdr, 0),
    feedback: getFeedbackByProject(project.id)
  })))

const travelInsight = computed(() => {
  const list = projects.value
  if (!list.length) { return undefined }

  const byDestination = new Map<string, number>()
  const byServiceType = new Map<string, number>()
  for (const project of list) {
    byDestination.set(project.destination, (byDestination.get(project.destination) ?? 0) + 1)
    for (const service of project.serviceScope) { byServiceType.set(service, (byServiceType.get(service) ?? 0) + 1) }
  }

  const sortedDestinations = [...byDestination.entries()].sort((a, b) => b[1] - a[1])
  const sortedServices = [...byServiceType.entries()].sort((a, b) => b[1] - a[1])
  const totalTravelers = list.reduce((sum, project) => sum + project.travelerCount, 0)
  const durations = list.map(project => Math.max(1, daysUntil(project.travelEndDate, project.travelStartDate) + 1))

  return {
    tripCount: list.length,
    favouriteDestination: sortedDestinations[0]?.[0],
    favouriteDestinationCount: sortedDestinations[0]?.[1] ?? 0,
    destinations: sortedDestinations,
    services: sortedServices,
    averagePax: Math.round(totalTravelers / list.length),
    averageDurationDays: Math.round(durations.reduce((sum, days) => sum + days, 0) / durations.length),
    loyalty: getLoyaltyAccount(String(route.params.id))
  }
})

const summaryMetadata = computed(() => {
  if (!party.value) { return [] }
  return [
    { label: 'Lifecycle Status', value: party.value.lifecycleStatus === 'client' ? 'Client' : 'Prospect' },
    { label: 'Industri', value: party.value.industry ?? '—' },
    { label: 'Dibuat', value: formatDate(party.value.createdAt) },
    { label: 'Jumlah Contact', value: String(contacts.value.length) },
    { label: 'Jumlah Lead', value: String(leadDeals.value.length) },
    { label: 'Jumlah Project', value: String(projects.value.length) }
  ]
})

/* Tambah Contact */
const isContactDialogOpen = ref(false)
const contactName = ref('')
const contactTitle = ref('')
const contactEmail = ref('')
const contactPhone = ref('')

function submitContact () {
  if (!party.value || !contactName.value.trim() || !contactTitle.value.trim()) { return }
  createContact({
    partyId: party.value.id,
    name: contactName.value.trim(),
    title: contactTitle.value.trim(),
    email: contactEmail.value.trim() || undefined,
    phone: contactPhone.value.trim() || undefined
  })
  contactName.value = ''
  contactTitle.value = ''
  contactEmail.value = ''
  contactPhone.value = ''
  isContactDialogOpen.value = false
}

/* Tambah Activity */
const isActivityDialogOpen = ref(false)
const activityType = ref<PartyActivityType>('call')
const activityMessage = ref('')
const activityDueAt = ref('')

function submitActivity () {
  if (!party.value || !activityMessage.value.trim()) { return }
  createPartyActivity({
    partyId: party.value.id,
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
    <template v-if="!party">
      <PageHeader title="Party Tidak Ditemukan" :breadcrumb="[{ label: 'Database Customer', to: '/customer-journey/customers' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Party tidak ditemukan"
          :description="`Party dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/customer-journey/customers')">
            Kembali ke Database Customer
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <PageHeader
        :title="party.name"
        :breadcrumb="[{ label: 'Database Customer', to: '/customer-journey/customers' }, { label: party.lifecycleStatus === 'client' ? 'Clients' : 'Prospects', to: party.lifecycleStatus === 'client' ? '/customer-journey/customers?status=client' : '/customer-journey/customers?status=prospect' }, { label: party.name }]"
      >
        <template #actions>
          <StatusBadge :label="party.lifecycleStatus === 'client' ? 'Client' : 'Prospect'" :tone="party.lifecycleStatus === 'client' ? 'success' : 'info'" />
          <StatusBadge v-if="isPartyManovaClient" label="Manova Client" tone="purple" />
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
            <p class="text-sm text-muted-foreground mb-4">
              <template v-if="party.lifecycleStatus === 'prospect'">
                Party ini masih berstatus Prospect. Status akan otomatis berubah menjadi Client saat salah satu Lead
                milik party ini di-Mark as Won — tidak ada aksi ubah status manual.
              </template>
              <template v-else>
                Party ini adalah Client. Riwayat Contacts, Leads, dan Activities dari masa Prospect tetap tersimpan
                di bawah, tidak hilang setelah lifecycle berubah.
              </template>
            </p>
            <p class="text-xs font-medium text-muted-foreground mb-2">
              Contact Utama
            </p>
            <p v-if="contacts[0]" class="text-sm text-foreground">
              {{ contacts[0].name }} — <span class="text-muted-foreground">{{ contacts[0].title }}</span>
            </p>
            <EmptyState v-else title="Belum ada contact tercatat" />
          </SectionCard>

          <SectionCard v-if="party.lifecycleStatus === 'client' || linkedClientUser" title="Portal Access" class="mt-6">
            <template v-if="linkedClientUser">
              <p class="text-xs font-medium text-muted-foreground mb-2">
                Client Login Account
              </p>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-foreground">{{ linkedClientUser.name }}</span>
                <span class="text-sm text-muted-foreground">{{ linkedClientUser.email }}</span>
                <StatusBadge :label="linkedClientUser.status === 'active' ? 'Active' : 'Suspended'" :tone="linkedClientUser.status === 'active' ? 'success' : 'destructive'" />
              </div>
              <p class="text-xs text-muted-foreground mt-2">
                Akses portal client bisa didemokan lewat Settings → Role Switcher, pilih akun ini.
              </p>
            </template>
            <EmptyState v-else title="Belum ada akun portal client" description="Akun login client dibuat otomatis saat quotation pertama kali dikirim ke client (Send to Client)." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="contacts">
          <SectionCard title="Contacts">
            <template #actions>
              <Dialog v-if="canManageParty" v-model:open="isContactDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Tambah Contact
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tambah Contact Baru</DialogTitle>
                    <DialogDescription>Contact akan ditambahkan untuk {{ party.name }}.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="contact-name">Nama</Label>
                      <Input id="contact-name" v-model="contactName" placeholder="Nama contact person" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="contact-title">Jabatan</Label>
                      <Input id="contact-title" v-model="contactTitle" placeholder="mis. Operations Manager" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="contact-email">Email (opsional)</Label>
                      <Input id="contact-email" v-model="contactEmail" type="email" placeholder="nama@perusahaan.com" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="contact-phone">Telepon (opsional)</Label>
                      <Input id="contact-phone" v-model="contactPhone" placeholder="08xx-xxxx-xxxx" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isContactDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!contactName.trim() || !contactTitle.trim()" @click="submitContact">
                      Simpan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <ul class="divide-y divide-border">
              <li v-for="contact in contacts" :key="contact.id" class="py-3">
                <p class="text-sm font-medium text-foreground">
                  {{ contact.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ contact.title }}<template v-if="contact.email">
                    · <a :href="`mailto:${contact.email}`" class="hover:text-primary">{{ contact.email }}</a>
                  </template><template v-if="contact.phone">
                    · {{ contact.phone }}
                  </template>
                </p>
                <!-- Hyperlink WhatsApp (revisi.md #9) — membuka chat langsung ke nomor kontak. -->
                <a
                  v-if="whatsAppLink(contact.phone, contact.name)"
                  :href="whatsAppLink(contact.phone, contact.name)"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 mt-1.5 text-xs text-success hover:underline"
                >
                  <MessageCircle class="h-3.5 w-3.5" />
                  Chat via WhatsApp
                </a>
              </li>
            </ul>
            <EmptyState v-if="contacts.length === 0" title="Belum ada contact tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="leads">
          <SectionCard title="Leads">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status Quotation</TableHead>
                  <TableHead>Nilai Quotation</TableHead>
                  <TableHead>Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in leadDealRows"
                  :key="row.lead.id"
                  class="cursor-pointer hover:bg-muted/50"
                  @click="navigateTo(`/crm/leads/${row.lead.id}`)"
                >
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
                  <TableCell>
                    {{ row.quotation ? formatCurrencyIdr(row.quotation.amountIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatDate(row.lead.createdAt) }}
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="leadDealRows.length === 0" :colspan="4">
                  Belum ada lead untuk party ini.
                </TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activities">
          <SectionCard title="Activities">
            <template #actions>
              <Dialog v-if="canManageParty" v-model:open="isActivityDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">
                    <Plus class="h-4 w-4 mr-1.5" />Catat Activity
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Catat Activity Baru</DialogTitle>
                    <DialogDescription>Activity akan dicatat untuk {{ party.name }}, dimiliki oleh {{ currentUser.name }}.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-2">
                    <div class="space-y-1.5">
                      <Label for="activity-type">Jenis Activity</Label>
                      <select
                        id="activity-type"
                        v-model="activityType"
                        class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                      >
                        <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">
                          {{ type.label }}
                        </option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <Label for="activity-message">Catatan</Label>
                      <Input id="activity-message" v-model="activityMessage" placeholder="mis. Follow-up keputusan quotation" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="activity-due">Jadwal Follow-up Mendatang (opsional)</Label>
                      <Input id="activity-due" v-model="activityDueAt" type="date" />
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
            <EmptyState v-if="activities.length === 0" title="Belum ada activity tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent v-if="showProjectsTab" value="projects">
          <SectionCard title="Projects">
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
                    <SheetDescription>Untuk: {{ party.name }} — tanpa lewat Lead, status awal "Draft".</SheetDescription>
                  </SheetHeader>
                  <div class="space-y-4 py-4">
                    <div class="space-y-1.5">
                      <Label for="party-prj-name">Nama Project</Label>
                      <Input id="party-prj-name" v-model="newProjectName" placeholder="mis. Jakarta Business Trip Q1 2027" />
                    </div>
                    <div class="space-y-1.5">
                      <Label for="party-prj-destination">Destinasi</Label>
                      <Input id="party-prj-destination" v-model="newProjectDestination" placeholder="mis. Bali" />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="party-prj-start">Tanggal Berangkat</Label>
                        <Input id="party-prj-start" v-model="newProjectStartDate" type="date" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="party-prj-end">Tanggal Pulang</Label>
                        <Input id="party-prj-end" v-model="newProjectEndDate" type="date" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1.5">
                        <Label for="party-prj-travelers">Jumlah Traveler</Label>
                        <Input id="party-prj-travelers" v-model.number="newProjectTravelerCount" type="number" min="1" />
                      </div>
                      <div class="space-y-1.5">
                        <Label for="party-prj-amount">Nilai Kontrak (Rp)</Label>
                        <CurrencyInput id="party-prj-amount" v-model="newProjectAmountIdr" />
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
                        <Label :for="`party-prj-budget-${type.value}`" class="text-xs text-muted-foreground">
                          {{ type.value === 'additional' ? 'Other' : type.label }}
                        </Label>
                        <CurrencyInput :id="`party-prj-budget-${type.value}`" v-model="newProjectServiceBudgets[type.value]" placeholder="mis. 100000000" />
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

            <ul class="divide-y divide-border">
              <li v-for="project in projects" :key="project.id" class="py-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <NuxtLink :to="`/project-orders/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate block">
                    {{ project.name }}
                  </NuxtLink>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                  </p>
                </div>
                <StatusBadge
                  :label="findStatusOption(PROJECT_STATUSES, project.status).label"
                  :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
                />
              </li>
            </ul>
            <EmptyState v-if="projects.length === 0" title="Belum ada project" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="travel-history">
          <div class="space-y-5">
            <SectionCard
              title="Preferensi Perjalanan"
              description="Pola perjalanan diturunkan dari riwayat project yang benar-benar terjadi — bukan profil terpisah yang harus diisi ulang."
            >
              <template v-if="travelInsight">
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div class="rounded-lg bg-muted/40 px-3 py-2.5">
                    <p class="text-xs text-muted-foreground">
                      Total Perjalanan
                    </p>
                    <p class="text-sm font-semibold text-foreground mt-0.5">
                      {{ travelInsight.tripCount }} project
                    </p>
                  </div>
                  <div class="rounded-lg bg-muted/40 px-3 py-2.5">
                    <p class="text-xs text-muted-foreground">
                      Destinasi Favorit
                    </p>
                    <p class="text-sm font-semibold text-foreground mt-0.5">
                      {{ travelInsight.favouriteDestination ?? '—' }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ travelInsight.favouriteDestinationCount }}× dikunjungi
                    </p>
                  </div>
                  <div class="rounded-lg bg-muted/40 px-3 py-2.5">
                    <p class="text-xs text-muted-foreground">
                      Rata-rata Rombongan
                    </p>
                    <p class="text-sm font-semibold text-foreground mt-0.5">
                      {{ travelInsight.averagePax }} pax
                    </p>
                  </div>
                  <div class="rounded-lg bg-muted/40 px-3 py-2.5">
                    <p class="text-xs text-muted-foreground">
                      Rata-rata Durasi
                    </p>
                    <p class="text-sm font-semibold text-foreground mt-0.5">
                      {{ travelInsight.averageDurationDays }} hari
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                  <div>
                    <p class="text-xs font-medium text-muted-foreground mb-2">
                      Destinasi yang Pernah Dikunjungi
                    </p>
                    <ul class="space-y-1.5">
                      <li v-for="[destination, count] in travelInsight.destinations" :key="destination" class="flex items-center gap-2">
                        <span class="flex-1 text-sm text-foreground truncate">{{ destination }}</span>
                        <span class="text-xs text-muted-foreground">{{ count }}×</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p class="text-xs font-medium text-muted-foreground mb-2">
                      Layanan yang Biasa Dipakai
                    </p>
                    <div class="flex flex-wrap gap-2">
                      <StatusBadge
                        v-for="[service, count] in travelInsight.services"
                        :key="service"
                        :label="`${findStatusOption(SERVICE_TYPES, service).label} (${count})`"
                        :tone="findStatusOption(SERVICE_TYPES, service).tone"
                      />
                    </div>

                    <template v-if="travelInsight.loyalty">
                      <p class="text-xs font-medium text-muted-foreground mt-4 mb-2">
                        Status Loyalty
                      </p>
                      <div class="flex items-center gap-2">
                        <StatusBadge :label="travelInsight.loyalty.tier.label" tone="warning" />
                        <span class="text-sm text-foreground">{{ formatNumber(travelInsight.loyalty.totalPoints) }} poin</span>
                        <NuxtLink to="/crm/engagement#loyalty" class="text-xs text-primary hover:underline ml-auto">
                          Lihat program →
                        </NuxtLink>
                      </div>
                    </template>
                  </div>
                </div>

                <div v-if="party.travelPreferences" class="mt-4 pt-4 border-t border-border">
                  <p class="text-xs font-medium text-muted-foreground mb-1.5">
                    Catatan Preferensi
                  </p>
                  <p class="text-sm text-foreground leading-relaxed">
                    {{ party.travelPreferences }}
                  </p>
                </div>
              </template>

              <EmptyState v-else title="Belum ada riwayat perjalanan" description="Preferensi akan terbentuk otomatis setelah project pertama berjalan." />
            </SectionCard>

            <SectionCard title="Riwayat Perjalanan">
              <ul v-if="travelHistory.length" class="divide-y divide-border">
                <li v-for="row in travelHistory" :key="row.project.id" class="py-3.5 first:pt-0 last:pb-0">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <NuxtLink :to="`/project-orders/${row.project.id}`" class="text-sm font-medium text-foreground hover:text-primary">
                        {{ row.project.name }}
                      </NuxtLink>
                      <p class="text-xs text-muted-foreground mt-0.5">
                        {{ row.project.destination }} · {{ formatDateRange(row.project.travelStartDate, row.project.travelEndDate) }}
                        · {{ row.project.travelerCount }} pax
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-medium text-foreground">
                        {{ formatCurrencyIdr(row.invoicedIdr) }}
                      </p>
                      <StatusBadge
                        :label="findStatusOption(PROJECT_STATUSES, row.project.status).label"
                        :tone="findStatusOption(PROJECT_STATUSES, row.project.status).tone"
                      />
                    </div>
                  </div>
                  <p v-if="row.feedback?.comment" class="text-xs text-muted-foreground italic mt-1.5">
                    "{{ row.feedback.comment }}"
                  </p>
                </li>
              </ul>
              <EmptyState v-else title="Belum ada perjalanan tercatat" />
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
