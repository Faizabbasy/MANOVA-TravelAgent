<script setup lang="ts">
import { AlertTriangle, Inbox, LifeBuoy, Search, UserCheck, UserX } from 'lucide-vue-next'
import { getSupportTicketSlaDueDate, isSupportTicketSlaBreached } from '~/data'
import { ticketFromServer } from '~/data/support-sync'
import { inboxSummary, isOpenTicket } from '~/lib/support'
import { isApiError } from '~/lib/api/errors'
import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import type { SupportTicketDto } from '~/types/api'

/**
 * S12c-2: inbox tiket support dari portal client. Tiket terkait project ditangani owner project-nya; tiket tanpa
 * project masuk antrean dan bisa ditugaskan Admin. Halaman memuat datanya sendiri dari server (`GET /support-tickets`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Tiket Support' })

const api = useApi()
const session = useServerSession()
const { can } = usePermissions()
const { currentUser } = useCurrentUser()

const canManage = computed(() => can('support.manage-ticket'))
const tickets = ref<SupportTicketDto[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const loadError = ref('')

async function load () {
  if (!canManage.value) { return }
  status.value = 'loading'
  try {
    await session.ensure()
    tickets.value = (await api.core.listSupportTickets()).data
    status.value = 'ready'
  } catch (error) {
    loadError.value = isApiError(error) ? error.message : 'Server belum bisa dihubungi.'
    status.value = 'error'
  }
}
onMounted(load)

const rows = computed(() => tickets.value.map(dto => ({ dto, ticket: ticketFromServer(dto) })))
const summary = computed(() => inboxSummary(rows.value.map(row => row.ticket), currentUser.value.id))

const view = ref<'open' | 'mine' | 'unassigned' | 'all'>('open')
const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value
    .filter(({ ticket }) => {
      if (view.value === 'open') { return isOpenTicket(ticket.status) }
      if (view.value === 'mine') { return isOpenTicket(ticket.status) && ticket.assignedTo === currentUser.value.id }
      if (view.value === 'unassigned') { return isOpenTicket(ticket.status) && !ticket.assignedTo }
      return true
    })
    .filter(({ dto }) => !q || [dto.subject, dto.id, dto.partyName, dto.projectName ?? ''].some(text => text.toLowerCase().includes(q)))
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Tiket Support"
      description="Permintaan bantuan dari portal client — tugaskan, balas, dan selesaikan."
      :breadcrumb="[{ label: 'Customer' }, { label: 'Tiket Support' }]"
    />

    <RoleAccessState v-if="!canManage" module-label="Tiket Support" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Terbuka" :value="String(summary.open)" :icon="Inbox" />
        <StatsCard title="Ditangani Saya" :value="String(summary.mine)" :icon="UserCheck" />
        <StatsCard title="Belum Ditugaskan" :value="String(summary.unassigned)" :icon="UserX" :icon-color="summary.unassigned ? 'warning' : 'success'" />
        <StatsCard title="Menunggu Konfirmasi Client" :value="String(summary.resolved)" :icon="LifeBuoy" />
      </div>

      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 flex-wrap">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari subjek, customer, project..." class="pl-9" />
          </div>
          <select v-model="view" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="open">
              Semua yang terbuka
            </option>
            <option value="mine">
              Ditangani saya
            </option>
            <option value="unassigned">
              Antrean (belum ditugaskan)
            </option>
            <option value="all">
              Semua termasuk selesai
            </option>
          </select>
        </div>

        <div v-if="status === 'loading' || status === 'idle'" class="h-24 animate-pulse rounded-xl bg-muted" />
        <EmptyState v-else-if="status === 'error'" :icon="LifeBuoy" title="Tiket belum bisa dimuat" :description="loadError">
          <Button variant="outline" @click="load">
            Coba lagi
          </Button>
        </EmptyState>
        <ul v-else-if="filtered.length" class="divide-y divide-border">
          <li v-for="{ dto, ticket } in filtered" :key="dto.id">
            <NuxtLink :to="`/support/${dto.id}`" :class="['py-3 flex items-center justify-between gap-3 group rounded-lg', ticket.category === 'emergency' && 'bg-destructive/5 -mx-3 px-3 border-l-2 border-destructive']">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <AlertTriangle v-if="ticket.category === 'emergency'" class="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                    {{ dto.subject }}
                  </p>
                </div>
                <p class="text-xs text-muted-foreground truncate">
                  {{ dto.id }} · {{ dto.partyName }} · {{ dto.projectName ?? 'Tanpa project' }} · {{ findStatusOption(SUPPORT_TICKET_CATEGORIES, ticket.category).label }} · {{ formatDate(dto.createdAt) }}
                  · {{ dto.assignedToName ?? 'Antrean' }}
                  <template v-if="isOpenTicket(ticket.status) && isSupportTicketSlaBreached(ticket)">
                    · <span class="text-destructive font-medium">SLA terlewati (target {{ formatDate(getSupportTicketSlaDueDate(ticket)) }})</span>
                  </template>
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <StatusBadge :label="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).label" :tone="findStatusOption(SUPPORT_TICKET_PRIORITIES, ticket.priority).tone" />
                <StatusBadge :label="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).label" :tone="findStatusOption(SUPPORT_TICKET_STATUSES, ticket.status).tone" />
              </div>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="LifeBuoy" title="Tidak ada tiket" description="Tidak ada tiket yang cocok dengan filter ini." />
      </SectionCard>
    </template>
  </div>
</template>
