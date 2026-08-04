<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Printer, History, GitCompare } from 'lucide-vue-next'
import {
  getQuotationById, getOpportunityById, getPartyById, getOpportunitiesByParty, getQuotationByOpportunity,
  getUserById, recordClientConfirmation, advanceOpportunityStage, approveOpportunityWon,
  createPartyActivity, requestQuotationRevision, getQuotationAttachments, addQuotationAttachment,
  getQuotationComments, addQuotationComment, pushNotification
} from '~/data'
import { QUOTATION_APPROVAL_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateTime } from '~/utils/format'

/**
 * Quotations & Proposals — Detail (Repair Phase Section 3 — Request & Commercial). `:id` = Quotation id
 * (`QUO-xxx`). Approve/Reject/Request Revision REUSE penuh `recordClientConfirmation`/`advanceOpportunityStage`/
 * `approveOpportunityWon`/`requestQuotationRevision` (LOCKED pipeline internal, TIDAK diduplikasi) — pola
 * "Mark as Won" (D-053, `app/pages/crm/opportunities/[id]/index.vue`) diterapkan dari sisi Client sehingga
 * Won→Project dapat dicapai murni lewat aksi Client (Master Prompt Flow 1, "Mock Opportunity Won").
 * `/client/opportunities/[id]` (Section 08) TETAP TIDAK diubah — halaman ini melengkapi (Version history/
 * Compare/Comments/Attachments/Cancellation policy/Download PDF), bukan menggantikan jalur yang sudah bekerja.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const quotation = computed(() => getQuotationById(String(route.params.id)))
const opportunity = computed(() => (quotation.value ? getOpportunityById(quotation.value.opportunityId) : undefined))
const isOwnCompany = computed(() => Boolean(opportunity.value && clientScopeId.value && opportunity.value.partyId === clientScopeId.value))
useHead({ title: computed(() => opportunity.value ? `Quotation — ${opportunity.value.title}` : 'Tidak Ditemukan') })

const party = computed(() => (opportunity.value ? getPartyById(opportunity.value.partyId) : undefined))
const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => opportunity.value?.serviceScope.includes(type.value)))
const canDecide = computed(() => Boolean(quotation.value?.approvalStatus === 'approved' && !opportunity.value?.clientConfirmedAt))

/* --- Version compare (single-diff toggle, pola sama Cost Sheet) --- */
const isVersionCompareOpen = ref(false)

/* --- Compare package option (sibling quotation, opportunity lain milik company yang sama) --- */
const siblingOptions = computed(() => {
  if (!clientScopeId.value || !opportunity.value) { return [] }
  return getOpportunitiesByParty(clientScopeId.value)
    .filter(item => item.id !== opportunity.value!.id)
    .map(item => ({ opportunity: item, quotation: getQuotationByOpportunity(item.id) }))
    .filter((row): row is { opportunity: typeof row.opportunity; quotation: NonNullable<typeof row.quotation> } => Boolean(row.quotation))
})
const compareTargetId = ref('')
const compareTarget = computed(() => siblingOptions.value.find(row => row.opportunity.id === compareTargetId.value))

/* --- Comments --- */
const commentBody = ref('')
const comments = computed(() => (quotation.value ? getQuotationComments(quotation.value.id).map(item => ({ ...item, authorName: getUserById(item.authorId)?.name ?? item.authorId })) : []))
function submitComment () {
  if (!quotation.value || !commentBody.value.trim()) { return }
  addQuotationComment(quotation.value.id, currentUser.value.id, commentBody.value.trim())
  commentBody.value = ''
  showToast('Komentar Ditambahkan', 'Komentar Anda berhasil disimpan.', 'success')
}

/* --- Attachments --- */
const attachmentFileName = ref('')
const attachments = computed(() => (quotation.value ? getQuotationAttachments(quotation.value.id) : []))
function uploadAttachment () {
  if (!quotation.value || !attachmentFileName.value.trim()) { return }
  addQuotationAttachment(quotation.value.id, attachmentFileName.value.trim(), currentUser.value.id)
  attachmentFileName.value = ''
  showToast('Attachment Ditambahkan', 'Metadata attachment tercatat (mock, bukan file upload nyata).', 'success')
}

