<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus, Trash2, Printer, ClipboardList, AlertTriangle, ArrowLeft } from 'lucide-vue-next'
import {
  getMiceEventById, getMiceBoqTotals, getMiceScheduleConflicts,
  getMiceEventStatusTransitions, updateMiceEventStatus,
  getMiceApprovalTransitions, updateMiceClientApproval,
  toggleMiceChecklistItem, toggleMiceDeliverable, updateMiceEvent,
  getProjectById, getUserById, USERS, VENDORS, getProjectServiceById, setServiceVendor,
  createCancellationRecord
} from '~/data'
import { MICE_EVENT_STATUSES, MICE_APPROVAL_STATUSES, MICE_BOQ_CATEGORIES, MICE_CHECKLIST_TASKS, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { MiceEventStatus, MiceApprovalStatus, MiceSession, MiceParticipantCategory, MiceBoqItem, MiceStaffAssignment, MiceChecklistTask } from '~/types/mice'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const canManageMice = computed(() => canManage('mice'))
/** Internal cost isolation (hard rule protokol) — MICE (pengelola langsung) dan role finansial penuh (D-030) yang melihat net cost; role lain hanya melihat sell price. Pola identik section 13-15. */
const canViewMiceFinancials = computed(() => canManageMice.value || canViewFinancials.value)
const { showToast } = useToast()

const event = computed(() => getMiceEventById(String(route.params.id)))
useHead({ title: computed(() => event.value ? `MICE Event ${event.value.id}` : 'MICE Event Tidak Ditemukan') })

const project = computed(() => (event.value ? getProjectById(event.value.projectId) : undefined))
const totals = computed(() => (event.value ? getMiceBoqTotals(event.value) : {}))
const conflicts = computed(() => (event.value ? getMiceScheduleConflicts(event.value) : []))
const totalExpected = computed(() => event.value ? event.value.participantCategories.reduce((sum, c) => sum + c.expectedCount, 0) : 0)
const totalActual = computed(() => event.value ? event.value.participantCategories.reduce((sum, c) => sum + (c.actualCount ?? 0), 0) : 0)

function userName (id?: string) {
  return id ? (getUserById(id)?.name ?? id) : '—'
}
function vendorName (id?: string) {
  return id ? (VENDORS.find(v => v.id === id)?.name ?? id) : '—'
}

const summaryMetadata = computed(() => {
  if (!event.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? event.value.projectId },
    { label: 'Venue', value: event.value.venueName ?? '—' },
    { label: 'Alamat Venue', value: event.value.venueAddress ?? '—' },
    { label: 'Peserta (Expected / Actual)', value: `${totalExpected.value} / ${totalActual.value} pax` },
    { label: 'Dibuat', value: formatDate(event.value.createdAt) }
  ]
})

/* Event status transitions */
const isStatusDialogOpen = ref(false)
const pendingStatus = ref<MiceEventStatus | null>(null)
const statusReason = ref('')
/** "Cancellation and penalty" (Section 19, D-076) — hook ADITIF, lihat komentar identik `app/pages/ticketing/[id]/index.vue`. */
const cancellationPenalty = ref<number | null>(null)
const cancellationRefundEligible = ref(true)

function requestStatusChange (newStatus: MiceEventStatus) {
  if (newStatus === 'cancelled') {
    pendingStatus.value = newStatus
    statusReason.value = ''
    cancellationPenalty.value = null
    cancellationRefundEligible.value = true
    isStatusDialogOpen.value = true
    return
  }
  if (!event.value) { return }
  updateMiceEventStatus(event.value.id, newStatus, currentUser.value.id)
  showToast('Status Diperbarui', `MICE Event kini berstatus "${findStatusOption(MICE_EVENT_STATUSES, newStatus).label}".`, 'success')
}

