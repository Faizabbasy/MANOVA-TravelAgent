<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getProjectById, getPaymentsByInvoice, getCreditNotesByInvoice,
  getInvoiceOutstandingIdr,
  INVOICES
} from '~/data'
import { clientDisputeInvoice, clientMarkInvoiceViewed, clientSubmitPaymentProof } from '~/data/client-portal-writes'
import { todayJakarta } from '~/lib/finance/dates'
import { createSaveGate } from '~/lib/save-gate'
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
const { showToast } = useToast()

const invoice = computed(() => INVOICES.find(item => item.id === String(route.params.id)))
const project = computed(() => (invoice.value ? getProjectById(invoice.value.projectId) : undefined))
const isOwnCompany = computed(() => Boolean(project.value && clientScopeId.value && project.value.partyId === clientScopeId.value))
useHead({ title: computed(() => invoice.value ? invoice.value.label : 'Tidak Ditemukan') })

/* Server writes (S12c-1, S12b-1): proofs, disputes and "viewed" go to /client/invoices/:id/*. */
const api = useApi()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))

onMounted(() => {
  if (!invoice.value || !isOwnCompany.value || invoice.value.viewedAt) { return }
  // Quietly: a failed mark only means the invoice is marked viewed on the next visit.
  clientMarkInvoiceViewed(api, invoice.value.id).catch(() => {})
})

const payments = computed(() => (invoice.value ? getPaymentsByInvoice(invoice.value.id) : []))
const creditNotes = computed(() => (invoice.value ? getCreditNotesByInvoice(invoice.value.id) : []))
const outstanding = computed(() => (invoice.value ? getInvoiceOutstandingIdr(invoice.value.id) : 0))

const canUploadProof = computed(() => invoice.value && (invoice.value.status === 'unpaid' || invoice.value.status === 'partially-paid'))
const canDispute = computed(() => invoice.value && invoice.value.status !== 'paid' && invoice.value.status !== 'void')

/* --- Upload payment proof: Finance verifies it by recording the payment (the official amount is theirs). --- */
const isProofOpen = ref(false)
const proofReference = ref('')
const proofAmount = ref(0)
const proofDate = ref('')
const proofBank = ref('')
const proofNote = ref('')
function openProofDialog () {
  proofReference.value = ''
  proofAmount.value = outstanding.value
  proofDate.value = todayJakarta()
  proofBank.value = ''
  proofNote.value = ''
  isProofOpen.value = true
}
async function submitProof () {
  if (!invoice.value || !clientScopeId.value || !proofReference.value.trim() || proofAmount.value <= 0 || !proofDate.value) { return }
  const invoiceId = invoice.value.id
  const partyId = clientScopeId.value
  const saved = await gate.run('Bukti Pembayaran Gagal Dikirim', () => clientSubmitPaymentProof(api, partyId, invoiceId, {
    reference: proofReference.value.trim(),
    amountMinor: String(Math.round(proofAmount.value)),
    transferDate: proofDate.value,
    ...(proofBank.value.trim() ? { senderBank: proofBank.value.trim() } : {}),
    ...(proofNote.value.trim() ? { note: proofNote.value.trim() } : {})
  }))
  if (!saved) { return }
  isProofOpen.value = false
  showToast('Referensi pembayaran tersimpan', 'Tambahkan file asli pada panel Bukti asli privat. Finance memverifikasi uang yang diterima.', 'success')
}

