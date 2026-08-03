<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getProjectById, getPaymentsByInvoice, getCreditNotesByInvoice,
  getInvoiceOutstandingIdr, markInvoiceViewed, submitPaymentProof, raiseInvoiceDispute, runPaymentVerificationMock,
  INVOICES
} from '~/data'
import { INVOICE_STATUSES, INVOICE_TYPES, CREDIT_NOTE_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import { isInvoiceOverdue, isInvoiceDueSoon } from '~/utils/attention'

/**
 * Finance & Billing — Invoice Detail (Repair Phase Section 6, Master Prompt bagian A). Payment
 * schedule/history reuse `getPaymentsByInvoice`/`Invoice.dueAt` (existing, Section 20, LOCKED). "Download
 * Tax Invoice"/"Download Receipt" SENGAJA mengarah ke halaman print yang SAMA (`/preview`) — dokumen mock
 * tunggal yang mencakup breakdown invoice + riwayat pembayaran (bukan generator dokumen ganda).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const invoice = computed(() => INVOICES.find(item => item.id === String(route.params.id)))
const project = computed(() => (invoice.value ? getProjectById(invoice.value.projectId) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => invoice.value ? invoice.value.label : 'Tidak Ditemukan') })

onMounted(() => {
  if (!invoice.value || !isOwnCompany.value) { return }
  if (invoice.value.status === 'waiting-verification') { runPaymentVerificationMock(invoice.value.id) }
  markInvoiceViewed(invoice.value.id)
})

const payments = computed(() => (invoice.value ? getPaymentsByInvoice(invoice.value.id) : []))
const creditNotes = computed(() => (invoice.value ? getCreditNotesByInvoice(invoice.value.id) : []))
const outstanding = computed(() => (invoice.value ? getInvoiceOutstandingIdr(invoice.value.id) : 0))

const canUploadProof = computed(() => invoice.value && (invoice.value.status === 'unpaid' || invoice.value.status === 'partially-paid'))
const canDispute = computed(() => invoice.value && invoice.value.status !== 'paid' && invoice.value.status !== 'void')

/* --- Upload payment proof --- */
const isProofOpen = ref(false)
const proofReference = ref('')
const proofAmount = ref(0)
const proofNote = ref('')
function openProofDialog () {
  proofReference.value = ''
  proofAmount.value = outstanding.value
  proofNote.value = ''
  isProofOpen.value = true
}
function submitProof () {
  if (!invoice.value || !proofReference.value.trim() || proofAmount.value <= 0) { return }
  const result = submitPaymentProof({ invoiceId: invoice.value.id, submittedBy: currentUser.value.id, reference: proofReference.value.trim(), amountIdr: proofAmount.value, note: proofNote.value.trim() || undefined })
  isProofOpen.value = false
  if (result) { showToast('Bukti Pembayaran Terkirim', 'Tim Finance kami akan memverifikasi dalam waktu dekat.', 'success') }
}

/* --- Raise dispute --- */
const isDisputeOpen = ref(false)
const disputeReason = ref('')
function submitDispute () {
  if (!invoice.value || !disputeReason.value.trim()) { return }
  const result = raiseInvoiceDispute(invoice.value.id, currentUser.value.id, disputeReason.value.trim())
  disputeReason.value = ''
  isDisputeOpen.value = false
  if (result) { showToast('Dispute Diajukan', 'Tim Finance kami akan meninjau invoice ini.', 'info') }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!invoice || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Invoice tidak ditemukan" description="Invoice ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/billing')">
            Kembali ke Finance & Billing
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="invoice.label"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Finance & Billing', to: '/client/billing' }, { label: invoice.id }]"
      >
        <template #actions>
          <StatusBadge
            :label="isInvoiceOverdue(invoice) ? `Overdue — ${findStatusOption(INVOICE_STATUSES, invoice.status).label}` : findStatusOption(INVOICE_STATUSES, invoice.status).label"
            :tone="isInvoiceOverdue(invoice) ? 'destructive' : findStatusOption(INVOICE_STATUSES, invoice.status).tone"
          />
          <NuxtLink :to="`/client/billing/invoices/${invoice.id}/preview`" target="_blank">
            <Button size="sm" variant="outline">
              Download Tax Invoice / Receipt
            </Button>
          </NuxtLink>
        </template>
      </PageHeader>

      <SectionCard title="Ringkasan">
        <DetailMetadataList
          :items="[
            { label: 'Project', value: project?.name ?? invoice.projectId },
            { label: 'Tipe', value: findStatusOption(INVOICE_TYPES, invoice.invoiceType).label },
            { label: 'Tanggal Terbit', value: formatDate(invoice.issuedAt) },
            { label: 'Jatuh Tempo', value: formatDate(invoice.dueAt) },
            { label: 'Jumlah', value: formatCurrencyIdr(invoice.amountIdr) },
            { label: 'Outstanding', value: formatCurrencyIdr(outstanding) },
          ]"
        />
        <p v-if="isInvoiceDueSoon(invoice)" class="text-xs text-warning mt-3">
          Invoice ini akan jatuh tempo dalam waktu dekat.
        </p>
      </SectionCard>

      <SectionCard v-if="invoice.status === 'waiting-verification'" title="Bukti Pembayaran">
        <DetailMetadataList
          :items="[
            { label: 'Referensi', value: invoice.paymentProofReference ?? '—' },
            { label: 'Jumlah Dilaporkan', value: formatCurrencyIdr(invoice.paymentProofAmountIdr ?? 0) },
            { label: 'Diunggah', value: invoice.paymentProofUploadedAt ? formatDate(invoice.paymentProofUploadedAt) : '—' },
          ]"
        />
        <p class="text-sm text-muted-foreground mt-2">
          Menunggu verifikasi tim Finance kami.
        </p>
      </SectionCard>

      <SectionCard v-if="invoice.status === 'disputed'" title="Dispute">
        <p class="text-sm text-foreground">
          {{ invoice.disputeReason }}
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          Diajukan {{ invoice.disputedAt ? formatDate(invoice.disputedAt) : '—' }} — tim Finance kami akan meninjau dan menghubungi Anda.
        </p>
      </SectionCard>

      <SectionCard v-if="canUploadProof || canDispute" title="Aksi">
        <div class="flex flex-wrap gap-2">
          <Dialog v-if="canUploadProof" v-model:open="isProofOpen">
            <DialogTrigger as-child>
              <Button size="sm" @click="openProofDialog">
                Upload Payment Proof
              </Button>
            </DialogTrigger>
            <DialogScrollContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Payment Proof</DialogTitle>
                <DialogDescription>Mock upload — tidak ada file storage nyata, hanya metadata tercatat.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="proof-reference">Nomor Referensi Transfer</Label>
                  <Input id="proof-reference" v-model="proofReference" placeholder="mis. TRF20260801XYZ" />
                </div>
                <div class="space-y-1.5">
                  <Label for="proof-amount">Jumlah Ditransfer (IDR)</Label>
                  <Input id="proof-amount" v-model.number="proofAmount" type="number" min="1" :max="outstanding" />
                </div>
                <div class="space-y-1.5">
                  <Label for="proof-note">Catatan (opsional)</Label>
                  <Input id="proof-note" v-model="proofNote" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isProofOpen = false">
                  Batal
                </Button>
                <Button :disabled="!proofReference.trim() || proofAmount <= 0" @click="submitProof">
                  Kirim Konfirmasi Pembayaran
                </Button>
              </DialogFooter>
            </DialogScrollContent>
          </Dialog>
          <Dialog v-if="canDispute" v-model:open="isDisputeOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline">
                Raise Dispute
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Raise Dispute</DialogTitle>
                <DialogDescription>Alasan wajib diisi.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="dispute-reason">Alasan</Label>
                <Input id="dispute-reason" v-model="disputeReason" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isDisputeOpen = false">
                  Batal
                </Button>
                <Button variant="destructive" :disabled="!disputeReason.trim()" @click="submitDispute">
                  Ajukan Dispute
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCard>

      <SectionCard title="Payment Schedule &amp; History">
        <DetailMetadataList :items="[{ label: 'Jatuh Tempo', value: formatDate(invoice.dueAt) }]" />
        <ul v-if="payments.length" class="divide-y divide-border mt-3">
          <li v-for="payment in payments" :key="payment.id" class="py-2 flex items-center justify-between gap-3">
            <span class="text-sm text-foreground">{{ formatCurrencyIdr(payment.amountIdr) }}</span>
            <span class="text-xs text-muted-foreground">{{ payment.method ?? '—' }} · {{ formatDate(payment.receivedAt) }}</span>
          </li>
        </ul>
        <EmptyState v-else title="Belum ada pembayaran tercatat" />
      </SectionCard>

      <SectionCard v-if="creditNotes.length" title="Credit Note">
        <ul class="divide-y divide-border">
          <li v-for="note in creditNotes" :key="note.id" class="py-2 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-foreground">
                {{ formatCurrencyIdr(note.amountIdr) }} — {{ note.reason }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(note.issuedAt) }}
              </p>
            </div>
            <StatusBadge :label="findStatusOption(CREDIT_NOTE_STATUSES, note.status).label" :tone="findStatusOption(CREDIT_NOTE_STATUSES, note.status).tone" />
          </li>
        </ul>
      </SectionCard>
    </template>
  </div>
</template>