function submitStatusChange () {
  if (!event.value || !pendingStatus.value || !statusReason.value.trim()) { return }
  const targetStatus = pendingStatus.value
  const result = updateMiceEventStatus(event.value.id, targetStatus, currentUser.value.id, statusReason.value.trim())
  isStatusDialogOpen.value = false
  if (!result) { return }
  if (targetStatus === 'cancelled') {
    createCancellationRecord({
      projectId: result.projectId,
      bookingType: 'mice',
      bookingId: result.id,
      reason: statusReason.value.trim(),
      penaltyIdr: cancellationPenalty.value ?? undefined,
      cancelledBy: currentUser.value.id,
      refundEligible: cancellationRefundEligible.value
    })
  }
  showToast('Status Diperbarui', `MICE Event kini berstatus "${findStatusOption(MICE_EVENT_STATUSES, targetStatus).label}".`, 'success')
}

/* Client approval transitions */
const isApprovalDialogOpen = ref(false)
const pendingApproval = ref<MiceApprovalStatus | null>(null)
const approvalNote = ref('')

function requestApprovalChange (newStatus: MiceApprovalStatus) {
  if (newStatus === 'rejected') {
    pendingApproval.value = newStatus
    approvalNote.value = ''
    isApprovalDialogOpen.value = true
    return
  }
  if (!event.value) { return }
  updateMiceClientApproval(event.value.id, newStatus, currentUser.value.id)
  showToast('Client Approval Diperbarui', `Status kini "${findStatusOption(MICE_APPROVAL_STATUSES, newStatus).label}".`, 'success')
}

function submitApprovalChange () {
  if (!event.value || !pendingApproval.value || !approvalNote.value.trim()) { return }
  const result = updateMiceClientApproval(event.value.id, pendingApproval.value, currentUser.value.id, approvalNote.value.trim())
  isApprovalDialogOpen.value = false
  if (result) { showToast('Client Approval Diperbarui', `Status kini "${findStatusOption(MICE_APPROVAL_STATUSES, pendingApproval.value).label}".`, 'success') }
}

function submitToggleChecklist (index: number) {
  if (!event.value) { return }
  toggleMiceChecklistItem(event.value.id, index)
}
function submitToggleDeliverable (index: number) {
  if (!event.value) { return }
  toggleMiceDeliverable(event.value.id, index)
}

/* Edit dialog — info dasar + change order + incident. */
const isEditOpen = ref(false)
const editBrief = ref('')
const editVendorId = ref('')
const vendorOptions = computed(() => VENDORS.filter(v => v.serviceType === 'mice' && (v.status ?? 'active') === 'active'))
const editVenueName = ref('')
const editVenueAddress = ref('')
const editHasChangeOrder = ref(false)
const editChangeOrderNote = ref('')
const editHasIncident = ref(false)
const editIncidentNote = ref('')

function openEditDialog () {
  if (!event.value) { return }
  editVendorId.value = (event.value.serviceId ? getProjectServiceById(event.value.serviceId)?.vendorId : undefined) ?? ''
  editBrief.value = event.value.brief ?? ''
  editVenueName.value = event.value.venueName ?? ''
  editVenueAddress.value = event.value.venueAddress ?? ''
  editHasChangeOrder.value = event.value.hasChangeOrder ?? false
  editChangeOrderNote.value = event.value.changeOrderNote ?? ''
  editHasIncident.value = event.value.hasIncident ?? false
  editIncidentNote.value = event.value.incidentNote ?? ''
  isEditOpen.value = true
}

function submitEdit () {
  if (!event.value) { return }
  if (event.value.serviceId) { setServiceVendor(event.value.serviceId, editVendorId.value || undefined) }
  updateMiceEvent(event.value.id, {
    brief: editBrief.value.trim() || undefined,
    venueName: editVenueName.value.trim() || undefined,
    venueAddress: editVenueAddress.value.trim() || undefined,
    hasChangeOrder: editHasChangeOrder.value || undefined,
    changeOrderNote: editChangeOrderNote.value.trim() || undefined,
    hasIncident: editHasIncident.value || undefined,
    incidentNote: editIncidentNote.value.trim() || undefined
  })
  isEditOpen.value = false
  showToast('MICE Event Diperbarui', 'Info dasar berhasil disimpan.', 'success')
}

