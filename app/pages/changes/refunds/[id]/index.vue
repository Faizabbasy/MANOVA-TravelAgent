<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getRefundRequestById, getRefundRequestStatusTransitions, updateRefundRequestStatus, getProjectById, getUserById, getCancellationRecordById, getInvoicesByProject } from '~/data'
import { REFUND_REQUEST_STATUSES, REFUND_CREDIT_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { RefundRequestStatus } from '~/types/change-incident'

/**
 * Refund Request detail (Section 19, D-076) — partial/full, status lifecycle, credit status mock. `invoiceId`
 * murni referensi read-only (TIDAK PERNAH memutasi `Invoice.status`, Section 20 baru masih PARTIAL — forward
 * dependency eksplisit, `docs/frontend-known-issues.md` bagian 15).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canView, canManage, canApprove } = usePermissions()
const canManageChanges = computed(() => canManage('changes'))
const canApproveRefund = computed(() => canApprove('project'))
const { showToast } = useToast()

const refund = computed(() => getRefundRequestById(String(route.params.id)))
useHead({ title: computed(() => refund.value ? `Refund Request ${refund.value.id}` : 'Refund Request Tidak Ditemukan') })

const project = computed(() => (refund.value ? getProjectById(refund.value.projectId) : undefined))
const cancellation = computed(() => (refund.value?.cancellationId ? getCancellationRecordById(refund.value.cancellationId) : undefined))
const relatedInvoice = computed(() => (refund.value?.invoiceId && project.value ? getInvoicesByProject(project.value.id).find(inv => inv.id === refund.value?.invoiceId) : undefined))

const summaryMetadata = computed(() => {
  if (!refund.value) { return [] }
  return [
    { label: 'Project', value: project.value?.name ?? refund.value.projectId },
    { label: 'Tipe', value: refund.value.type === 'full' ? 'Full' : 'Partial' },
    { label: 'Jumlah', value: formatCurrencyIdr(refund.value.amountIdr) },
    { label: 'Diajukan Oleh', value: getUserById(refund.value.requestedBy)?.name ?? refund.value.requestedBy },
    { label: 'Tanggal Diajukan', value: formatDate(refund.value.requestedAt) }
  ]
})

/* Status transitions — Management/Super Admin (canApprove('project'), pola sama ChangeRequest) untuk approve/reject; Operations/PM (canManage('changes')) untuk under-review/processed. */
const isRejectDialogOpen = ref(false)
const rejectionReason = ref('')

function handleTransition (status: RefundRequestStatus) {
  if (!refund.value) { return }
  if (status === 'rejected') {
    rejectionReason.value = ''
    isRejectDialogOpen.value = true
    return
  }
  const result = updateRefundRequestStatus(refund.value.id, status, currentUser.value.id)
  if (result) { showToast('Status Diperbarui', `Refund Request kini berstatus "${findStatusOption(REFUND_REQUEST_STATUSES, status).label}".`, 'success') }
}

function submitReject () {
  if (!refund.value || !rejectionReason.value.trim()) { return }
  const result = updateRefundRequestStatus(refund.value.id, 'rejected', currentUser.value.id, rejectionReason.value.trim())
  isRejectDialogOpen.value = false
  if (result) { showToast('Refund Request Ditolak', `${result.id} ditolak.`, 'info') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!refund">
      <PageHeader title="Refund Request Tidak Ditemukan" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=refunds' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Refund Request tidak ditemukan" :description="`Refund Request dengan ID '${route.params.id}' tidak ada di data demo saat ini.`">
          <Button @click="router.push('/changes?tab=refunds')">
            Kembali ke Changes & Incidents
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('changes')" module-label="modul Changes & Incidents" />

    <template v-else>
      <PageHeader :title="`Refund Request ${refund.id}`" :breadcrumb="[{ label: 'Changes & Incidents', to: '/changes?tab=refunds' }, { label: refund.id }]">
        <template #actions>
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="findStatusOption(REFUND_REQUEST_STATUSES, refund.status).label" :tone="findStatusOption(REFUND_REQUEST_STATUSES, refund.status).tone" />
            <template v-if="canManageChanges">
              <Button v-if="getRefundRequestStatusTransitions(refund.status).includes('under-review')" size="sm" variant="outline" @click="handleTransition('under-review')">
                Mulai Review
              </Button>
              <Button v-if="getRefundRequestStatusTransitions(refund.status).includes('processed')" size="sm" @click="handleTransition('processed')">
                Proses Refund
              </Button>
            </template>
            <template v-if="canApproveRefund">
              <Button v-if="getRefundRequestStatusTransitions(refund.status).includes('approved')" size="sm" @click="handleTransition('approved')">
                Setujui
              </Button>
              <Button v-if="getRefundRequestStatusTransitions(refund.status).includes('rejected')" size="sm" variant="destructive" @click="handleTransition('rejected')">
                Tolak
              </Button>
            </template>
          </div>
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
      </SectionCard>

      <SectionCard title="Credit Status" description="Field mock self-contained — BUKAN integrasi CreditNote nyata ke Finance (forward dependency Section 20).">
        <StatusBadge :label="findStatusOption(REFUND_CREDIT_STATUSES, refund.creditStatus).label" :tone="findStatusOption(REFUND_CREDIT_STATUSES, refund.creditStatus).tone" />
      </SectionCard>

      <SectionCard title="Cancellation Terkait">
        <NuxtLink v-if="cancellation" :to="`/changes/cancellations/${cancellation.id}`" class="text-sm text-primary hover:underline">
          {{ cancellation.id }} — {{ cancellation.bookingType }} {{ cancellation.bookingId }}
        </NuxtLink>
        <p v-else class="text-sm text-muted-foreground">
          Tidak terkait cancellation tertentu (mis. goodwill refund).
        </p>
      </SectionCard>

      <SectionCard title="Invoice Terkait" description="Referensi read-only — tidak pernah memutasi status Invoice.">
        <p v-if="relatedInvoice" class="text-sm text-foreground">
          {{ relatedInvoice.label }} — {{ formatCurrencyIdr(relatedInvoice.amountIdr) }}
        </p>
        <p v-else class="text-sm text-muted-foreground">
          Tidak ada invoice yang ditautkan.
        </p>
      </SectionCard>

      <SectionCard v-if="refund.rejectionReason" title="Alasan Penolakan">
        <p class="text-sm text-destructive">
          {{ refund.rejectionReason }}
        </p>
      </SectionCard>

      <!-- Reject dialog -->
      <Dialog v-model:open="isRejectDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Refund Request</DialogTitle>
            <DialogDescription>Alasan wajib dicatat.</DialogDescription>
          </DialogHeader>
          <div class="space-y-1.5 py-2">
            <Label for="reject-reason">Alasan</Label>
            <Input id="reject-reason" v-model="rejectionReason" placeholder="mis. Melewati batas waktu kebijakan refund" />
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isRejectDialogOpen = false">
              Batal
            </Button>
            <Button variant="destructive" :disabled="!rejectionReason.trim()" @click="submitReject">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
