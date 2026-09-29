<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Send } from 'lucide-vue-next'
import { matchesAnyRole } from '~/data/rbac'
import {
  getIncidentById, getIncidentStatusTransitions, updateIncidentStatus, escalateIncident, resolveIncident, appendIncidentCommunication,
  getProjectById, getUserById, USERS
} from '~/data'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate, formatDateTime } from '~/utils/format'

/**
 * Incident detail (Section 19, D-076) — severity, owner, escalation, communication log, resolution. Seluruh
 * field di halaman ini bersifat INTERNAL-ONLY (severity/escalation/communication log TIDAK PERNAH tampil di
 * Client Portal — lihat `app/pages/client/project-orders/[id]/index.vue`, hanya status + resolution note).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageChanges = computed(() => canManage('changes'))
const { showToast } = useToast()

const incident = computed(() => getIncidentById(String(route.params.id)))
useHead({ title: computed(() => incident.value ? `Incident ${incident.value.id}` : 'Incident Tidak Ditemukan') })

const project = computed(() => (incident.value ? getProjectById(incident.value.projectId) : undefined))
const bookingDetailHref = computed(() => {
  if (!incident.value?.bookingId || !incident.value.bookingType) { return undefined }
  const prefix: Record<string, string> = { flight: '/ticketing', hotel: '/accommodation', transport: '/transportation', mice: '/mice' }
  return `${prefix[incident.value.bookingType]}/${incident.value.bookingId}`
})

const summaryMetadata = computed(() => {
  if (!incident.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? incident.value.projectId },
    { label: 'Booking Terkait', value: incident.value.bookingId ? `${incident.value.bookingType} ${incident.value.bookingId}` : 'Project-level' },
    { label: 'Owner', value: getUserById(incident.value.ownerId)?.name ?? incident.value.ownerId },
    { label: 'Eskalasi Ke', value: incident.value.escalatedTo ? (getUserById(incident.value.escalatedTo)?.name ?? incident.value.escalatedTo) : '—' }
  ]
})

/* Status transitions */
function handleTransition (status: 'investigating') {
  if (!incident.value) { return }
  const result = updateIncidentStatus(incident.value.id, status, currentUser.value.id)
  if (result) { showToast('Status Diperbarui', `Incident kini berstatus "${findStatusOption(INCIDENT_STATUSES, status).label}".`, 'success') }
}

function handleClose () {
  if (!incident.value) { return }
  const result = updateIncidentStatus(incident.value.id, 'closed', currentUser.value.id)
  if (result) { showToast('Incident Ditutup', `${result.id} kini berstatus "Closed".`, 'success') }
}

/* Escalate */
const isEscalateOpen = ref(false)
const escalateTo = ref('')
const escalateNote = ref('')
const escalationCandidates = computed(() => USERS.filter(u => matchesAnyRole(u.role, ['operations', 'project-manager', 'management', 'super-admin'])))

function openEscalate () {
  escalateTo.value = ''
  escalateNote.value = ''
  isEscalateOpen.value = true
}

function submitEscalate () {
  if (!incident.value || !escalateTo.value) { return }
  const result = escalateIncident(incident.value.id, escalateTo.value, currentUser.value.id, escalateNote.value.trim() || undefined)
  isEscalateOpen.value = false
  if (result) { showToast('Incident Dieskalasi', `${result.id} dieskalasi.`, 'success') }
}

/* Resolve */
const isResolveOpen = ref(false)
const resolutionNote = ref('')

function openResolve () {
  resolutionNote.value = ''
  isResolveOpen.value = true
}

function submitResolve () {
  if (!incident.value || !resolutionNote.value.trim()) { return }
  const result = resolveIncident(incident.value.id, resolutionNote.value.trim(), currentUser.value.id)
  isResolveOpen.value = false
  if (result) { showToast('Incident Diselesaikan', `${result.id} kini berstatus "Resolved".`, 'success') }
}

/* Communication log */
const communicationMessage = ref('')