/* Sessions dialog */
const isSessionsOpen = ref(false)
const editSessions = ref<MiceSession[]>([])
function openSessionsDialog () {
  if (!event.value) { return }
  editSessions.value = event.value.sessions.map(s => ({ ...s }))
  isSessionsOpen.value = true
}
function addSessionRow () {
  editSessions.value.push({ roomName: '', sessionTitle: '', startAt: '', endAt: '', capacity: 0 })
}
function removeSessionRow (index: number) {
  editSessions.value.splice(index, 1)
}
function submitSessions () {
  if (!event.value) { return }
  updateMiceEvent(event.value.id, {
    sessions: editSessions.value.filter(s => s.roomName.trim() && s.sessionTitle.trim() && s.startAt.trim() && s.endAt.trim())
  })
  isSessionsOpen.value = false
  showToast('Sessions Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}

/* Participant categories dialog */
const isParticipantsOpen = ref(false)
const editParticipants = ref<MiceParticipantCategory[]>([])
function openParticipantsDialog () {
  if (!event.value) { return }
  editParticipants.value = event.value.participantCategories.map(p => ({ ...p }))
  isParticipantsOpen.value = true
}
function addParticipantRow () {
  editParticipants.value.push({ category: '', expectedCount: 0 })
}
function removeParticipantRow (index: number) {
  editParticipants.value.splice(index, 1)
}
function submitParticipants () {
  if (!event.value) { return }
  updateMiceEvent(event.value.id, {
    participantCategories: editParticipants.value.filter(p => p.category.trim() && p.expectedCount > 0)
  })
  isParticipantsOpen.value = false
  showToast('Participant Categories Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}

/* BOQ dialog */
const isBoqOpen = ref(false)
const editBoq = ref<MiceBoqItem[]>([])
function openBoqDialog () {
  if (!event.value) { return }
  editBoq.value = event.value.boqItems.map(b => ({ ...b }))
  isBoqOpen.value = true
}
function addBoqRow () {
  editBoq.value.push({ category: 'other', description: '', quantity: 1, unit: '' })
}
function removeBoqRow (index: number) {
  editBoq.value.splice(index, 1)
}
function submitBoq () {
  if (!event.value) { return }
  updateMiceEvent(event.value.id, {
    boqItems: editBoq.value.filter(b => b.description.trim() && b.quantity > 0)
  })
  isBoqOpen.value = false
  showToast('BOQ Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}

/* Staffing dialog */
const isStaffingOpen = ref(false)
const editStaffing = ref<MiceStaffAssignment[]>([])
function openStaffingDialog () {
  if (!event.value) { return }
  editStaffing.value = event.value.staffAssignments.map(s => ({ ...s }))
  isStaffingOpen.value = true
}
function addStaffingRow () {
  editStaffing.value.push({ userId: '', roleLabel: '' })
}
function removeStaffingRow (index: number) {
  editStaffing.value.splice(index, 1)
}
function submitStaffing () {
  if (!event.value) { return }
  updateMiceEvent(event.value.id, {
    staffAssignments: editStaffing.value.filter(s => s.userId.trim() && s.roleLabel.trim())
  })
  isStaffingOpen.value = false
  showToast('Staffing Diperbarui', 'Perubahan berhasil disimpan.', 'success')
}

/* Quick-add checklist item */
const isChecklistAddOpen = ref(false)
const newChecklistTask = ref<MiceChecklistTask>('setup')
const newChecklistLabel = ref('')
function submitAddChecklist () {
  if (!event.value || !newChecklistLabel.value.trim()) { return }
  updateMiceEvent(event.value.id, {
    checklist: [...event.value.checklist, { task: newChecklistTask.value, label: newChecklistLabel.value.trim(), isDone: false }]
  })
  newChecklistLabel.value = ''
  isChecklistAddOpen.value = false
}

/* Quick-add deliverable */
const isDeliverableAddOpen = ref(false)
const newDeliverableLabel = ref('')
function submitAddDeliverable () {
  if (!event.value || !newDeliverableLabel.value.trim()) { return }
  updateMiceEvent(event.value.id, {
    deliverables: [...event.value.deliverables, { label: newDeliverableLabel.value.trim(), isDelivered: false }]
  })
  newDeliverableLabel.value = ''
  isDeliverableAddOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!event">
      <PageHeader title="MICE Event Tidak Ditemukan" :breadcrumb="[{ label: 'MICE', to: '/mice' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="MICE Event tidak ditemukan"
          :description="`MICE Event dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/mice')">
            Kembali ke Daftar MICE
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('mice')" module-label="modul MICE" />

    <template v-else>
      <NuxtLink v-if="project" :to="`/project-orders/${project.id}?tab=itinerary-services`" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft class="h-3.5 w-3.5" />Kembali ke {{ project.name }}
      </NuxtLink>
      <PageHeader :title="event.venueName ?? `MICE Event ${event.id}`" :breadcrumb="[{ label: 'MICE', to: '/mice' }, { label: event.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(MICE_EVENT_STATUSES, event.status).label" :tone="findStatusOption(MICE_EVENT_STATUSES, event.status).tone" />
            <StatusBadge :label="`Client: ${findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).label}`" :tone="findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).tone" />
            <NuxtLink :to="`/mice/${event.id}/rundown-preview`" target="_blank">
              <Button size="sm" variant="outline">
                <Printer class="h-4 w-4 mr-1.5" />Rundown
              </Button>
            </NuxtLink>
            <NuxtLink :to="`/mice/${event.id}/boq-preview`" target="_blank">
              <Button size="sm" variant="outline">
                <ClipboardList class="h-4 w-4 mr-1.5" />BOQ
              </Button>
            </NuxtLink>
            <template v-if="canManageMice">
              <Button size="sm" variant="outline" @click="openEditDialog">
                Edit
              </Button>
              <Button
                v-for="next in getMiceEventStatusTransitions(event.status)"
                :key="next"
                size="sm"
                :variant="next === 'cancelled' ? 'destructive' : 'outline'"
                @click="requestStatusChange(next)"
              >
                {{ findStatusOption(MICE_EVENT_STATUSES, next).label }}
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <div v-if="conflicts.length" class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground flex items-center gap-1.5">
          <AlertTriangle class="h-4 w-4" />Capacity / Schedule Conflict
        </p>
        <ul class="text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
          <li v-for="(conflict, index) in conflicts" :key="index">
            {{ conflict }}
          </li>
        </ul>
      </div>
      <div v-if="event.hasChangeOrder" class="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">
          Change Order
        </p>
        <p class="text-muted-foreground mt-1">
          {{ event.changeOrderNote || 'Terjadi perubahan pasca-approval — detail belum dicatat.' }}
        </p>
      </div>
      <div v-if="event.hasIncident" class="rounded-lg border border-purple-500/40 bg-purple-500/5 px-4 py-3 text-sm">
        <p class="font-semibold text-foreground">
          Incident
        </p>
        <p class="text-muted-foreground mt-1">
          {{ event.incidentNote || 'Terjadi insiden operasional — detail belum dicatat.' }}
        </p>
      </div>

      <SectionCard>
        <p v-if="event.brief" class="text-sm text-foreground mb-4 whitespace-pre-line">
          {{ event.brief }}
        </p>
        <DetailMetadataList :items="summaryMetadata" />
        <template v-if="canManageMice" #actions>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="next in getMiceApprovalTransitions(event.clientApprovalStatus)"
              :key="next"
              size="sm"
              :variant="next === 'rejected' ? 'destructive' : 'outline'"
              @click="requestApprovalChange(next)"
            >
              {{ next === 'submitted' ? 'Ajukan ke Client' : findStatusOption(MICE_APPROVAL_STATUSES, next).label }}
            </Button>
          </div>
        </template>
      </SectionCard>

      <SectionCard title="Rooms / Sessions / Agenda" description="Venue per sesi, jadwal, kapasitas, dan PIC.">
        <template v-if="canManageMice" #actions>
          <Button size="sm" variant="outline" @click="openSessionsDialog">
            Kelola Sessions
          </Button>
        </template>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sesi</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Jadwal</TableHead>
              <TableHead>Kapasitas</TableHead>
              <TableHead>PIC</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(session, index) in event.sessions" :key="index">
              <TableCell class="text-foreground">
                {{ session.sessionTitle }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ session.roomName }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDateTime(session.startAt) }} – {{ formatDateTime(session.endAt) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ session.capacity }} pax
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ userName(session.picUserId) }}
              </TableCell>
              <TableCell><StatusBadge :label="session.isConfirmed ? 'Confirmed' : 'Tentatif'" :tone="session.isConfirmed ? 'success' : 'warning'" /></TableCell>
            </TableRow>
            <TableEmpty v-if="event.sessions.length === 0" :colspan="6">
              Belum ada sesi tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Participant Categories / Attendance" description="Kategori peserta, target, dan realisasi kehadiran.">
        <template v-if="canManageMice" #actions>
          <Button size="sm" variant="outline" @click="openParticipantsDialog">
            Kelola Peserta
          </Button>
        </template>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual (Attendance)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(category, index) in event.participantCategories" :key="index">
              <TableCell class="text-foreground">
                {{ category.category }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ category.expectedCount }} pax
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ category.actualCount !== undefined ? `${category.actualCount} pax` : '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="event.participantCategories.length === 0" :colspan="3">
              Belum ada kategori peserta tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="BOQ (Bill of Quantities)" description="Catering, AV, staging, equipment, booth, dan vendor package.">
        <template v-if="canManageMice" #actions>
          <Button size="sm" variant="outline" @click="openBoqDialog">
            Kelola BOQ
          </Button>
        </template>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead v-if="canViewMiceFinancials">
                Net Cost
              </TableHead>
              <TableHead>Sell Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, index) in event.boqItems" :key="index">
              <TableCell><StatusBadge :label="findStatusOption(MICE_BOQ_CATEGORIES, item.category).label" :tone="findStatusOption(MICE_BOQ_CATEGORIES, item.category).tone" /></TableCell>
              <TableCell class="text-foreground">
                {{ item.description }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ item.quantity }} {{ item.unit }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ vendorName(item.vendorId) }}
              </TableCell>
              <TableCell v-if="canViewMiceFinancials" class="text-foreground">
                {{ item.netCostIdr !== undefined ? formatCurrencyIdr(item.netCostIdr) : '—' }}
              </TableCell>
              <TableCell class="text-foreground">
                {{ item.sellPriceIdr !== undefined ? formatCurrencyIdr(item.sellPriceIdr) : '—' }}
              </TableCell>
            </TableRow>
            <TableEmpty v-if="event.boqItems.length === 0" :colspan="canViewMiceFinancials ? 6 : 5">
              Belum ada baris BOQ tercatat.
            </TableEmpty>
          </TableBody>
        </Table>
        <div class="grid gap-3 sm:grid-cols-3 mt-4">
          <div v-if="canViewMiceFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Total Net Cost (Internal)
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ totals.netCostIdr !== undefined ? formatCurrencyIdr(totals.netCostIdr) : '—' }}
            </p>
          </div>
          <div class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Total Sell Price (Client)
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ totals.sellPriceIdr !== undefined ? formatCurrencyIdr(totals.sellPriceIdr) : '—' }}
            </p>
          </div>
          <div v-if="canViewMiceFinancials" class="rounded-lg border border-border p-3">
            <p class="text-xs text-muted-foreground">
              Margin
            </p>
            <p class="text-lg font-semibold text-foreground">
              {{ totals.marginIdr !== undefined ? formatCurrencyIdr(totals.marginIdr) : '—' }}
            </p>
          </div>
        </div>
        <p v-if="!canViewMiceFinancials" class="mt-2 text-xs text-muted-foreground">
          Net cost internal tidak ditampilkan untuk role ini.
        </p>
      </SectionCard>

      <SectionCard title="Staffing / PIC" description="Penanggung jawab internal per area kerja.">
        <template v-if="canManageMice" #actions>
          <Button size="sm" variant="outline" @click="openStaffingDialog">
            Kelola Staffing
          </Button>
        </template>
        <ul v-if="event.staffAssignments.length" class="divide-y divide-border">
          <li v-for="(staff, index) in event.staffAssignments" :key="index" class="py-2 flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-foreground">{{ userName(staff.userId) }}</span>
            <span class="text-sm text-muted-foreground">{{ staff.roleLabel }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada staffing/PIC ditugaskan" />
      </SectionCard>

      <SectionCard title="Setup / Teardown / Rehearsal / Permit Checklist">
        <template v-if="canManageMice" #actions>
          <Dialog v-model:open="isChecklistAddOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Item
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader><DialogTitle>Tambah Checklist Item</DialogTitle></DialogHeader>
              <div class="space-y-3 py-2">
                <div class="space-y-1.5">
                  <Label for="checklist-task">Tipe</Label>
                  <select id="checklist-task" v-model="newChecklistTask" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                    <option v-for="t in MICE_CHECKLIST_TASKS" :key="t.value" :value="t.value">
                      {{ t.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="checklist-label">Deskripsi</Label>
                  <Input id="checklist-label" v-model="newChecklistLabel" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isChecklistAddOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newChecklistLabel.trim()" @click="submitAddChecklist">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>
        <ul v-if="event.checklist.length" class="divide-y divide-border">
          <li v-for="(item, index) in event.checklist" :key="index" class="py-2 flex items-center gap-3">
            <Checkbox :model-value="item.isDone" :disabled="!canManageMice" @update:model-value="submitToggleChecklist(index)" />
            <StatusBadge :label="findStatusOption(MICE_CHECKLIST_TASKS, item.task).label" :tone="findStatusOption(MICE_CHECKLIST_TASKS, item.task).tone" />
            <span class="text-sm" :class="item.isDone ? 'text-muted-foreground line-through' : 'text-foreground'">{{ item.label }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada checklist item" />
      </SectionCard>

      <SectionCard title="Deliverables">
        <template v-if="canManageMice" #actions>
          <Dialog v-model:open="isDeliverableAddOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                <Plus class="h-4 w-4 mr-1.5" />Tambah Deliverable
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader><DialogTitle>Tambah Deliverable</DialogTitle></DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="deliverable-label">Deskripsi</Label>
                <Input id="deliverable-label" v-model="newDeliverableLabel" placeholder="mis. Laporan attendance" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isDeliverableAddOpen = false">
                  Batal
                </Button>
                <Button :disabled="!newDeliverableLabel.trim()" @click="submitAddDeliverable">
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>
        <ul v-if="event.deliverables.length" class="divide-y divide-border">
          <li v-for="(item, index) in event.deliverables" :key="index" class="py-2 flex items-center gap-3">
            <Checkbox :model-value="item.isDelivered" :disabled="!canManageMice" @update:model-value="submitToggleDeliverable(index)" />
            <span class="text-sm" :class="item.isDelivered ? 'text-muted-foreground line-through' : 'text-foreground'">{{ item.label }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada deliverable tercatat" />
      </SectionCard>

      <!-- Event status change dialog (cancelled — reason wajib) -->
      <Dialog v-model:open="isStatusDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel MICE Event</DialogTitle>
            <DialogDescription>Alasan wajib dicatat untuk transisi ini — akan tersimpan sebagai jejak historis di Activity & Changes project terkait.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="status-reason">Alasan</Label>
              <Input id="status-reason" v-model="statusReason" placeholder="mis. Event dibatalkan klien" />
            </div>
            <div class="space-y-1.5 pt-2 border-t border-border">
              <Label for="status-penalty">Penalty (Rp, opsional)</Label>
              <CurrencyInput id="status-penalty" v-model="cancellationPenalty" placeholder="0" />
            </div>
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox v-model="cancellationRefundEligible" />
              Refund Eligible
            </label>
            <p class="text-xs text-muted-foreground">
              Sebuah Cancellation Record akan otomatis dicatat (Section 19) — dapat ditindaklanjuti dengan Refund Request di modul Changes & Incidents.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isStatusDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!statusReason.trim()" @click="submitStatusChange">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Client approval reject dialog (reason wajib) -->
      <Dialog v-model:open="isApprovalDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Rundown/BOQ (Client)</DialogTitle>
            <DialogDescription>Catatan alasan penolakan client wajib diisi.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="approval-note">Catatan</Label>
            <Input id="approval-note" v-model="approvalNote" placeholder="mis. Client meminta revisi budget catering" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isApprovalDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!approvalNote.trim()" @click="submitApprovalChange">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Edit info dasar dialog -->
      <Dialog v-model:open="isEditOpen">
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit MICE Event</DialogTitle>
            <DialogDescription>Perubahan berlaku langsung — status lifecycle diubah lewat tombol terpisah di header.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="edit-brief">Brief</Label>
              <textarea id="edit-brief" v-model="editBrief" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-venue-name">Venue</Label>
              <Input id="edit-venue-name" v-model="editVenueName" />
            </div>
            <div class="space-y-1.5">
              <Label for="edit-vendor">Vendor</Label>
              <select id="edit-vendor" v-model="editVendorId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">
                  Belum ditentukan
                </option>
                <option v-for="vendor in vendorOptions" :key="vendor.id" :value="vendor.id">
                  {{ vendor.name }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="edit-venue-address">Alamat Venue</Label>
              <Input id="edit-venue-address" v-model="editVenueAddress" />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editHasChangeOrder" />
                Tandai Change Order
              </label>
              <textarea v-if="editHasChangeOrder" v-model="editChangeOrderNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan perubahan pasca-approval" />
            </div>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox v-model="editHasIncident" />
                Tandai Incident
              </label>
              <textarea v-if="editHasIncident" v-model="editIncidentNote" rows="2" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Jelaskan insiden operasional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEditOpen = false">
              Batal
            </Button>
            <Button @click="submitEdit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      <!-- Sessions dialog -->
      <Dialog v-model:open="isSessionsOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola Sessions</DialogTitle>
            <DialogDescription>Rooms/sessions dan agenda/rundown per sesi.</DialogDescription>
          </DialogHeader>
          <div class="space-y-2 py-2">
            <div class="flex items-center justify-between">
              <Label>Sessions</Label>
              <Button size="sm" variant="outline" type="button" @click="addSessionRow">
                <Plus class="h-3.5 w-3.5 mr-1" />Tambah
              </Button>
            </div>
            <div v-for="(session, index) in editSessions" :key="index" class="grid grid-cols-12 gap-2 items-center border-b border-border pb-2">
              <Input v-model="session.sessionTitle" placeholder="Judul Sesi" class="col-span-4 h-8 text-xs" />
              <Input v-model="session.roomName" placeholder="Room" class="col-span-4 h-8 text-xs" />
              <Input v-model.number="session.capacity" type="number" placeholder="Kapasitas" class="col-span-3 h-8 text-xs" />
              <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeSessionRow(index)">
                <Trash2 class="h-4 w-4" />
              </button>
              <Input v-model="session.startAt" type="datetime-local" class="col-span-4 h-8 text-xs" />
              <Input v-model="session.endAt" type="datetime-local" class="col-span-4 h-8 text-xs" />
              <select v-model="session.picUserId" class="col-span-3 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option :value="undefined">
                  PIC (opsional)
                </option>
                <option v-for="user in USERS" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
              <label class="col-span-1 flex items-center justify-center">
                <Checkbox v-model="session.isConfirmed" />
              </label>
            </div>
            <p v-if="editSessions.length === 0" class="text-xs text-muted-foreground">
              Belum ada sesi — klik "Tambah".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isSessionsOpen = false">
              Batal
            </Button>
            <Button @click="submitSessions">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      <!-- Participant categories dialog -->
      <Dialog v-model:open="isParticipantsOpen">
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kelola Participant Categories</DialogTitle>
            <DialogDescription>Kategori peserta, target (expected), dan realisasi kehadiran (actual/attendance).</DialogDescription>
          </DialogHeader>
          <div class="space-y-2 py-2">
            <div class="flex items-center justify-between">
              <Label>Kategori</Label>
              <Button size="sm" variant="outline" type="button" @click="addParticipantRow">
                <Plus class="h-3.5 w-3.5 mr-1" />Tambah
              </Button>
            </div>
            <div v-for="(category, index) in editParticipants" :key="index" class="grid grid-cols-12 gap-2 items-center">
              <Input v-model="category.category" placeholder="Kategori" class="col-span-6 h-8 text-xs" />
              <Input v-model.number="category.expectedCount" type="number" placeholder="Expected" class="col-span-2 h-8 text-xs" />
              <Input v-model.number="category.actualCount" type="number" placeholder="Actual" class="col-span-3 h-8 text-xs" />
              <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeParticipantRow(index)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
            <p v-if="editParticipants.length === 0" class="text-xs text-muted-foreground">
              Belum ada kategori — klik "Tambah".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isParticipantsOpen = false">
              Batal
            </Button>
            <Button @click="submitParticipants">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      <!-- BOQ dialog -->
      <Dialog v-model:open="isBoqOpen">
        <DialogScrollContent class="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kelola BOQ</DialogTitle>
            <DialogDescription>Catering, AV, staging, equipment, booth, dan vendor package.</DialogDescription>
          </DialogHeader>
          <div class="space-y-2 py-2">
            <div class="flex items-center justify-between">
              <Label>Baris BOQ</Label>
              <Button size="sm" variant="outline" type="button" @click="addBoqRow">
                <Plus class="h-3.5 w-3.5 mr-1" />Tambah
              </Button>
            </div>
            <div v-for="(item, index) in editBoq" :key="index" class="grid grid-cols-12 gap-2 items-center border-b border-border pb-2">
              <select v-model="item.category" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="c in MICE_BOQ_CATEGORIES" :key="c.value" :value="c.value">
                  {{ c.label }}
                </option>
              </select>
              <Input v-model="item.description" placeholder="Deskripsi" class="col-span-4 h-8 text-xs" />
              <Input v-model.number="item.quantity" type="number" placeholder="Qty" class="col-span-1 h-8 text-xs" />
              <Input v-model="item.unit" placeholder="Unit" class="col-span-2 h-8 text-xs" />
              <select v-model="item.vendorId" class="col-span-2 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option :value="undefined">
                  Vendor (opsional)
                </option>
                <option v-for="vendor in VENDORS" :key="vendor.id" :value="vendor.id">
                  {{ vendor.name }}
                </option>
              </select>
              <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeBoqRow(index)">
                <Trash2 class="h-4 w-4" />
              </button>
              <CurrencyInput v-model="item.netCostIdr" placeholder="Net Cost (Rp)" class="col-span-6 h-8 text-xs" />
              <CurrencyInput v-model="item.sellPriceIdr" placeholder="Sell Price (Rp)" class="col-span-6 h-8 text-xs" />
            </div>
            <p v-if="editBoq.length === 0" class="text-xs text-muted-foreground">
              Belum ada baris BOQ — klik "Tambah".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isBoqOpen = false">
              Batal
            </Button>
            <Button @click="submitBoq">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      <!-- Staffing dialog -->
      <Dialog v-model:open="isStaffingOpen">
        <DialogScrollContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kelola Staffing / PIC</DialogTitle>
          </DialogHeader>
          <div class="space-y-2 py-2">
            <div class="flex items-center justify-between">
              <Label>Penugasan</Label>
              <Button size="sm" variant="outline" type="button" @click="addStaffingRow">
                <Plus class="h-3.5 w-3.5 mr-1" />Tambah
              </Button>
            </div>
            <div v-for="(staff, index) in editStaffing" :key="index" class="grid grid-cols-12 gap-2 items-center">
              <select v-model="staff.userId" class="col-span-5 appearance-none px-2 py-1.5 text-xs rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="" disabled>
                  Pilih user
                </option>
                <option v-for="user in USERS" :key="user.id" :value="user.id">
                  {{ user.name }}
                </option>
              </select>
              <Input v-model="staff.roleLabel" placeholder="Role/PIC label" class="col-span-6 h-8 text-xs" />
              <button type="button" class="col-span-1 text-muted-foreground hover:text-destructive" @click="removeStaffingRow(index)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
            <p v-if="editStaffing.length === 0" class="text-xs text-muted-foreground">
              Belum ada penugasan — klik "Tambah".
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isStaffingOpen = false">
              Batal
            </Button>
            <Button @click="submitStaffing">
              Simpan
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>
    </template>
  </div>
</template>