/* --- Raise dispute --- */
const isDisputeOpen = ref(false)
const disputeReason = ref('')
async function submitDispute () {
  if (!invoice.value || !clientScopeId.value || !disputeReason.value.trim()) { return }
  const invoiceId = invoice.value.id
  const partyId = clientScopeId.value
  const saved = await gate.run('Dispute Gagal Diajukan', () => clientDisputeInvoice(api, partyId, invoiceId, disputeReason.value.trim()))
  if (!saved) { return }
  disputeReason.value = ''
  isDisputeOpen.value = false
  showToast('Dispute Diajukan', 'Tim Finance kami akan meninjau invoice ini.', 'info')
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

      <PrivateEvidencePanel v-if="invoice.paymentProofId" source-type="payment_proof" :source-id="invoice.paymentProofId" :can-upload="invoice.paymentProofStatus==='submitted'" />
      <SectionCard v-if="invoice.paymentProofStatus === 'submitted' || invoice.paymentProofStatus === 'rejected'" title="Bukti Pembayaran">
        <DetailMetadataList
          :items="[
            { label: 'Referensi', value: invoice.paymentProofReference ?? '—' },
            { label: 'Jumlah Dilaporkan', value: formatCurrencyIdr(invoice.paymentProofAmountIdr ?? 0) },
            { label: 'Tanggal Transfer', value: invoice.paymentProofTransferDate ? formatDate(invoice.paymentProofTransferDate) : '—' },
            { label: 'Bank Pengirim', value: invoice.paymentProofSenderBank ?? '—' },
            { label: 'File', value: invoice.paymentProofFileName ?? '—' },
          ]"
        />
        <p v-if="invoice.paymentProofStatus === 'submitted'" class="text-sm text-muted-foreground mt-2">
          Menunggu verifikasi tim Finance kami.
        </p>
        <p v-else class="text-sm text-destructive mt-2">
          Bukti ini ditolak: {{ invoice.paymentProofRejectionReason }}. Silakan kirim bukti pembayaran yang benar.
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
          <ResponsiveFormSheet
            v-if="canUploadProof"
            v-model:open="isProofOpen"
            title="Upload Payment Proof"
            description="Catat referensi transfer dahulu. Setelah tersimpan, lampirkan file asli melalui panel Bukti asli privat. Uang belum dianggap diterima sebelum verifikasi Finance."
            content-class="max-w-md"
            scroll
          >
            <template #trigger>
              <Button size="sm" @click="openProofDialog">
                Upload Payment Proof
              </Button>
            </template>
            <div class="space-y-4 py-2">
              <div class="space-y-1.5">
                <Label for="proof-reference">Nomor Referensi Transfer</Label>
                <Input id="proof-reference" v-model="proofReference" placeholder="mis. TRF20260801XYZ" />
              </div>
              <div class="space-y-1.5">
                <Label for="proof-amount">Jumlah Ditransfer (IDR)</Label>
                <CurrencyInput id="proof-amount" v-model="proofAmount" min="1" :max="outstanding" />
              </div>
              <div class="space-y-1.5">
                <Label for="proof-date">Tanggal Transfer</Label>
                <Input id="proof-date" v-model="proofDate" type="date" :max="todayJakarta()" />
              </div>
              <div class="space-y-1.5">
                <Label for="proof-bank">Bank Pengirim (opsional)</Label>
                <Input id="proof-bank" v-model="proofBank" placeholder="mis. BCA" />
              </div>
              <div class="space-y-1.5">
                <Label for="proof-note">Catatan (opsional)</Label>
                <Input id="proof-note" v-model="proofNote" />
              </div>
            </div>
            <template #footer>
              <Button variant="outline" @click="isProofOpen = false">
                Batal
              </Button>
              <Button :disabled="!proofReference.trim() || proofAmount <= 0 || !proofDate || gate.saving.value" @click="submitProof">
                Kirim Konfirmasi Pembayaran
              </Button>
            </template>
          </ResponsiveFormSheet>
          <ResponsiveFormSheet v-if="canDispute" v-model:open="isDisputeOpen" title="Raise Dispute" description="Alasan wajib diisi." content-class="max-w-md">
            <template #trigger>
              <Button size="sm" variant="outline">
                Raise Dispute
              </Button>
            </template>
            <div class="space-y-1.5 py-2">
              <Label for="dispute-reason">Alasan</Label>
              <Input id="dispute-reason" v-model="disputeReason" />
            </div>
            <template #footer>
              <Button variant="outline" @click="isDisputeOpen = false">
                Batal
              </Button>
              <Button variant="destructive" :disabled="!disputeReason.trim()" @click="submitDispute">
                Ajukan Dispute
              </Button>
            </template>
          </ResponsiveFormSheet>
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
