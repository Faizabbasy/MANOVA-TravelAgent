<script setup lang="ts">
import { FileX } from 'lucide-vue-next'
import { travelRequestActions } from '~/lib/travel-requests'
import { createSaveGate } from '~/lib/save-gate'
import { isApiError } from '~/lib/api/errors'
import { SERVICE_TYPES, TRAVEL_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'
import type { TravelRequestDto } from '~/types/api'

/**
 * S12c-3: satu travel request di sisi sales — mulai tinjau, minta klarifikasi (client diberi tahu), jadikan Lead
 * (sumber client-portal; qualify & quotation lewat alur Lead biasa), atau tutup dengan alasan. Semua lewat server.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const api = useApi()
const session = useServerSession()
const { canView, can } = usePermissions()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

const canManage = computed(() => can('sales.manage-lead'))
const dto = ref<TravelRequestDto | null>(null)
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const loadError = ref('')
const actions = computed(() => (dto.value && canManage.value ? travelRequestActions(dto.value.status) : undefined))
useHead({ title: computed(() => dto.value?.requestName ?? 'Travel Request') })

async function load () {
  if (!canView('sales')) { return }
  try {
    await session.ensure()
    dto.value = (await api.core.getTravelRequest(String(route.params.id))).data
    status.value = 'ready'
  } catch (error) {
    if (isApiError(error) && error.status === 404) { status.value = 'missing'; return }
    loadError.value = isApiError(error) ? error.message : 'Server belum bisa dihubungi.'
    status.value = 'error'
  }
}
onMounted(load)

async function act (title: string, action: (id: string) => Promise<{ data: TravelRequestDto }>, success: string) {
  if (!dto.value) { return false }
  const id = dto.value.id
  const saved = await gate.run(title, async () => (await action(id)).data)
  if (!saved) { return false }
  dto.value = saved
  showToast('Tersimpan', success, 'success')
  return true
}
const review = () => act('Gagal Memulai Tinjauan', id => api.core.reviewTravelRequest(id), 'Travel request sedang Anda tinjau.')
const convert = () => act('Gagal Menjadikan Lead', id => api.core.convertTravelRequest(id), 'Lead dibuat — lanjutkan qualify & quotation dari halaman Leads.')

const dialog = ref<'clarify' | 'close' | null>(null)
const note = ref('')
const isDialogOpen = computed({ get: () => dialog.value !== null, set: (open) => { if (!open) { dialog.value = null } } })
function openDialog (kind: 'clarify' | 'close') { note.value = ''; dialog.value = kind }
async function submitDialog () {
  const text = note.value.trim()
  if (!text || !dialog.value) { return }
  const done = dialog.value === 'clarify'
    ? await act('Klarifikasi Gagal Dikirim', id => api.core.clarifyTravelRequest(id, text), 'Pertanyaan terkirim ke client.')
    : await act('Gagal Menutup', id => api.core.closeTravelRequest(id, text), 'Travel request ditutup — client diberi tahu.')
  if (done) { dialog.value = null }
}

const services = computed(() => SERVICE_TYPES.filter(type => dto.value?.serviceScope.includes(type.value)).map(type => type.label).join(', ') || '—')
const requirementRows = computed(() => {
  if (!dto.value) { return [] }
  const pairs: [string, Record<string, unknown> | null | undefined][] = [
    ['Flight', dto.value.flightRequirement], ['Hotel', dto.value.hotelRequirement], ['Transportasi', dto.value.transportationRequirement], ['MICE', dto.value.miceRequirement]
  ]
  return pairs.filter(([, v]) => v && Object.keys(v).length).map(([label, v]) => ({ label, value: Object.values(v!).filter(Boolean).join(' · ') }))
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('sales')" module-label="Sales" />

    <div v-else-if="status === 'loading'" class="h-40 animate-pulse rounded-xl bg-muted" />

    <template v-else-if="status !== 'ready' || !dto">
      <PageHeader title="Travel Request" :breadcrumb="[{ label: 'Travel Request', to: '/travel-requests' }, { label: String(route.params.id) }]" />
      <SectionCard>
        <EmptyState :icon="FileX" :title="status === 'missing' ? 'Travel request tidak ditemukan' : 'Travel request belum bisa dimuat'" :description="status === 'missing' ? 'Permintaan ini tidak ada atau masih draft client.' : loadError">
          <Button variant="outline" @click="navigateTo('/travel-requests')">
            Kembali
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <template v-else>
      <PageHeader :title="dto.requestName" :breadcrumb="[{ label: 'Travel Request', to: '/travel-requests' }, { label: dto.id }]">
        <template #actions>
          <StatusBadge :label="findStatusOption(TRAVEL_REQUEST_STATUSES, dto.status).label" :tone="findStatusOption(TRAVEL_REQUEST_STATUSES, dto.status).tone" />
        </template>
      </PageHeader>

      <SectionCard title="Permintaan">
        <DetailMetadataList
          :items="[
            { label: 'Customer', value: dto.partyName },
            { label: 'Destinasi', value: dto.destination || '—' },
            { label: 'Tanggal', value: dto.travelStartDate ? (dto.travelEndDate ? `${formatDate(dto.travelStartDate)} – ${formatDate(dto.travelEndDate)}` : formatDate(dto.travelStartDate)) : (dto.dateFlexible ? 'Fleksibel' : '—') },
            { label: 'Peserta', value: dto.estimatedParticipants ? String(dto.estimatedParticipants) : '—' },
            { label: 'Estimasi Budget', value: dto.estimatedBudgetIdr !== null ? formatCurrencyIdr(dto.estimatedBudgetIdr) : '—' },
            { label: 'Layanan', value: services },
            { label: 'Tujuan', value: dto.purpose ?? '—' },
            { label: 'Ditinjau oleh', value: dto.reviewerName ?? '—' },
            ...requirementRows,
            ...(dto.additionalServicesNote ? [{ label: 'Catatan Tambahan', value: dto.additionalServicesNote }] : []),
            ...(dto.leadId ? [{ label: 'Lead', value: dto.leadId }] : []),
            ...(dto.clarificationNote ? [{ label: 'Klarifikasi terakhir', value: dto.clarificationNote }] : []),
            ...(dto.cancelReason ? [{ label: 'Alasan batal (client)', value: dto.cancelReason }] : []),
            ...(dto.closeReason ? [{ label: 'Alasan ditutup', value: dto.closeReason }] : [])
          ]"
        />
        <NuxtLink v-if="dto.leadId" to="/sales/pipeline" class="text-sm text-primary hover:underline inline-block mt-3">
          Buka Leads →
        </NuxtLink>
      </SectionCard>

      <SectionCard v-if="actions && (actions.review || actions.clarify || actions.convert || actions.close)" title="Tindakan">
        <div class="flex flex-wrap gap-2">
          <Button v-if="actions.review" size="sm" variant="outline" :disabled="gate.saving.value" @click="review">
            Mulai Tinjau
          </Button>
          <Button v-if="actions.clarify" size="sm" variant="outline" :disabled="gate.saving.value" @click="openDialog('clarify')">
            Minta Klarifikasi
          </Button>
          <Button v-if="actions.convert" size="sm" :disabled="gate.saving.value" @click="convert">
            Jadikan Lead
          </Button>
          <Button v-if="actions.close" size="sm" variant="outline" :disabled="gate.saving.value" @click="openDialog('close')">
            Tutup
          </Button>
        </div>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EntityComments entity-type="travel-request" :entity-id="dto.id" title="Komentar dengan Client" />
        <EntityAttachments entity-type="travel-request" :entity-id="dto.id" />
      </div>

      <SectionCard title="Riwayat">
        <ul v-if="dto.activities.length" class="divide-y divide-border">
          <li v-for="a in dto.activities" :key="a.id" class="py-2">
            <p class="text-sm text-foreground">
              {{ a.message }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ a.actorName }}{{ a.fromClient ? ' (client)' : '' }} · {{ formatDateTime(a.createdAt) }}
            </p>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada riwayat" />
      </SectionCard>

      <ResponsiveFormSheet
        v-model:open="isDialogOpen"
        :title="dialog === 'close' ? 'Tutup Travel Request' : 'Minta Klarifikasi'"
        :description="dialog === 'close' ? 'Alasan dikirim ke client.' : 'Pertanyaan dikirim ke client; status menjadi menunggu klarifikasi.'"
        content-class="max-w-md"
      >
        <div class="space-y-1.5 py-2">
          <Label for="trq-note">{{ dialog === 'close' ? 'Alasan' : 'Pertanyaan' }}</Label>
          <textarea id="trq-note" v-model="note" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <template #footer>
          <Button variant="outline" @click="dialog = null">
            Batal
          </Button>
          <Button :disabled="gate.saving.value || !note.trim()" @click="submitDialog">
            Kirim
          </Button>
        </template>
      </ResponsiveFormSheet>
    </template>
  </div>
</template>
