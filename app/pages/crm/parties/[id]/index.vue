<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getPartyById, getContactsByParty, getOpportunitiesByParty, getPartyActivities, getProjectsByParty,
  getQuotationByOpportunity, createContact, createPartyActivity,
} from '~/data'
import { OPPORTUNITY_STAGES, PROJECT_STATUSES, PARTY_ACTIVITY_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { PartyDetailTab, PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentRole, currentUser } = useCurrentUser()
const { canView } = usePermissions()

/** Lihat catatan yang sama di `crm/prospects.vue` — pengecualian sempit, bukan mekanisme role-check baru. */
const canManageParty = computed(() => ['sales', 'super-admin'].includes(currentRole.value))

const party = computed(() => getPartyById(String(route.params.id)))
useHead({ title: computed(() => party.value ? party.value.name : 'Party Tidak Ditemukan') })

const contacts = computed(() => (party.value ? getContactsByParty(party.value.id) : []))
const opportunities = computed(() => (party.value ? getOpportunitiesByParty(party.value.id) : []))
const activities = computed(() => (party.value ? getPartyActivities(party.value.id) : []))
const projects = computed(() => (party.value ? getProjectsByParty(party.value.id) : []))

/** Tab "Projects" kondisional — hanya tampil bila Client dan minimal 1 project (docs IA bagian 3.2/5). */
const showProjectsTab = computed(() => party.value?.lifecycleStatus === 'client' && projects.value.length > 0)

const activeTab = computed<PartyDetailTab>({
  get: () => (route.query.tab as PartyDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } }),
})

const TABS = computed(() => {
  const base: { value: PartyDetailTab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'opportunities', label: 'Opportunities' },
    { value: 'activities', label: 'Activities' },
  ]
  if (showProjectsTab.value) base.push({ value: 'projects', label: 'Projects' })
  return base
})

const summaryMetadata = computed(() => {
  if (!party.value) return []
  return [
    { label: 'Lifecycle Status', value: party.value.lifecycleStatus === 'client' ? 'Client' : 'Prospect' },
    { label: 'Industri', value: party.value.industry ?? '—' },
    { label: 'Dibuat', value: formatDate(party.value.createdAt) },
    { label: 'Jumlah Contact', value: String(contacts.value.length) },
    { label: 'Jumlah Opportunity', value: String(opportunities.value.length) },
    { label: 'Jumlah Project', value: String(projects.value.length) },
  ]
})

/* Tambah Contact */
const isContactDialogOpen = ref(false)
const contactName = ref('')
const contactTitle = ref('')
const contactEmail = ref('')
const contactPhone = ref('')

function submitContact() {
  if (!party.value || !contactName.value.trim() || !contactTitle.value.trim()) return
  createContact({
    partyId: party.value.id,
    name: contactName.value.trim(),
    title: contactTitle.value.trim(),
    email: contactEmail.value.trim() || undefined,
    phone: contactPhone.value.trim() || undefined,
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

function submitActivity() {
  if (!party.value || !activityMessage.value.trim()) return
  createPartyActivity({
    partyId: party.value.id,
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
    <template v-if="!party">
      <PageHeader title="Party Tidak Ditemukan" :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Party tidak ditemukan"
          :description="`Party dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/crm')">Kembali ke CRM</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <PageHeader
        :title="party.name"
        :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: party.lifecycleStatus === 'client' ? 'Clients' : 'Prospects', to: party.lifecycleStatus === 'client' ? '/crm/clients' : '/crm/prospects' }, { label: party.name }]"
      >
        <template #actions>
          <StatusBadge :label="party.lifecycleStatus === 'client' ? 'Client' : 'Prospect'" :tone="party.lifecycleStatus === 'client' ? 'success' : 'info'" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard title="Ringkasan">
            <p class="text-sm text-muted-foreground mb-4">
              <template v-if="party.lifecycleStatus === 'prospect'">
                Party ini masih berstatus Prospect. Status akan otomatis berubah menjadi Client saat salah satu Opportunity
                milik party ini disetujui menjadi Won — tidak ada aksi ubah status manual.
              </template>
              <template v-else>
                Party ini adalah Client. Riwayat Contacts, Opportunities, dan Activities dari masa Prospect tetap tersimpan
                di bawah, tidak hilang setelah lifecycle berubah.
              </template>
            </p>
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact Utama</p>
            <p v-if="contacts[0]" class="text-sm text-foreground">{{ contacts[0].name }} — <span class="text-muted-foreground">{{ contacts[0].title }}</span></p>
            <EmptyState v-else title="Belum ada contact tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="contacts">
          <SectionCard title="Contacts">
            <template #actions>
              <Dialog v-if="canManageParty" v-model:open="isContactDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Tambah Contact</Button>
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
                    <Button variant="outline" @click="isContactDialogOpen = false">Batal</Button>
                    <Button :disabled="!contactName.trim() || !contactTitle.trim()" @click="submitContact">Simpan</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <ul class="divide-y divide-border">
              <li v-for="contact in contacts" :key="contact.id" class="py-3">
                <p class="text-sm font-medium text-foreground">{{ contact.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ contact.title }}<template v-if="contact.email"> · {{ contact.email }}</template><template v-if="contact.phone"> · {{ contact.phone }}</template>
                </p>
              </li>
            </ul>
            <EmptyState v-if="contacts.length === 0" title="Belum ada contact tercatat" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="opportunities">
          <SectionCard title="Opportunities">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Nilai Quotation</TableHead>
                  <TableHead>Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="opportunity in opportunities" :key="opportunity.id">
                  <TableCell class="font-medium text-foreground">{{ opportunity.title }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).label"
                      :tone="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).tone"
                    />
                  </TableCell>
                  <TableCell>
                    {{ getQuotationByOpportunity(opportunity.id) ? formatCurrencyIdr(getQuotationByOpportunity(opportunity.id)!.amountIdr) : '—' }}
                  </TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDate(opportunity.createdAt) }}</TableCell>
                </TableRow>
                <TableEmpty v-if="opportunities.length === 0" :colspan="4">Belum ada opportunity untuk party ini.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activities">
          <SectionCard title="Activities">
            <template #actions>
              <Dialog v-if="canManageParty" v-model:open="isActivityDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Catat Activity</Button>
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
                        <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
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
                    <Button variant="outline" @click="isActivityDialogOpen = false">Batal</Button>
                    <Button :disabled="!activityMessage.trim()" @click="submitActivity">Simpan</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </template>

            <ul class="divide-y divide-border">
              <li v-for="activity in activities" :key="activity.id" class="py-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm text-foreground">{{ activity.message }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(activity.createdAt) }}<template v-if="activity.dueAt"> · Follow-up dijadwalkan {{ formatDate(activity.dueAt) }}</template>
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
            <ul class="divide-y divide-border">
              <li v-for="project in projects" :key="project.id" class="py-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <NuxtLink :to="`/projects/${project.id}`" class="text-sm font-medium text-foreground hover:underline truncate block">{{ project.name }}</NuxtLink>
                  <p class="text-xs text-muted-foreground truncate">{{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}</p>
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
      </Tabs>
    </template>
  </div>
</template>