function submitCommunication () {
  if (!incident.value || !communicationMessage.value.trim()) { return }
  appendIncidentCommunication(incident.value.id, currentUser.value.id, communicationMessage.value.trim())
  communicationMessage.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!incident">
      <PageHeader title="Incident Tidak Ditemukan" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=incidents' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Incident tidak ditemukan" :description="`Incident dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/changes?tab=incidents')">
            Kembali ke Changes & Incidents
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <PageHeader :title="`Incident ${incident.id}`" :description="incident.title" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=incidents' }, { label: incident.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(INCIDENT_SEVERITIES, incident.severity).label" :tone="findStatusOption(INCIDENT_SEVERITIES, incident.severity).tone" />
            <StatusBadge :label="findStatusOption(INCIDENT_STATUSES, incident.status).label" :tone="findStatusOption(INCIDENT_STATUSES, incident.status).tone" />
            <NuxtLink v-if="bookingDetailHref" :to="bookingDetailHref">
              <Button size="sm" variant="outline">
                Lihat Booking
              </Button>
            </NuxtLink>
            <template v-if="canManageChanges">
              <Button v-if="getIncidentStatusTransitions(incident.status).includes('investigating')" size="sm" variant="outline" @click="handleTransition('investigating')">
                Mulai Investigasi
              </Button>
              <Button v-if="getIncidentStatusTransitions(incident.status).includes('escalated')" size="sm" variant="destructive" @click="openEscalate">
                Eskalasi
              </Button>
              <Button v-if="getIncidentStatusTransitions(incident.status).includes('resolved')" size="sm" @click="openResolve">
                Selesaikan
              </Button>
              <Button v-if="getIncidentStatusTransitions(incident.status).includes('closed')" size="sm" variant="outline" @click="handleClose">
                Tutup
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Deskripsi">
        <p class="text-sm text-foreground whitespace-pre-line">
          {{ incident.description }}
        </p>
      </SectionCard>

      <SectionCard v-if="incident.resolutionNote" title="Resolusi">
        <p class="text-sm text-foreground whitespace-pre-line">
          {{ incident.resolutionNote }}
        </p>
        <p v-if="incident.resolvedAt" class="text-xs text-muted-foreground mt-1">
          Diselesaikan: {{ formatDate(incident.resolvedAt) }}
        </p>
      </SectionCard>

      <SectionCard title="Communication Log">
        <ul v-if="incident.communicationLog.length" class="space-y-3 mb-4">
          <li v-for="entry in incident.communicationLog" :key="entry.id" class="rounded-lg border border-border p-3">
            <div class="flex items-center justify-between gap-3 mb-1">
              <p class="text-sm font-medium text-foreground">
                {{ getUserById(entry.from)?.name ?? entry.from }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatDateTime(entry.at) }}
              </p>
            </div>
            <p class="text-sm text-muted-foreground">
              {{ entry.message }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada komunikasi tercatat" />
        <div v-if="canManageChanges" class="flex items-center gap-2 pt-2 border-t border-border mt-4">
          <Input v-model="communicationMessage" placeholder="Tulis update komunikasi..." class="flex-1" />
          <Button size="sm" :disabled="!communicationMessage.trim()" @click="submitCommunication">
            <Send class="h-4 w-4 mr-1.5" />Kirim
          </Button>
        </div>
      </SectionCard>

      <!-- Escalate dialog -->
      <Dialog v-model:open="isEscalateOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Eskalasi Incident</DialogTitle>
            <DialogDescription>Incident akan ditandai "Escalated" dan dicatat sebagai entri Communication Log.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="escalate-to">Eskalasi Ke</Label>
              <select id="escalate-to" v-model="escalateTo" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="" disabled>
                  Pilih penerima eskalasi
                </option>
                <option v-for="user in escalationCandidates" :key="user.id" :value="user.id">
                  {{ user.name }} ({{ user.role }})
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="escalate-note">Catatan (opsional)</Label>
              <Input id="escalate-note" v-model="escalateNote" placeholder="mis. Butuh keputusan segera dari Operations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isEscalateOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!escalateTo" @click="submitEscalate">
              Eskalasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Resolve dialog -->
      <Dialog v-model:open="isResolveOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Selesaikan Incident</DialogTitle>
            <DialogDescription>Resolution note wajib diisi.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="resolution-note">Resolution Note</Label>
            <textarea id="resolution-note" v-model="resolutionNote" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isResolveOpen = false">
              Batal
            </Button>
            <Button :disabled="!resolutionNote.trim()" @click="submitResolve">
              Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
