<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import {
  getOpportunityById, getPartyById, getQuotationByOpportunity, getOpportunityWorkflowStatus,
  createPartyActivity, recordClientConfirmation
} from '~/data'
import { OPPORTUNITY_WORKFLOW_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'

/**
 * Client-facing Opportunity/Quotation view (Section 08). Sanitized — TIDAK PERNAH merender
 * `discountIdr`/`estimatedCostIdr`/`estimatedMarginIdr`/`markupIdr` (cost/margin internal) atau
 * `approvedBy`/`approvalNote` (komentar internal Management). Isolasi: opportunity harus milik
 * `clientScopeId` (company) user login, selain itu tampil not-found — mencegah Client A membaca
 * Opportunity Client B lewat menebak ID di URL.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, clientScopeId } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const opportunity = computed(() => getOpportunityById(String(route.params.id)))
const isOwnCompany = computed(() => Boolean(opportunity.value && clientScopeId.value && opportunity.value.partyId === clientScopeId.value))
useHead({ title: computed(() => opportunity.value ? opportunity.value.title : 'Tidak Ditemukan') })

const party = computed(() => (opportunity.value ? getPartyById(opportunity.value.partyId) : undefined))
const quotation = computed(() => (opportunity.value ? getQuotationByOpportunity(opportunity.value.id) : undefined))
const workflowStatus = computed(() => (opportunity.value ? getOpportunityWorkflowStatus(opportunity.value.id) : undefined))
const serviceScopeOptions = computed(() => SERVICE_TYPES.filter(type => opportunity.value?.serviceScope.includes(type.value)))

const canDecide = computed(() => Boolean(quotation.value?.approvalStatus === 'approved' && !opportunity.value?.clientConfirmedAt))

/* Request Revision — komunikasi ke AE, TIDAK mengubah status apa pun (mock, D-006). */
const isRevisionDialogOpen = ref(false)
const revisionNote = ref('')

function submitRevisionRequest () {
  if (!opportunity.value || !revisionNote.value.trim()) { return }
  createPartyActivity({
    partyId: opportunity.value.partyId,
    opportunityId: opportunity.value.id,
    type: 'note',
    message: `Client meminta revisi quotation. Catatan: ${revisionNote.value.trim()}`,
    ownerId: currentUser.value.id
  })
  revisionNote.value = ''
  isRevisionDialogOpen.value = false
  showToast('Permintaan Revisi Terkirim', 'Account Executive kami akan meninjau permintaan Anda.', 'success')
}

/* Accept — reuse `recordClientConfirmation` (Section 05), kini self-service oleh Client, bukan hanya dicatat manual oleh AE. */
const isAcceptDialogOpen = ref(false)
const acceptNote = ref('')

function submitAccept () {
  if (!opportunity.value) { return }
  recordClientConfirmation(opportunity.value.id, currentUser.value.id, acceptNote.value.trim() || undefined)
  acceptNote.value = ''
  isAcceptDialogOpen.value = false
  showToast('Quotation Dikonfirmasi', 'Terima kasih — tim kami akan segera memproses selanjutnya.', 'success')
}

/* Reject — komunikasi penolakan, TIDAK mengubah `approvalStatus` (bukan Management/AE, mock, D-006). */
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
  rejectNote.value = ''
  isRejectDialogOpen.value = false
  showToast('Keberatan Terkirim', 'Account Executive kami akan menindaklanjuti keberatan Anda.', 'warning')
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!opportunity || !isOwnCompany">
      <PageHeader title="Tidak Ditemukan" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Tidak Ditemukan' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Opportunity tidak ditemukan" description="Opportunity ini tidak ada atau bukan milik company Anda.">
          <Button @click="router.push('/client')">
            Kembali ke Client Portal
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <PageHeader :title="opportunity.title" :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: opportunity.title }]">
        <template #actions>
          <StatusBadge
            v-if="workflowStatus"
            :label="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, workflowStatus).label"
            :tone="findStatusOption(OPPORTUNITY_WORKFLOW_STATUSES, workflowStatus).tone"
          />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList
          :items="[
            { label: 'Company', value: party?.name ?? '—' },
            { label: 'Destinasi', value: opportunity.destination },
            {
              label: 'Tanggal Perkiraan',
              value: opportunity.travelStartDate && opportunity.travelEndDate
                ? formatDateRange(opportunity.travelStartDate, opportunity.travelEndDate)
                : 'Belum ditentukan',
            },
            { label: 'Estimasi Traveler', value: opportunity.travelerEstimate ? `${opportunity.travelerEstimate} pax` : '—' },
          ]"
        />
        <div v-if="opportunity.serviceScope.length" class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-medium text-muted-foreground mb-2">
            Layanan
          </p>
          <div class="flex flex-wrap gap-2">
            <StatusBadge
              v-for="type in serviceScopeOptions"
              :key="type.value"
              :label="type.label"
              :tone="type.tone"
            />
          </div>
        </div>
        <div v-if="opportunity.stage === 'won' && opportunity.projectId" class="mt-4 pt-4 border-t border-border">
          <NuxtLink :to="`/client/project-orders/${opportunity.projectId}`" class="text-sm text-primary hover:underline">
            Lihat Project Order Anda →
          </NuxtLink>
        </div>
      </SectionCard>

      <SectionCard v-if="quotation" title="Quotation">
        <div class="space-y-2">
          <p class="text-2xl font-bold text-foreground">
            {{ formatCurrencyIdr(quotation.amountIdr) }}
          </p>
          <p v-if="quotation.sentToClientAt" class="text-xs text-muted-foreground">
            Dikirim kepada Anda pada {{ formatDate(quotation.sentToClientAt) }}
          </p>

          <div class="mt-2 pt-2 border-t border-border">
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

          <div v-if="quotation.serviceBreakdown && quotation.serviceBreakdown.length > 0" class="mt-2">
            <p class="text-xs font-medium text-muted-foreground mb-2">
              Rincian Layanan
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

          <div v-if="quotation.termsAndConditions || quotation.inclusions || quotation.exclusions" class="mt-2 pt-2 border-t border-border grid gap-3 sm:grid-cols-3">
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
              <Dialog v-model:open="isAcceptDialogOpen">
                <DialogTrigger as-child>
                  <Button>Setujui Quotation</Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Setujui Quotation</DialogTitle>
                    <DialogDescription>Konfirmasi Anda akan dicatat dan diteruskan ke tim kami untuk memproses langkah selanjutnya.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="accept-note">Catatan (opsional)</Label>
                    <Input id="accept-note" v-model="acceptNote" placeholder="mis. Disetujui, mohon segera diproses" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isAcceptDialogOpen = false">
                      Batal
                    </Button>
                    <Button @click="submitAccept">
                      Setujui
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog v-model:open="isRejectDialogOpen">
                <DialogTrigger as-child>
                  <Button variant="outline">
                    Tolak Quotation
                  </Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Tolak Quotation</DialogTitle>
                    <DialogDescription>Beri tahu kami alasannya agar tim kami dapat menindaklanjuti.</DialogDescription>
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
                      Tolak
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </template>
          <p v-else class="text-sm text-muted-foreground">
            Quotation ini masih dalam proses internal kami — konfirmasi akan tersedia setelah quotation final disetujui.
          </p>

          <Dialog v-model:open="isRevisionDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="ghost" class="mt-3">
                Minta Revisi
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Minta Revisi Quotation</DialogTitle>
                <DialogDescription>Sampaikan perubahan yang Anda butuhkan, Account Executive kami akan merevisi quotation.</DialogDescription>
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
      </SectionCard>
      <SectionCard v-else title="Quotation">
        <EmptyState title="Quotation belum tersedia" description="Quotation akan tampil di sini setelah tim kami menyiapkannya." />
      </SectionCard>
    </template>
  </div>
</template>
