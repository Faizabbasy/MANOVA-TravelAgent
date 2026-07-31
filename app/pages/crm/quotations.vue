<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  QUOTATIONS, getOpportunityById, getPartyById, getUserById, getQuotationByOpportunity,
  getQuotationsPendingApproval, getOpportunitiesPendingClientConfirmation,
  approveQuotation, rejectQuotation,
} from '~/data'
import { QUOTATION_APPROVAL_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { Quotation } from '~/types/opportunity'

/**
 * Management Approval Queue (Section 06) — mengisi placeholder `/crm/quotations` (Section 05/Foundation)
 * dengan agregat lintas seluruh Opportunity: quotation menunggu Commercial Approval (Wajib "Management
 * approval queue"), Opportunity menunggu Client Confirmation (visibilitas Management, aksi tetap milik AE,
 * Section 05), dan daftar seluruh quotation. Reuse penuh mutator `approveQuotation`/`rejectQuotation`
 * (Prompt 19/Section 05/06) — tidak ada mutator baru untuk approve/reject itu sendiri, hanya titik akses
 * baru yang mengagregasi lintas Opportunity (sebelumnya hanya bisa per-Opportunity di
 * `/crm/opportunities/[id]`).
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Quotations & Approval Queue' })

const route = useRoute()
const router = useRouter()
const { canView, canApprove } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const canApproveCommercial = computed(() => canApprove('crm'))

/** Tab state via query param (pola sama Project Detail, `projects/[id]/index.vue`) — deep-linkable dan dapat diverifikasi lewat curl/smoke test tanpa interaksi JS. */
const activeTab = computed<string>({
  get: () => (route.query.tab as string) || 'pending-approval',
  set: value => router.replace({ query: { ...route.query, tab: value } }),
})

function opportunityTitle(opportunityId: string) {
  return getOpportunityById(opportunityId)?.title ?? opportunityId
}

function partyName(opportunityId: string) {
  const opportunity = getOpportunityById(opportunityId)
  return opportunity ? (getPartyById(opportunity.partyId)?.name ?? '—') : '—'
}

function ownerName(opportunityId: string) {
  const opportunity = getOpportunityById(opportunityId)
  return opportunity ? (getUserById(opportunity.ownerId)?.name ?? opportunity.ownerId) : '—'
}

const pendingApproval = computed(() => getQuotationsPendingApproval())
const pendingConfirmation = computed(() => getOpportunitiesPendingClientConfirmation())
/** Drill-down (Section 07, Customer Journey Funnel) — `?tab=all&status=approved` dari `/customer-journey` deep-link ke quotation approved saja; kosong/`all` menampilkan seluruh quotation seperti semula. */
const statusQueryFilter = computed(() => (route.query.status as string) || 'all')
const allQuotations = computed(() => [...QUOTATIONS]
  .filter(q => statusQueryFilter.value === 'all' || (q.approvalStatus ?? 'draft') === statusQueryFilter.value)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

/**
 * "Complexity" (Wajib "Detail review ... complexity") — DIRIVASI dari jumlah service scope dan estimasi
 * traveler, bukan field tersimpan baru (konsisten pola `getOpportunityWorkflowStatus`, D-049/D-062).
 */
function complexityLabel(opportunityId: string): string {
  const opportunity = getOpportunityById(opportunityId)
  if (!opportunity) return '—'
  const serviceCount = opportunity.serviceScope.length
  const pax = opportunity.travelerEstimate ?? 0
  if (serviceCount >= 3 || pax >= 40) return 'Kompleks'
  if (serviceCount === 2 || pax >= 15) return 'Sedang'
  return 'Sederhana'
}

/* Review dialog (Wajib "Detail review quotation, margin, discount, terms, complexity, risk" + "Approve, reject, return for revision dengan notes/history") */
const isReviewOpen = ref(false)
const selectedQuotation = ref<Quotation | null>(null)
const decisionNote = ref('')

const selectedOpportunity = computed(() => (selectedQuotation.value ? getOpportunityById(selectedQuotation.value.opportunityId) : undefined))

function openReview(quotation: Quotation) {
  selectedQuotation.value = quotation
  decisionNote.value = ''
  isReviewOpen.value = true
}

function submitApprove() {
  if (!selectedQuotation.value) return
  const result = approveQuotation(selectedQuotation.value.id, currentUser.value.id, decisionNote.value.trim() || undefined)
  if (!result) {
    showToast('Approve Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Disetujui', `${result.id} disetujui — AE dapat melanjutkan ke client confirmation.`, 'success')
  isReviewOpen.value = false
}

function submitReject() {
  if (!selectedQuotation.value || !decisionNote.value.trim()) return
  const result = rejectQuotation(selectedQuotation.value.id, currentUser.value.id, decisionNote.value.trim())
  if (!result) {
    showToast('Reject Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Dikembalikan untuk Revisi', `${result.id} ditolak — AE perlu merevisi sebelum submit ulang.`, 'warning')
  isReviewOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Quotations & Approval Queue"
      description="Management approval queue lintas seluruh Opportunity, plus daftar seluruh quotation."
      :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Quotations' }]"
    />

    <RoleAccessState v-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="pending-approval">Menunggu Approval ({{ pendingApproval.length }})</TabsTrigger>
          <TabsTrigger value="pending-confirmation">Menunggu Client Confirmation ({{ pendingConfirmation.length }})</TabsTrigger>
          <TabsTrigger value="all">Semua Quotation ({{ allQuotations.length }})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending-approval">
          <SectionCard description="Quotation yang sudah AE submit dan menunggu Commercial Approval Management.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Account Executive</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Diajukan</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="quotation in pendingApproval" :key="quotation.id" class="cursor-pointer hover:bg-muted/50" @click="openReview(quotation)">
                  <TableCell class="font-medium text-foreground">{{ quotation.id }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ opportunityTitle(quotation.opportunityId) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ partyName(quotation.opportunityId) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ ownerName(quotation.opportunityId) }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDate(quotation.createdAt) }}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" @click.stop="openReview(quotation)">Review</Button>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="pendingApproval.length === 0" :colspan="7">Tidak ada quotation yang menunggu approval saat ini.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pending-confirmation">
          <SectionCard description="Quotation sudah disetujui Management, menunggu AE mencatat Client Confirmation sebelum Mark as Won (visibilitas Management — aksi tetap dilakukan AE di Opportunity Detail).">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Account Executive</TableHead>
                  <TableHead>Nilai Quotation</TableHead>
                  <TableHead>Disetujui Oleh</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="opportunity in pendingConfirmation" :key="opportunity.id" class="hover:bg-muted/50">
                  <TableCell class="font-medium text-foreground">{{ opportunity.title }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ getPartyById(opportunity.partyId)?.name ?? '—' }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ getUserById(opportunity.ownerId)?.name ?? opportunity.ownerId }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(getQuotationByOpportunity(opportunity.id)?.amountIdr ?? 0) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ getUserById(getQuotationByOpportunity(opportunity.id)?.approvedBy ?? '')?.name ?? '—' }}</TableCell>
                  <TableCell>
                    <NuxtLink :to="`/crm/opportunities/${opportunity.id}`" class="text-sm text-primary hover:underline">Lihat Opportunity →</NuxtLink>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="pendingConfirmation.length === 0" :colspan="6">Tidak ada opportunity yang menunggu client confirmation saat ini.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="all">
          <SectionCard description="Seluruh quotation lintas Opportunity, apa pun status approval-nya.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Nilai</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="quotation in allQuotations" :key="quotation.id" class="cursor-pointer hover:bg-muted/50" @click="openReview(quotation)">
                  <TableCell class="font-medium text-foreground">{{ quotation.id }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ opportunityTitle(quotation.opportunityId) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ partyName(quotation.opportunityId) }}</TableCell>
                  <TableCell>{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ quotation.version }}</TableCell>
                  <TableCell>
                    <StatusBadge
                      :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').label"
                      :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').tone"
                    />
                  </TableCell>
                  <TableCell class="text-muted-foreground">{{ formatDate(quotation.createdAt) }}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" @click.stop="openReview(quotation)">Detail</Button>
                  </TableCell>
                </TableRow>
                <TableEmpty v-if="allQuotations.length === 0" :colspan="8">Belum ada quotation.</TableEmpty>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </template>

    <!-- Review Dialog -->
    <Dialog v-model:open="isReviewOpen">
      <DialogScrollContent class="max-w-lg">
        <template v-if="selectedQuotation && selectedOpportunity">
          <DialogHeader>
            <DialogTitle>{{ selectedQuotation.id }} — {{ selectedOpportunity.title }}</DialogTitle>
            <DialogDescription>
              {{ getPartyById(selectedOpportunity.partyId)?.name ?? '—' }} · AE {{ getUserById(selectedOpportunity.ownerId)?.name ?? selectedOpportunity.ownerId }}
            </DialogDescription>
          </DialogHeader>

          <div class="flex items-center gap-2">
            <StatusBadge
              :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, selectedQuotation.approvalStatus ?? 'draft').label"
              :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, selectedQuotation.approvalStatus ?? 'draft').tone"
            />
            <StatusBadge :label="`Versi ${selectedQuotation.version}`" tone="info" />
          </div>

          <DetailMetadataList :items="[
            { label: 'Nilai Quotation', value: formatCurrencyIdr(selectedQuotation.amountIdr) },
            { label: 'Discount', value: selectedQuotation.discountIdr ? formatCurrencyIdr(selectedQuotation.discountIdr) : '—' },
            { label: 'Tax / Fee', value: selectedQuotation.taxIdr ? formatCurrencyIdr(selectedQuotation.taxIdr) : '—' },
            { label: 'Markup', value: selectedQuotation.markupIdr ? formatCurrencyIdr(selectedQuotation.markupIdr) : '—' },
            { label: 'Estimated Margin', value: selectedQuotation.estimatedMarginIdr ? formatCurrencyIdr(selectedQuotation.estimatedMarginIdr) : '—' },
            { label: 'Payment Terms', value: selectedQuotation.paymentTerms || '—' },
            { label: 'Valid Until', value: selectedQuotation.validUntil ? formatDate(selectedQuotation.validUntil) : '—' },
            { label: 'Complexity', value: complexityLabel(selectedOpportunity.id) },
            { label: 'Risk Notes', value: selectedOpportunity.requirementDetail?.riskNotes || '—' },
          ]" />

          <div v-if="selectedQuotation.serviceBreakdown && selectedQuotation.serviceBreakdown.length > 0" class="mt-2">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Service Breakdown</p>
            <ul class="divide-y divide-border">
              <li v-for="(item, index) in selectedQuotation.serviceBreakdown" :key="index" class="py-2 flex items-center justify-between gap-2">
                <span class="text-sm text-foreground">{{ findStatusOption(SERVICE_TYPES, item.service).label }}<template v-if="item.description"> — {{ item.description }}</template></span>
                <span class="text-sm text-foreground shrink-0">{{ formatCurrencyIdr(item.amountIdr) }}</span>
              </li>
            </ul>
          </div>

          <p v-if="selectedQuotation.approvalNote" class="text-sm text-muted-foreground mt-2">Catatan keputusan terakhir: {{ selectedQuotation.approvalNote }}</p>

          <NuxtLink :to="`/crm/opportunities/${selectedOpportunity.id}`" class="text-sm text-primary hover:underline block mt-2">Lihat Opportunity lengkap →</NuxtLink>

          <DialogFooter class="mt-4">
            <template v-if="canApproveCommercial && selectedQuotation.approvalStatus === 'submitted'">
              <div class="w-full space-y-2">
                <Label for="decision-note">Catatan Keputusan</Label>
                <Input id="decision-note" v-model="decisionNote" placeholder="mis. Disetujui sesuai standar margin / Margin terlalu rendah, revisi harga" />
                <div class="flex justify-end gap-2 pt-1">
                  <Button variant="outline" @click="isReviewOpen = false">Batal</Button>
                  <Button variant="destructive" :disabled="!decisionNote.trim()" :title="!decisionNote.trim() ? 'Catatan wajib diisi untuk reject' : undefined" @click="submitReject">Reject (Return for Revision)</Button>
                  <Button @click="submitApprove">Approve</Button>
                </div>
              </div>
            </template>
            <Button v-else variant="outline" @click="isReviewOpen = false">Tutup</Button>
          </DialogFooter>
        </template>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
