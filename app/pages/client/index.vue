<script setup lang="ts">
import { ref, computed } from 'vue'
import { Building2, Briefcase, FolderKanban, Plus, Bell, Mail } from 'lucide-vue-next'
import {
  getPartyById, getOpportunitiesByParty, getProjectsByParty, getContactsByParty,
  getQuotationByOpportunity, getOpportunityWorkflowStatus, getTravelers, getInvoicesByProject,
  createContact, createLead, updateLeadQualification, getUserById,
} from '~/data'
import { OPPORTUNITY_WORKFLOW_STATUSES, PROJECT_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatDateRange, formatDate, formatCurrencyIdr } from '~/utils/format'
import { isTravelerDocumentMissing, isInvoiceOverdue } from '~/utils/attention'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Client Portal' })

const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Client isolation (Section 02/08) — seluruh data di halaman ini di-scope ke `clientScopeId` (company/`Party`
 * milik user login), tidak pernah membaca `PARTIES`/`OPPORTUNITIES`/`PROJECTS` penuh. Section 08 melengkapi
 * shell minimal Section 02 dengan fitur bisnis penuh: profile+contacts, travel request, quotation view+aksi
 * (di `/client/opportunities/[id]`), project order+itinerary+traveler+dokumen+finance+change request (di
 * `/client/project-orders/[id]`), action center. Larangan eksplisit protokol: TIDAK ada satu pun field
 * margin/cost internal (`discountIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/
 * `actualCostIdr`) yang dirender di halaman ini maupun 2 halaman turunannya.
 */
const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))
const opportunities = computed(() => (clientScopeId.value ? getOpportunitiesByParty(clientScopeId.value) : []))
const opportunitiesWithStatus = computed(() => opportunities.value.map(opportunity => ({
  opportunity,
  workflowStatus: getOpportunityWorkflowStatus(opportunity.id),
})))
const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const contacts = computed(() => (clientScopeId.value ? getContactsByParty(clientScopeId.value) : []))
const accountExecutive = computed(() => (party.value?.accountOwnerId ? getUserById(party.value.accountOwnerId) : undefined))

/** "Notifications/action center" (Wajib) — agregat lintas Opportunity/Project Order milik company, murni dirivasi dari data existing, bukan entitas notifikasi baru. */
const actionItems = computed(() => {
  const items: { key: string; label: string; to: string; tone: 'warning' | 'destructive' }[] = []
  for (const opportunity of opportunities.value) {
    const quotation = getQuotationByOpportunity(opportunity.id)
    if (quotation?.approvalStatus === 'approved' && !opportunity.clientConfirmedAt) {
      items.push({ key: `confirm-${opportunity.id}`, label: `Quotation "${opportunity.title}" menunggu konfirmasi Anda`, to: `/client/opportunities/${opportunity.id}`, tone: 'warning' })
    }
  }
  for (const project of projects.value) {
    if (['completed', 'cancelled'].includes(project.status)) continue
    const missingDocs = getTravelers(project.id).filter(traveler => isTravelerDocumentMissing(traveler, project.travelStartDate))
    if (missingDocs.length > 0) {
      items.push({ key: `docs-${project.id}`, label: `${missingDocs.length} traveler di "${project.name}" belum lengkap dokumennya`, to: `/client/project-orders/${project.id}?tab=travelers`, tone: 'warning' })
    }
    const overdueInvoices = getInvoicesByProject(project.id).filter(invoice => isInvoiceOverdue(invoice))
    for (const invoice of overdueInvoices) {
      items.push({ key: `invoice-${invoice.id}`, label: `Invoice "${invoice.label}" (${formatCurrencyIdr(invoice.amountIdr)}) telah jatuh tempo`, to: `/client/project-orders/${project.id}?tab=finance`, tone: 'destructive' })
    }
  }
  return items
})

/* Contacts */
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
  showToast('Kontak Ditambahkan', 'Kontak baru berhasil disimpan.', 'success')
}

/* Travel Request — membuat Lead baru (source client-portal) + qualification draft langsung dari detail yang diisi (Wajib "Travel request creation"). */
const isRequestDialogOpen = ref(false)
const requestDestination = ref('')
const requestStart = ref('')
const requestEnd = ref('')
const requestTravelerEstimate = ref<number | null>(null)
const requestServiceScope = ref<ServiceTypeKey[]>([])
const requestNotes = ref('')

function toggleRequestServiceScope(type: ServiceTypeKey) {
  const index = requestServiceScope.value.indexOf(type)
  if (index === -1) requestServiceScope.value.push(type)
  else requestServiceScope.value.splice(index, 1)
}

function submitTravelRequest() {
  if (!party.value || !requestDestination.value.trim()) return
  const lead = createLead({
    name: currentUser.value.name,
    companyName: party.value.name,
    source: 'client-portal',
    ownerId: party.value.accountOwnerId ?? 'USR-001',
    email: currentUser.value.email,
  })
  updateLeadQualification(lead.id, {
    destination: requestDestination.value.trim(),
    travelStartDate: requestStart.value || undefined,
    travelEndDate: requestEnd.value || undefined,
    travelerEstimate: requestTravelerEstimate.value ?? undefined,
    serviceScope: requestServiceScope.value,
    requirementSummary: requestNotes.value.trim() || undefined,
    handedOverTo: party.value.accountOwnerId,
  })
  requestDestination.value = ''
  requestStart.value = ''
  requestEnd.value = ''
  requestTravelerEstimate.value = null
  requestServiceScope.value = []
  requestNotes.value = ''
  isRequestDialogOpen.value = false
  showToast('Travel Request Terkirim', `Permintaan Anda (${lead.id}) telah diteruskan ke tim kami.`, 'success')
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Client Portal"
      :description="party ? `${party.name} — akses terbatas ke company Anda sendiri.` : 'Portal client.'"
      :breadcrumb="[{ label: 'Client Portal' }]"
    >
      <template v-if="party" #actions>
        <Dialog v-model:open="isRequestDialogOpen">
          <DialogTrigger as-child>
            <Button size="sm"><Plus class="h-4 w-4 mr-1.5" />Ajukan Travel Request</Button>
          </DialogTrigger>
          <DialogScrollContent class="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajukan Travel Request Baru</DialogTitle>
              <DialogDescription>Permintaan Anda akan diteruskan ke tim Sales/Account Executive kami untuk ditindaklanjuti.</DialogDescription>
            </DialogHeader>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="req-destination">Destinasi</Label>
                <Input id="req-destination" v-model="requestDestination" placeholder="mis. Bali, Indonesia" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <Label for="req-start">Perkiraan Mulai</Label>
                  <Input id="req-start" v-model="requestStart" type="date" />
                </div>
                <div class="space-y-1.5">
                  <Label for="req-end">Perkiraan Selesai</Label>
                  <Input id="req-end" v-model="requestEnd" type="date" />
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="req-traveler">Estimasi Jumlah Traveler</Label>
                <Input id="req-traveler" v-model.number="requestTravelerEstimate" type="number" />
              </div>
              <div class="space-y-1.5">
                <Label>Layanan yang Dibutuhkan</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in SERVICE_TYPES"
                    :key="type.value"
                    type="button"
                    class="rounded-full border px-3 py-1 text-xs transition-colors"
                    :class="requestServiceScope.includes(type.value) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
                    @click="toggleRequestServiceScope(type.value)"
                  >{{ type.label }}</button>
                </div>
              </div>
              <div class="space-y-1.5">
                <Label for="req-notes">Ceritakan Kebutuhan Anda</Label>
                <textarea id="req-notes" v-model="requestNotes" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Rombongan tim sales, butuh hotel dekat kantor cabang" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isRequestDialogOpen = false">Batal</Button>
              <Button :disabled="!requestDestination.trim()" @click="submitTravelRequest">Kirim Permintaan</Button>
            </DialogFooter>
          </DialogScrollContent>
        </Dialog>
      </template>
    </PageHeader>

    <RoleAccessState v-if="!canView('client-portal') || !party" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Status Company" :value="party.lifecycleStatus === 'client' ? 'Active Client' : 'Prospect'" :icon="Building2" />
        <StatsCard title="Opportunity" :value="String(opportunities.length)" :icon="Briefcase" />
        <StatsCard title="Project Order" :value="String(projects.length)" :icon="FolderKanban" />
      </div>

      <SectionCard title="Action Center" description="Hal-hal yang perlu tindakan Anda.">
        <ul v-if="actionItems.length" class="divide-y divide-border">
          <li v-for="item in actionItems" :key="item.key" class="py-3">
            <NuxtLink :to="item.to" class="flex items-center gap-3 group">
              <Bell class="h-4 w-4 shrink-0" :class="item.tone === 'destructive' ? 'text-destructive' : 'text-warning'" />
              <span class="text-sm text-foreground group-hover:underline">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Bell" title="Tidak ada tindakan yang perlu dilakukan saat ini" />
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Profil Company">
          <DetailMetadataList :items="[
            { label: 'Nama Company', value: party.name },
            { label: 'Kota', value: party.city || '—' },
            { label: 'Telepon', value: party.phone || '—' },
          ]" />
        </SectionCard>

        <SectionCard title="Support">
          <DetailMetadataList :items="[
            { label: 'Account Executive', value: accountExecutive?.name ?? 'Belum ditugaskan' },
          ]" />
          <a v-if="accountExecutive" :href="`mailto:${accountExecutive.email}`" class="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Mail class="h-4 w-4" />{{ accountExecutive.email }}
          </a>
          <p class="text-xs text-muted-foreground mt-2">Project Manager per Project Order tersedia di halaman detail masing-masing.</p>
        </SectionCard>
      </div>

      <SectionCard title="Contacts">
        <template #actions>
          <Dialog v-model:open="isContactDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Tambah Kontak</Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Kontak Baru</DialogTitle>
                <DialogDescription>Kontak akan tampil untuk tim kami sebagai referensi komunikasi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5"><Label for="contact-name">Nama</Label><Input id="contact-name" v-model="contactName" /></div>
                <div class="space-y-1.5"><Label for="contact-title">Jabatan</Label><Input id="contact-title" v-model="contactTitle" /></div>
                <div class="space-y-1.5"><Label for="contact-email">Email</Label><Input id="contact-email" v-model="contactEmail" type="email" /></div>
                <div class="space-y-1.5"><Label for="contact-phone">Telepon</Label><Input id="contact-phone" v-model="contactPhone" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isContactDialogOpen = false">Batal</Button>
                <Button :disabled="!contactName.trim() || !contactTitle.trim()" @click="submitContact">Simpan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>
        <ul v-if="contacts.length" class="divide-y divide-border">
          <li v-for="contact in contacts" :key="contact.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">{{ contact.name }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ contact.title }}</p>
            </div>
            <div class="text-right text-xs text-muted-foreground shrink-0">
              <p v-if="contact.email">{{ contact.email }}</p>
              <p v-if="contact.phone">{{ contact.phone }}</p>
            </div>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada kontak tercatat" />
      </SectionCard>

      <SectionCard title="Opportunity">
        <ul v-if="opportunitiesWithStatus.length" class="divide-y divide-border">
          <li v-for="row in opportunitiesWithStatus" :key="row.opportunity.id" class="py-3">
            <NuxtLink :to="`/client/opportunities/${row.opportunity.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">{{ row.opportunity.title }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ row.opportunity.destination }}</p>
              </div>
              <StatusBadge
                v-if="row.workflowStatus"
                :label="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, row.workflowStatus).label"
                :tone="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, row.workflowStatus).tone"
              />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Opportunity" description="Opportunity company Anda akan tampil di sini." />
      </SectionCard>

      <SectionCard title="Project Order">
        <ul v-if="projects.length" class="divide-y divide-border">
          <li v-for="project in projects" :key="project.id" class="py-3">
            <NuxtLink :to="`/client/project-orders/${project.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">{{ project.name }}</p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ project.destination }} · {{ formatDateRange(project.travelStartDate, project.travelEndDate) }}
                </p>
              </div>
              <StatusBadge
                :label="findStatusOption(PROJECT_STATUSES, project.status).label"
                :tone="findStatusOption(PROJECT_STATUSES, project.status).tone"
              />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Project Order" description="Project Order company Anda akan tampil di sini setelah Opportunity Won." />
      </SectionCard>
    </template>
  </div>
</template>