/* --- Approve (reuse recordClientConfirmation lalu mock-cascade Won, pola sama D-053) --- */
const isApproveDialogOpen = ref(false)
const approveNote = ref('')
function submitApprove () {
  if (!opportunity.value || !quotation.value) { return }
  recordClientConfirmation(opportunity.value.id, currentUser.value.id, approveNote.value.trim() || undefined)
  advanceOpportunityStage(opportunity.value.id, 'won-requested')
  const project = approveOpportunityWon(opportunity.value.id, quotation.value.approvedBy ?? currentUser.value.id)
  approveNote.value = ''
  isApproveDialogOpen.value = false
  if (!project) {
    showToast('Quotation Dikonfirmasi', 'Terima kasih — tim kami akan segera memproses selanjutnya.', 'success')
    return
  }
  showToast('Opportunity Won (Mock)', `${project.name} (${project.id}) dibuat otomatis. Lihat di Project Order Anda.`, 'success')
  router.push(`/client/project-orders/${project.id}`)
}

/* --- Reject (pola sama /client/opportunities/[id], ditambah Notification) --- */
const isRejectDialogOpen = ref(false)
const rejectNote = ref('')
function submitReject () {
  if (!opportunity.value || !rejectNote.value.trim()) { return }
  createPartyActivity({
    partyId: opportunity.value.partyId,
    opportunityId: opportunity.value.id,
    type: 'note',
    message: `Client TIDAK menyetujui quotation ini. Alasan: ${rejectNote.value.trim()}`,
    ownerId: currentUser.value.id
  })
  pushNotification(currentUser.value.id, 'change', `Quotation ${quotation.value?.id} ditolak`, 'Keberatan Anda telah dicatat dan diteruskan ke tim kami.', 'quotation', quotation.value?.id, 'approval')
  rejectNote.value = ''
  isRejectDialogOpen.value = false
  showToast('Keberatan Terkirim', 'Account Executive kami akan menindaklanjuti keberatan Anda.', 'warning')
}

