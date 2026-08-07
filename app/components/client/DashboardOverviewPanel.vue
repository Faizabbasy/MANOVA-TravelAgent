<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  FolderKanban, Plus, Bell, Mail, PlaneTakeoff, ClipboardCheck, Users, Receipt,
  LifeBuoy, AlertTriangle, Send, UserPlus, Upload, Compass
} from 'lucide-vue-next'
import {
  getPartyById, getOpportunitiesByParty, getProjectsByParty, getContactsByParty,
  getQuotationByOpportunity, getOpportunityWorkflowStatus, getTravelers, getInvoicesByProject,
  createContact, getUserById,
  getInvoiceOutstandingIdr, getPaymentsByInvoice, getActivitiesByProject, getChangeRequestsByProject,
  getPendingClientApprovals, getSupportTicketsByParty, getClientProjectReadiness
} from '~/data'
import { OPPORTUNITY_WORKFLOW_STATUSES, PROJECT_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateRange, formatCurrencyIdr, formatDate, daysUntil } from '~/utils/format'
import { isTravelerDocumentMissing, isInvoiceOverdue, isInvoiceDueSoon, DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { AttentionItem } from '~/types/common'

/**
 * Tab "Overview" — Menu Client Portal > Dashboard (Penyederhanaan 7-Role/Menu). Dulu `/client` sepenuhnya,
 * kini tab dalam satu menu bersama Notifications (dulu `/client/notifications`) — logika tidak diubah.
 *
 * Client isolation (Section 02/08) — seluruh data di halaman ini di-scope ke `clientScopeId` (company/`Party`
 * milik user login), tidak pernah membaca `PARTIES`/`OPPORTUNITIES`/`PROJECTS` penuh. Section 08 melengkapi
 * shell minimal Section 02 dengan fitur bisnis penuh: profile+contacts, travel request, quotation view+aksi
 * (di `/client/opportunities/[id]`), project order+itinerary+traveler+dokumen+finance+change request (di
 * `/client/project-orders/[id]`), action center. Repair Phase Section 2 (Home — Dashboard) memperluas
 * halaman ini (bukan membangun ulang, mengikuti rekomendasi `docs/client-page-inventory.md` #1) dengan
 * summary card/Upcoming Trip/Recent Activity/Financial Summary/Quick Actions yang seluruhnya dihitung dari
 * data terpusat yang sama (`PROJECTS`/`INVOICES`/`TRAVELERS`/`NOTIFICATION_RECORDS` dkk), TIDAK ada angka
 * statis. Larangan eksplisit protokol tetap berlaku: TIDAK ada satu pun field margin/cost internal
 * (`discountIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr`/`budgetIdr`/`actualCostIdr`/
 * `commercialImpactIdr`) yang dirender di halaman ini maupun 2 halaman turunannya.
 */
const { canView, clientScopeId } = usePermissions()
const { showToast } = useToast()

const party = computed(() => (clientScopeId.value ? getPartyById(clientScopeId.value) : undefined))
const opportunities = computed(() => (clientScopeId.value ? getOpportunitiesByParty(clientScopeId.value) : []))
const opportunitiesWithStatus = computed(() => opportunities.value.map(opportunity => ({
  opportunity,
  workflowStatus: getOpportunityWorkflowStatus(opportunity.id)
})))

/** Opportunity detail sudah melebur ke Quotation detail (`/client/quotations/[id]`, Penyederhanaan 7-Role/Menu) — arahkan langsung ke situ bila quotation sudah ada, fallback ke Client Portal bila belum. */
function opportunityRoute (opportunityId: string): string {
  const quotation = getQuotationByOpportunity(opportunityId)
  return quotation ? `/client/quotations/${quotation.id}` : '/client'
}
const projects = computed(() => (clientScopeId.value ? getProjectsByParty(clientScopeId.value) : []))
const contacts = computed(() => (clientScopeId.value ? getContactsByParty(clientScopeId.value) : []))
const accountExecutive = computed(() => (party.value?.accountOwnerId ? getUserById(party.value.accountOwnerId) : undefined))

/* ==================================================
 * Summary cards (Wajib — Master Prompt bagian G.1)
 * ================================================== */
const allInvoices = computed(() => projects.value.flatMap(project => getInvoicesByProject(project.id)))
const activeProjects = computed(() => projects.value.filter(project => !['completed', 'cancelled'].includes(project.status)))
/** "Upcoming trip" — sedang berjalan (`ongoing-trip`) atau keberangkatan di masa depan, bukan project yang sudah selesai/batal. */
const upcomingTripProjects = computed(() => activeProjects.value
  .filter(project => project.status === 'ongoing-trip' || daysUntil(project.travelStartDate, DEMO_REFERENCE_DATE) >= 0)
  .sort((a, b) => daysUntil(a.travelStartDate, DEMO_REFERENCE_DATE) - daysUntil(b.travelStartDate, DEMO_REFERENCE_DATE)))

const quotationsAwaitingConfirm = computed(() => opportunities.value
  .map(opportunity => ({ opportunity, quotation: getQuotationByOpportunity(opportunity.id) }))
  .filter(row => row.quotation?.approvalStatus === 'approved' && !row.opportunity.clientConfirmedAt))
const pendingApprovalsCount = computed(() =>
  quotationsAwaitingConfirm.value.length + (clientScopeId.value ? getPendingClientApprovals(clientScopeId.value).length : 0))

const incompleteParticipantsCount = computed(() => activeProjects.value.reduce(
  (sum, project) => sum + getTravelers(project.id).filter(traveler => isTravelerDocumentMissing(traveler, project.travelStartDate)).length,
  0
))

const outstandingInvoices = computed(() => allInvoices.value.filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void'))

const openSupportTickets = computed(() =>
  (clientScopeId.value ? getSupportTicketsByParty(clientScopeId.value) : []).filter(ticket => !['resolved', 'closed'].includes(ticket.status)))

/**
 * Action Required (Wajib) — agregat AttentionItem, setiap item WAJIB membuka halaman terkait
 * (`docs/client-page-inventory.md` acceptance). Diperluas dari Action Center lama (Section 08): kini juga
 * mencakup pending Approval generik, invoice akan jatuh tempo, dan open Support Ticket — seluruhnya derivasi
 * murni dari data yang sudah ada, bukan entitas notifikasi baru.
 */
const actionQueue = computed<AttentionItem[]>(() => {
  const items: AttentionItem[] = []
  for (const row of quotationsAwaitingConfirm.value) {
    items.push({ id: `approval-quotation-${row.opportunity.id}`, severity: 'medium', message: `Quotation "${row.opportunity.title}" menunggu konfirmasi Anda`, relatedRoute: `/client/quotations/${row.quotation.id}` })
  }
  if (clientScopeId.value) {
    for (const approval of getPendingClientApprovals(clientScopeId.value)) {
      items.push({ id: `approval-${approval.id}`, severity: 'medium', projectId: approval.projectId, message: `Approval "${approval.entityType}" pada project ${approval.projectId} menunggu keputusan Anda`, relatedRoute: '/client/travel-requests#approvals' })
    }
  }
  for (const project of activeProjects.value) {
    const missingDocs = getTravelers(project.id).filter(traveler => isTravelerDocumentMissing(traveler, project.travelStartDate))
    if (missingDocs.length > 0) {
      items.push({ id: `docs-${project.id}`, severity: 'medium', projectId: project.id, message: `${missingDocs.length} traveler pada "${project.name}" belum lengkap dokumennya`, relatedRoute: `/client/project-orders/${project.id}?tab=travelers` })
    }
    for (const invoice of getInvoicesByProject(project.id)) {
      if (isInvoiceOverdue(invoice)) {
        items.push({ id: `invoice-overdue-${invoice.id}`, severity: 'high', projectId: project.id, message: `Invoice "${invoice.label}" (${formatCurrencyIdr(invoice.amountIdr)}) telah jatuh tempo`, relatedRoute: `/client/project-orders/${project.id}?tab=finance` })
      } else if (isInvoiceDueSoon(invoice)) {
        items.push({ id: `invoice-due-soon-${invoice.id}`, severity: 'low', projectId: project.id, message: `Invoice "${invoice.label}" akan jatuh tempo ${formatDate(invoice.dueAt)}`, relatedRoute: `/client/project-orders/${project.id}?tab=finance` })
      }
    }
  }
  for (const ticket of openSupportTickets.value) {
    items.push({ id: `support-${ticket.id}`, severity: 'low', message: `Support ticket "${ticket.subject}" masih ${ticket.status}`, relatedRoute: '/client/documents#support' })
  }
  return items
})
function actionTone (severity: AttentionItem['severity']): 'destructive' | 'warning' | 'info' {
  return severity === 'high' ? 'destructive' : severity === 'medium' ? 'warning' : 'info'
}

/* ==================================================
 * Financial summary (Wajib)
 * ================================================== */
const invoicedTotal = computed(() => allInvoices.value.reduce((sum, invoice) => sum + invoice.amountIdr, 0))
const outstandingTotal = computed(() => allInvoices.value.reduce((sum, invoice) => sum + getInvoiceOutstandingIdr(invoice.id), 0))
const paidTotal = computed(() => invoicedTotal.value - outstandingTotal.value)
const overdueTotal = computed(() => allInvoices.value.filter(invoice => isInvoiceOverdue(invoice)).reduce((sum, invoice) => sum + getInvoiceOutstandingIdr(invoice.id), 0))
const nextDueInvoice = computed(() => [...allInvoices.value]
  .filter(invoice => invoice.status !== 'paid' && invoice.status !== 'void')
  .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0])

/* ==================================================
 * Recent activity (Wajib — "activity mock terpusat")
 * ================================================== */
interface RecentActivityRow { id: string; message: string; projectName?: string; createdAt: string; isChange?: boolean }
const recentActivityItems = computed<RecentActivityRow[]>(() => {
  const items: RecentActivityRow[] = []
  for (const project of projects.value) {
    for (const activity of getActivitiesByProject(project.id)) {
      items.push({ id: activity.id, message: activity.message, projectName: project.name, createdAt: activity.createdAt, isChange: activity.isChange })
    }
    for (const invoice of getInvoicesByProject(project.id)) {
      for (const payment of getPaymentsByInvoice(invoice.id)) {
        items.push({ id: payment.id, message: `Pembayaran ${formatCurrencyIdr(payment.amountIdr)} diterima untuk "${invoice.label}"`, projectName: project.name, createdAt: payment.receivedAt })
      }
    }
    for (const changeRequest of getChangeRequestsByProject(project.id)) {
      items.push({ id: changeRequest.id, message: `Change Request ${changeRequest.id} diajukan: ${changeRequest.beforeSummary} → ${changeRequest.afterSummary}`, projectName: project.name, createdAt: changeRequest.submittedAt, isChange: true })
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
})

/* ==================================================
 * Quick actions (Wajib)
 * ================================================== */
const reviewApprovalTarget = computed(() => quotationsAwaitingConfirm.value[0]
  ? `/client/quotations/${quotationsAwaitingConfirm.value[0].quotation.id}`
  : '/client/travel-requests#approvals')
const addParticipantTarget = computed(() => (upcomingTripProjects.value[0] ?? activeProjects.value[0])
  ? `/client/project-orders/${(upcomingTripProjects.value[0] ?? activeProjects.value[0]).id}?tab=travelers`
  : '/client/project-orders#participants')

const quickActions = computed(() => [
  { key: 'travel-request', label: 'Create Travel Request', icon: Send, to: '/client/travel-requests/new' },
  { key: 'approval', label: 'Review Approval', icon: ClipboardCheck, to: reviewApprovalTarget.value },
  { key: 'participant', label: 'Add Participant', icon: UserPlus, to: addParticipantTarget.value },
  { key: 'trip-center', label: 'Open Trip Center', icon: Compass, to: '/client/project-orders#trip-center' },
  { key: 'payment', label: 'Upload Payment Proof', icon: Upload, to: '/client/billing' },
  { key: 'support', label: 'Create Support Ticket', icon: LifeBuoy, to: '/client/documents#support' }
])

/* Contacts */
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
  showToast('Kontak Ditambahkan', 'Kontak baru berhasil disimpan.', 'success')
}

</script>

<template>
  <div class="space-y-6">
    <div v-if="party" class="flex justify-end">
      <NuxtLink to="/client/travel-requests/new">
        <Button size="sm">
          <Plus class="h-4 w-4 mr-1.5" />Ajukan Travel Request
        </Button>
      </NuxtLink>
    </div>

    <RoleAccessState v-if="!canView('client-portal') || !party" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Projects" :value="String(activeProjects.length)" :icon="FolderKanban" />
        <StatsCard title="Upcoming Trips" :value="String(upcomingTripProjects.length)" :icon="PlaneTakeoff" />
        <StatsCard title="Pending Approvals" :value="String(pendingApprovalsCount)" :icon="ClipboardCheck" icon-color="warning" />
        <StatsCard title="Incomplete Participants" :value="String(incompleteParticipantsCount)" :icon="Users" icon-color="warning" />
        <StatsCard title="Outstanding Invoices" :value="String(outstandingInvoices.length)" :icon="Receipt" icon-color="warning" />
        <StatsCard title="Open Issues" :value="String(openSupportTickets.length)" :icon="LifeBuoy" />
        <StatsCard title="Action Required" :value="String(actionQueue.length)" :icon="AlertTriangle" icon-color="destructive" />
      </div>

      <SectionCard title="Quick Actions">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.key"
            :to="action.to"
            class="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center hover:bg-muted/50 transition-colors"
          >
            <component :is="action.icon" class="h-5 w-5 text-primary" />
            <span class="text-xs font-medium text-foreground">{{ action.label }}</span>
          </NuxtLink>
        </div>
      </SectionCard>

      <SectionCard title="Action Required" description="Hal-hal yang perlu tindakan Anda.">
        <ul v-if="actionQueue.length" class="divide-y divide-border">
          <li v-for="item in actionQueue" :key="item.id" class="py-3">
            <NuxtLink :to="item.relatedRoute ?? '/client'" class="flex items-center gap-3 group">
              <Bell class="h-4 w-4 shrink-0" :class="actionTone(item.severity) === 'destructive' ? 'text-destructive' : actionTone(item.severity) === 'warning' ? 'text-warning' : 'text-primary'" />
              <span class="text-sm text-foreground group-hover:underline">{{ item.message }}</span>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="Bell" title="Tidak ada tindakan yang perlu dilakukan saat ini" />
      </SectionCard>

      <SectionCard title="Upcoming Trip" description="Project aktif dengan keberangkatan mendatang atau trip yang sedang berjalan.">
        <ul v-if="upcomingTripProjects.length" class="divide-y divide-border">
          <li v-for="trip in upcomingTripProjects" :key="trip.id" class="py-4 space-y-2">
            <div class="flex items-center justify-between gap-3">
              <NuxtLink :to="`/client/project-orders/${trip.id}`" class="text-sm font-medium text-foreground hover:underline truncate">
                {{ trip.name }}
              </NuxtLink>
              <StatusBadge :label="findStatusOption(PROJECT_STATUSES, trip.status).label" :tone="findStatusOption(PROJECT_STATUSES, trip.status).tone" />
            </div>
            <p class="text-xs text-muted-foreground">
              {{ trip.destination }} · {{ formatDateRange(trip.travelStartDate, trip.travelEndDate) }} · {{ trip.travelerCount }} peserta
            </p>
            <p class="text-xs text-muted-foreground">
              Manova PIC: {{ getUserById(trip.ownerId)?.name ?? '—' }}
            </p>
            <div class="space-y-1 max-w-sm">
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>Readiness</span>
                <span>{{ getClientProjectReadiness(trip.id).overallPercent }}%</span>
              </div>
              <Progress :model-value="getClientProjectReadiness(trip.id).overallPercent" />
            </div>
          </li>
        </ul>
        <EmptyState v-else :icon="PlaneTakeoff" title="Tidak ada trip mendatang" description="Trip yang akan berangkat atau sedang berjalan akan tampil di sini." />
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Financial Summary">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-muted-foreground">
                Invoiced
              </p>
              <p class="text-sm font-medium text-foreground">
                {{ formatCurrencyIdr(invoicedTotal) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Paid
              </p>
              <p class="text-sm font-medium text-success">
                {{ formatCurrencyIdr(paidTotal) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Outstanding
              </p>
              <p class="text-sm font-medium text-warning">
                {{ formatCurrencyIdr(outstandingTotal) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Overdue
              </p>
              <p class="text-sm font-medium text-destructive">
                {{ formatCurrencyIdr(overdueTotal) }}
              </p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-muted-foreground">
                Next Due
              </p>
              <p class="text-sm font-medium text-foreground">
                <template v-if="nextDueInvoice">
                  {{ nextDueInvoice.label }} — {{ formatDate(nextDueInvoice.dueAt) }}
                </template>
                <template v-else>
                  Tidak ada invoice outstanding
                </template>
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity">
          <RecentActivity :items="recentActivityItems" />
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Profil Company">
          <DetailMetadataList
            :items="[
              { label: 'Nama Company', value: party.name },
              { label: 'Kota', value: party.city || '—' },
              { label: 'Telepon', value: party.phone || '—' },
            ]"
          />
        </SectionCard>

        <SectionCard title="Support">
          <DetailMetadataList
            :items="[
              { label: 'Account Executive', value: accountExecutive?.name ?? 'Belum ditugaskan' },
            ]"
          />
          <a v-if="accountExecutive" :href="`mailto:${accountExecutive.email}`" class="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Mail class="h-4 w-4" />{{ accountExecutive.email }}
          </a>
          <p class="text-xs text-muted-foreground mt-2">
            Project Manager per Project Order tersedia di halaman detail masing-masing.
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Contacts">
        <template #actions>
          <Dialog v-model:open="isContactDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Kontak
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Kontak Baru</DialogTitle>
                <DialogDescription>Kontak akan tampil untuk tim kami sebagai referensi komunikasi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="contact-name">Nama</Label><Input id="contact-name" v-model="contactName" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contact-title">Jabatan</Label><Input id="contact-title" v-model="contactTitle" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contact-email">Email</Label><Input id="contact-email" v-model="contactEmail" type="email" />
                </div>
                <div class="space-y-1.5">
                  <Label for="contact-phone">Telepon</Label><Input id="contact-phone" v-model="contactPhone" />
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
        <ul v-if="contacts.length" class="divide-y divide-border">
          <li v-for="contact in contacts" :key="contact.id" class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-foreground truncate">
                {{ contact.name }}
              </p>
              <p class="text-xs text-muted-foreground truncate">
                {{ contact.title }}
              </p>
            </div>
            <div class="text-right text-xs text-muted-foreground shrink-0">
              <p v-if="contact.email">
                {{ contact.email }}
              </p>
              <p v-if="contact.phone">
                {{ contact.phone }}
              </p>
            </div>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada kontak tercatat" />
      </SectionCard>

      <SectionCard title="Opportunity">
        <ul v-if="opportunitiesWithStatus.length" class="divide-y divide-border">
          <li v-for="row in opportunitiesWithStatus" :key="row.opportunity.id" class="py-3">
            <NuxtLink :to="opportunityRoute(row.opportunity.id)" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ row.opportunity.title }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.opportunity.destination }}
                </p>
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
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ project.name }}
                </p>
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
