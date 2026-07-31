<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getPartyById, getContactsByParty, getOpportunitiesByParty, getProjectsByParty, getPartyActivities,
  getDocumentsByParty, getUserById,
} from '~/data'
import { OPPORTUNITY_STAGES, PROJECT_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { StatusOption } from '~/types/common'
import type { PartyLifecycleStatus } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView } = usePermissions()
const { currentRole } = useCurrentUser()
/** Sales dibatasi ke Lead saja pada Customer Journey (docs Prompt 19-10) — narrow exception. */
const hasAccess = computed(() => canView('crm') && currentRole.value !== 'sales')

const LIFECYCLE_STATUSES: StatusOption<PartyLifecycleStatus>[] = [
  { value: 'prospect', label: 'Prospect', tone: 'warning', order: 1 },
  { value: 'client', label: 'Active Client', tone: 'success', order: 2 },
]

type CustomerDetailTab = 'overview' | 'contacts' | 'opportunities' | 'project-orders' | 'activities' | 'documents'

const party = computed(() => getPartyById(String(route.params.id)))
useHead({ title: computed(() => party.value ? party.value.name : 'Company Tidak Ditemukan') })

const contacts = computed(() => (party.value ? getContactsByParty(party.value.id) : []))
const opportunities = computed(() => (party.value ? getOpportunitiesByParty(party.value.id) : []))
const projectOrders = computed(() => (party.value ? getProjectsByParty(party.value.id) : []))
const activities = computed(() => (party.value ? getPartyActivities(party.value.id) : []))
const documents = computed(() => (party.value ? getDocumentsByParty(party.value.id) : []))

const summaryMetadata = computed(() => {
  if (!party.value) return []
  return [
    { label: 'Status', value: findStatusOption(LIFECYCLE_STATUSES, party.value.lifecycleStatus).label },
    { label: 'Account Owner', value: party.value.accountOwnerId ? getUserById(party.value.accountOwnerId)?.name ?? '—' : '—' },
    { label: 'Industri', value: party.value.industry ?? '—' },
    { label: 'Ukuran Perusahaan', value: party.value.size ?? '—' },
    { label: 'Kota', value: party.value.city ?? '—' },
    { label: 'Telepon', value: party.value.phone ?? '—' },
    { label: 'Total Opportunities', value: String(opportunities.value.length) },
    { label: 'Total Project Orders', value: String(projectOrders.value.length) },
  ]
})

const activeTab = computed<CustomerDetailTab>({
  get: () => (route.query.tab as CustomerDetailTab) || 'overview',
  set: value => router.replace({ query: { ...route.query, tab: value } }),
})

const TABS: { value: CustomerDetailTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'project-orders', label: 'Project Orders' },
  { value: 'activities', label: 'Activities' },
  { value: 'documents', label: 'Documents' },
]
</script>

<template>
  <div class="space-y-6">
    <template v-if="!party">
      <PageHeader title="Company Tidak Ditemukan" :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Customers', to: '/customer-journey/customers' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Company tidak ditemukan" :description="`Company dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/customer-journey/customers')">Kembali ke Daftar Customers</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul Customer Journey" />

    <template v-else>
      <PageHeader
        :title="party.name"
        :breadcrumb="[{ label: 'Customer Journey', to: '/customer-journey' }, { label: 'Customers', to: '/customer-journey/customers' }, { label: party.name }]"
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
          <TabsTrigger v-for="tab in TABS" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SectionCard title="Ringkasan">
            <p class="text-sm text-muted-foreground">
              Company ini merepresentasikan entitas Party/CRM yang sama dengan `/crm/prospects`/`/crm/clients` —
              lihat juga <NuxtLink :to="`/crm/parties/${party.id}`" class="text-primary hover:underline">Party Detail (CRM)</NuxtLink> untuk tab Overview/Contacts/Opportunities/Activities standar.
            </p>
          </SectionCard>
        </TabsContent>

        <TabsContent value="contacts">
          <SectionCard title="Contacts">
            <ul v-if="contacts.length" class="divide-y divide-border">
              <li v-for="contact in contacts" :key="contact.id" class="py-3">
                <p class="text-sm font-medium text-foreground">{{ contact.name }}</p>
                <p class="text-xs text-muted-foreground">{{ contact.title }}<template v-if="contact.email"> · {{ contact.email }}</template><template v-if="contact.phone"> · {{ contact.phone }}</template></p>
              </li>
            </ul>
            <EmptyState v-else title="Belum ada contact person" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="opportunities">
          <SectionCard title="Opportunities">
            <Table v-if="opportunities.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Account Executive</TableHead>
                  <TableHead>Estimasi Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="opp in opportunities" :key="opp.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/crm/opportunities/${opp.id}`)">
                  <TableCell class="font-medium text-foreground">{{ opp.title }}</TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(OPPORTUNITY_STAGES, opp.stage).label" :tone="findStatusOption(OPPORTUNITY_STAGES, opp.stage).tone" /></TableCell>
                  <TableCell class="text-muted-foreground">{{ getUserById(opp.ownerId)?.name ?? '—' }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(opp.estimatedValueIdr) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else title="Belum ada opportunity" />
          </SectionCard>
        </TabsContent>

        <TabsContent value="project-orders">
          <SectionCard title="Project Orders">
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
                <TableRow v-for="project in projectOrders" :key="project.id" class="cursor-pointer hover:bg-muted/50" @click="navigateTo(`/customer-journey/project-orders/${project.id}`)">
                  <TableCell class="font-medium text-foreground">{{ project.name }}<span class="block text-xs text-muted-foreground font-normal">{{ project.id }}</span></TableCell>
                  <TableCell class="text-muted-foreground">{{ project.destination }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDateRange(project.travelStartDate, project.travelEndDate) }}</TableCell>
                  <TableCell><StatusBadge :label="findStatusOption(PROJECT_STATUSES, project.status).label" :tone="findStatusOption(PROJECT_STATUSES, project.status).tone" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <EmptyState v-else title="Belum ada Project Order" description="Company ini belum memiliki Project Order (belum ada Opportunity yang Won)." />
          </SectionCard>
        </TabsContent>

        <TabsContent value="activities">
          <SectionCard title="Activities">
            <ul v-if="activities.length" class="divide-y divide-border">
              <li v-for="activity in activities" :key="activity.id" class="py-3">
                <p class="text-sm text-foreground">{{ activity.message }}</p>
                <p class="text-xs text-muted-foreground">{{ formatDate(activity.createdAt) }}<template v-if="activity.dueAt"> · Follow-up dijadwalkan {{ formatDate(activity.dueAt) }}</template></p>
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