/* --- Request Revision (Wajib Cross-module "New quotation version simulation") --- */
const isRevisionDialogOpen = ref(false)
const revisionNote = ref('')
function submitRevisionRequest () {
  if (!opportunity.value || !revisionNote.value.trim()) { return }
  requestQuotationRevision(opportunity.value.id, currentUser.value.id, revisionNote.value.trim())
  revisionNote.value = ''
  isRevisionDialogOpen.value = false
  showToast('Permintaan Revisi Terkirim', 'Versi baru quotation telah disiapkan — silakan tinjau kembali.', 'success')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!quotation || !opportunity || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Quotation tidak ditemukan" description="Quotation ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client/quotations')">
            Kembali ke Quotations
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader
        :title="opportunity.title"
        :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Quotations & Proposals', to: '/client/quotations' }, { label: opportunity.title }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').label" :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').tone" />
          <NuxtLink :to="`/client/quotations/${quotation.id}/preview`" target="_blank">
            <Button size="sm" variant="outline">
              <Printer class="h-4 w-4 mr-1.5" />Download Mock PDF
            </Button>
          </NuxtLink>
        </template>
      </PageHeader>

      <SectionCard>
        <p class="text-2xl font-bold text-foreground">
          {{ formatCurrencyIdr(quotation.amountIdr) }}
        </p>
        <p v-if="quotation.sentToClientAt" class="text-xs text-muted-foreground">
          Dikirim kepada Anda pada {{ formatDate(quotation.sentToClientAt) }} · Versi {{ quotation.version }}
        </p>

        <div class="mt-3 pt-3 border-t border-border">
          <DetailMetadataList
            :items="[
              { label: 'Discount', value: quotation.discountIdr ? formatCurrencyIdr(quotation.discountIdr) : '—' },
              { label: 'Tax / Fee', value: quotation.taxIdr ? formatCurrencyIdr(quotation.taxIdr) : '—' },
              { label: 'Currency', value: quotation.currency || 'IDR' },
              { label: 'Valid Until', value: quotation.validUntil ? formatDate(quotation.validUntil) : '—' },
              { label: 'Payment Terms', value: quotation.paymentTerms || '—' },
            ]"
          />
        </div>

        <div v-if="serviceScopeOptions.length" class="mt-3 pt-3 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Layanan
          </p>
          <div class="flex flex-wrap gap-2">
            <StatusBadge v-for="type in serviceScopeOptions" :key="type.value" :label="type.label" :tone="type.tone" />
          </div>
        </div>

        <div v-if="quotation.serviceBreakdown && quotation.serviceBreakdown.length > 0" class="mt-3 pt-3 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Service Breakdown
          </p>
          <ul class="divide-y divide-border">
            <li v-for="(item, index) in quotation.serviceBreakdown" :key="index" class="py-2 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm text-foreground">
                  {{ findStatusOption(SERVICE_TYPES, item.service).label }}
                </p>
                <p v-if="item.description" class="text-xs text-muted-foreground truncate">
                  {{ item.description }}
                </p>
              </div>
              <p class="text-sm text-foreground shrink-0">
                {{ formatCurrencyIdr(item.amountIdr) }}
              </p>
            </li>
          </ul>
        </div>

        <div v-if="quotation.termsAndConditions || quotation.inclusions || quotation.exclusions || quotation.cancellationPolicy || quotation.proposedItineraryNote" class="mt-3 pt-3 border-t border-border grid gap-3 sm:grid-cols-2">
          <div v-if="quotation.inclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Termasuk
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ quotation.inclusions }}
            </p>
          </div>
          <div v-if="quotation.exclusions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Tidak Termasuk
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ quotation.exclusions }}
            </p>
          </div>
          <div v-if="quotation.termsAndConditions">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Syarat &amp; Ketentuan
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ quotation.termsAndConditions }}
            </p>
          </div>
          <div v-if="quotation.cancellationPolicy">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Cancellation Policy
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ quotation.cancellationPolicy }}
            </p>
          </div>
          <div v-if="quotation.proposedItineraryNote" class="sm:col-span-2">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Proposed Itinerary
            </p>
            <p class="text-xs text-foreground whitespace-pre-line">
              {{ quotation.proposedItineraryNote }}
            </p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-border">
          <template v-if="opportunity.clientConfirmedAt">
            <div class="flex items-center gap-2">
              <StatusBadge label="Anda Sudah Mengonfirmasi" tone="success" />
              <span class="text-xs text-muted-foreground">pada {{ formatDate(opportunity.clientConfirmedAt) }}</span>
            </div>
            <p v-if="opportunity.clientConfirmationNote" class="text-sm text-muted-foreground mt-1">
              Catatan Anda: {{ opportunity.clientConfirmationNote }}
            </p>
          </template>
          <template v-else-if="canDecide">
            <p class="text-sm text-foreground mb-3">
              Quotation ini sudah disetujui secara komersial oleh tim kami. Silakan konfirmasi persetujuan Anda, atau ajukan keberatan/revisi.
            </p>
            <div class="flex flex-wrap gap-2">
              <Dialog v-model:open="isApproveDialogOpen">
                <DialogTrigger as-child>
                  <Button>Approve Quotation</Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Approve Quotation</DialogTitle>
                    <DialogDescription>Konfirmasi Anda akan langsung memproses Opportunity menjadi Won dan membuat Project Order (mock).</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="approve-note">Catatan (opsional)</Label>
                    <Input id="approve-note" v-model="approveNote" placeholder="mis. Disetujui, mohon segera diproses" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isApproveDialogOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitApprove">
                      Approve
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog v-model:open="isRejectDialogOpen">
                <DialogTrigger as-child>
                  <Button variant="outline">
                    Reject Quotation
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reject Quotation</DialogTitle>
                    <DialogDescription>Alasan wajib diisi agar tim kami dapat menindaklanjuti.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="reject-note">Alasan</Label>
                    <Input id="reject-note" v-model="rejectNote" placeholder="mis. Harga di luar budget kami" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isRejectDialogOpen = false">
                      Batal
                    </Button>
                    <Button variant="destructive" :disabled="!rejectNote.trim()" @click="submitReject">
                      Reject
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog v-model:open="isRevisionDialogOpen">
                <DialogTrigger as-child>
                  <Button variant="ghost">
                    Request Revision
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Request Revision</DialogTitle>
                    <DialogDescription>Sampaikan perubahan yang Anda butuhkan — versi baru quotation akan disiapkan otomatis (mock).</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="revision-note">Detail Revisi</Label>
                    <textarea id="revision-note" v-model="revisionNote" rows="3" class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mis. Mohon tambahkan opsi hotel bintang 5" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isRevisionDialogOpen = false">
                      Batal
                    </Button>
                    <Button :disabled="!revisionNote.trim()" @click="submitRevisionRequest">
                      Kirim Permintaan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </template>
          <p v-else class="text-sm text-muted-foreground">
            Quotation ini masih dalam proses internal kami — konfirmasi akan tersedia setelah quotation final disetujui.
          </p>
        </div>
      </SectionCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Version History">
          <template v-if="quotation.supersededAmountIdr">
            <button type="button" class="text-sm text-primary hover:underline" @click="isVersionCompareOpen = !isVersionCompareOpen">
              <History class="h-3.5 w-3.5 inline mr-1" />{{ isVersionCompareOpen ? 'Sembunyikan' : 'Bandingkan' }} versi sebelumnya
            </button>
            <div v-if="isVersionCompareOpen" class="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-lg border border-border p-3">
                <p class="text-xs text-muted-foreground mb-1">
                  Versi Sebelumnya
                </p>
                <p class="font-medium text-foreground">
                  {{ formatCurrencyIdr(quotation.supersededAmountIdr) }}
                </p>
              </div>
              <div class="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p class="text-xs text-muted-foreground mb-1">
                  Versi {{ quotation.version }} (Saat Ini)
                </p>
                <p class="font-medium text-foreground">
                  {{ formatCurrencyIdr(quotation.amountIdr) }}
                </p>
              </div>
            </div>
          </template>
          <EmptyState v-else title="Belum ada revisi" description="Quotation ini belum pernah direvisi." />
        </SectionCard>

        <SectionCard title="Compare Package Option" description="Bandingkan dengan quotation lain milik company Anda.">
          <template v-if="siblingOptions.length">
            <select v-model="compareTargetId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer mb-3">
              <option value="">
                Pilih quotation pembanding...
              </option>
              <option v-for="row in siblingOptions" :key="row.opportunity.id" :value="row.opportunity.id">
                {{ row.opportunity.title }}
              </option>
            </select>
            <div v-if="compareTarget" class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p class="text-xs text-muted-foreground mb-1">
                  {{ opportunity.title }}
                </p>
                <p class="font-medium text-foreground">
                  {{ formatCurrencyIdr(quotation.amountIdr) }}
                </p>
              </div>
              <div class="rounded-lg border border-border p-3">
                <p class="text-xs text-muted-foreground mb-1">
                  {{ compareTarget.opportunity.title }}
                </p>
                <p class="font-medium text-foreground">
                  {{ formatCurrencyIdr(compareTarget.quotation.amountIdr) }}
                </p>
              </div>
            </div>
          </template>
          <EmptyState v-else :icon="GitCompare" title="Tidak ada quotation lain" description="Belum ada quotation lain milik company Anda untuk dibandingkan." />
        </SectionCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Comments">
          <div class="flex gap-2 mb-3">
            <Input v-model="commentBody" placeholder="Tulis komentar..." @keyup.enter="submitComment" />
            <Button size="sm" variant="outline" :disabled="!commentBody.trim()" @click="submitComment">
              Kirim
            </Button>
          </div>
          <ul v-if="comments.length" class="space-y-3">
            <li v-for="comment in comments" :key="comment.id" class="text-sm">
              <p class="text-foreground">
                {{ comment.body }}
              </p>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ comment.authorName }} · {{ formatDateTime(comment.createdAt) }}
              </p>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada komentar" />
        </SectionCard>

        <SectionCard title="Attachments" description="Mock — metadata nama file saja.">
          <div class="flex gap-2 mb-3">
            <Input v-model="attachmentFileName" placeholder="mis. Brosur_Hotel.pdf" />
            <Button size="sm" variant="outline" :disabled="!attachmentFileName.trim()" @click="uploadAttachment">
              Tambah
            </Button>
          </div>
          <ul v-if="attachments.length" class="divide-y divide-border">
            <li v-for="attachment in attachments" :key="attachment.id" class="py-2 flex items-center justify-between gap-2">
              <span class="text-sm text-foreground truncate">{{ attachment.fileName }}</span>
              <span class="text-xs text-muted-foreground shrink-0">{{ formatDate(attachment.uploadedAt) }}</span>
            </li>
          </ul>
          <EmptyState v-else title="Belum ada attachment" />
        </SectionCard>
      </div>

      <SectionCard v-if="party" title="Company">
        <DetailMetadataList :items="[{ label: 'Nama Company', value: party.name }]" />
      </SectionCard>
    </template>
  </div>
</template>
