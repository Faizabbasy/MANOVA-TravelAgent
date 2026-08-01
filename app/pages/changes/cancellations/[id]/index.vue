<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import { getCancellationRecordById, getProjectById, getUserById, getRefundRequestsByProject, createRefundRequest } from '~/data'
import { REFUND_REQUEST_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'

/**
 * Cancellation Record detail (Section 19, D-076) — read-only setelah dibuat (immutable, dibuat aditif dari
 * hook UI-level di halaman detail booking Ticketing/Accommodation/Transportation/MICE, TIDAK punya status
 * lifecycle sendiri). Aksi utama di halaman ini: mengajukan Refund Request yang menautkan `cancellationId`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage } = usePermissions()
const canManageChanges = computed(() => canManage('changes'))
const { showToast } = useToast()

const record = computed(() => getCancellationRecordById(String(route.params.id)))
useHead({ title: computed(() => record.value ? `Cancellation ${record.value.id}` : 'Cancellation Tidak Ditemukan') })

const project = computed(() => (record.value ? getProjectById(record.value.projectId) : undefined))
const relatedRefunds = computed(() => (record.value ? getRefundRequestsByProject(record.value.projectId).filter(r => r.cancellationId === record.value?.id) : []))

const summaryMetadata = computed(() => {
  if (!record.value) return []
  return [
    { label: 'Project', value: project.value?.name ?? record.value.projectId },
    { label: 'Booking', value: `${record.value.bookingType} ${record.value.bookingId}` },
    { label: 'Dibatalkan Oleh', value: getUserById(record.value.cancelledBy)?.name ?? record.value.cancelledBy },
    { label: 'Tanggal Dibatalkan', value: formatDate(record.value.cancelledAt) },
    { label: 'Penalty', value: record.value.penaltyIdr !== undefined ? formatCurrencyIdr(record.value.penaltyIdr) : 'Tidak ada penalty' },
  ]
})

const bookingDetailHref = computed(() => {
  if (!record.value) return undefined
  const prefix: Record<string, string> = { flight: '/ticketing', hotel: '/accommodation', transport: '/transportation', mice: '/mice' }
  return `${prefix[record.value.bookingType]}/${record.value.bookingId}`
})

/* Ajukan Refund dari Cancellation ini */
const isRefundDialogOpen = ref(false)
const refundType = ref<'partial' | 'full'>('partial')
const refundAmount = ref<number | null>(null)

function openRefundDialog() {
  refundType.value = 'partial'
  refundAmount.value = null
  isRefundDialogOpen.value = true
}

function submitRefund() {
  if (!record.value || !refundAmount.value) return
  const refund = createRefundRequest({
    projectId: record.value.projectId, cancellationId: record.value.id,
    type: refundType.value, amountIdr: refundAmount.value, requestedBy: currentUser.value.id,
  })
  isRefundDialogOpen.value = false
  showToast('Refund Request Diajukan', `${refund.id} tercatat berstatus "Diajukan".`, 'success')
  navigateTo(`/changes/refunds/${refund.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!record">
      <PageHeader title="Cancellation Tidak Ditemukan" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=cancellations' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Cancellation tidak ditemukan" :description="`Cancellation dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/changes?tab=cancellations')">Kembali ke Changes & Incidents</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <PageHeader :title="`Cancellation ${record.id}`" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=cancellations' }, { label: record.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="record.refundEligible ? 'Refund Eligible' : 'Tidak Eligible'" :tone="record.refundEligible ? 'success' : 'neutral'" />
            <NuxtLink v-if="bookingDetailHref" :to="bookingDetailHref">
              <Button size="sm" variant="outline">Lihat Booking</Button>
            </NuxtLink>
            <Button v-if="canManageChanges && record.refundEligible" size="sm" @click="openRefundDialog"><Plus class="h-4 w-4 mr-1.5" />Ajukan Refund</Button>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Alasan Pembatalan">
        <p class="text-sm text-foreground whitespace-pre-line">{{ record.reason }}</p>
      </SectionCard>

      <SectionCard title="Refund Request Terkait">
        <ul v-if="relatedRefunds.length" class="divide-y divide-border">
          <li v-for="refund in relatedRefunds" :key="refund.id" class="py-3">
            <NuxtLink :to="`/changes/refunds/${refund.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground group-hover:underline">{{ refund.id }}</p>
                <p class="text-xs text-muted-foreground">{{ refund.type === 'full' ? 'Full' : 'Partial' }} — {{ formatCurrencyIdr(refund.amountIdr) }}</p>
              </div>
              <StatusBadge :label="findStatusOption(REFUND_REQUEST_STATUSES, refund.status).label" :tone="findStatusOption(REFUND_REQUEST_STATUSES, refund.status).tone" />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada Refund Request" description="Ajukan Refund Request bila cancellation ini eligible untuk pengembalian dana." />
      </SectionCard>

      <!-- Ajukan Refund dialog -->
      <Dialog v-model:open="isRefundDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajukan Refund Request</DialogTitle>
            <DialogDescription>Menautkan Cancellation {{ record.id }} — self-contained mock, tidak mengubah Invoice/Payment.</DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label for="refund-type">Tipe</Label>
                <select id="refund-type" v-model="refundType" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="partial">Partial</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div class="space-y-1.5">
                <Label for="refund-amount">Jumlah (Rp)</Label>
                <Input id="refund-amount" v-model.number="refundAmount" type="number" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isRefundDialogOpen = false">Batal</Button>
            <Button :disabled="!refundAmount" @click="submitRefund">Kirim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
