<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Search, ChevronRight } from 'lucide-vue-next'
import {
  QUOTATIONS, getLeadById, getPartyById, getUserById,
  approveQuotation, rejectQuotation
} from '~/data'
import { QUOTATION_APPROVAL_STATUSES, SERVICE_TYPES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { Quotation, QuotationApprovalStatus } from '~/types/quotation'

/**
 * Tab "Quotation" — Menu Sales > Pipeline (Penyederhanaan 7-Role/Menu). Dulu `/crm/quotations`, kini tab
 * dalam satu menu Pipeline bersama Funnel/Leads/Quotation — logika tidak diubah, hanya dipindah. Sub-tab
 * "Menunggu Client Confirmation" DIHAPUS — Mark as Won sekarang satu langkah, gate hanya
 * `Quotation.approvalStatus === 'approved'` (entitas Opportunity dan gate client-confirmation dihapus,
 * lihat komentar desain di `app/types/lead.ts`). Sub-tab "Menunggu Approval" juga DIHAPUS — sudah
 * tercakup lewat filter Status di toolbar (pilih "Menunggu Approval").
 */

const route = useRoute()
const { canView, canApprove } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const canApproveCommercial = computed(() => canApprove('sales'))

function leadTitle (leadId: string) {
  const lead = getLeadById(leadId)
  return lead?.title ?? lead?.companyName ?? lead?.name ?? leadId
}

function partyName (leadId: string) {
  const lead = getLeadById(leadId)
  return lead?.partyId ? (getPartyById(lead.partyId)?.name ?? '—') : '—'
}

/** Toolbar search + filter status (Section Quotation) — pola sama toolbar tab Leads. */
const searchQuery = ref('')
const statusFilter = ref<'all' | QuotationApprovalStatus>('all')

function matchesSearch (quotation: Quotation) {
  if (!searchQuery.value.trim()) { return true }
  const q = searchQuery.value.toLowerCase()
  return quotation.id.toLowerCase().includes(q)
    || leadTitle(quotation.leadId).toLowerCase().includes(q)
    || partyName(quotation.leadId).toLowerCase().includes(q)
}

/** Drill-down (Customer Journey Funnel) — `?qtab=all&status=approved` deep-link ke quotation approved saja; kosong/`all` menampilkan seluruh quotation seperti semula. */
const statusQueryFilter = computed(() => (route.query.status as string) || 'all')
const allQuotations = computed(() => [...QUOTATIONS]
  .filter(q => statusQueryFilter.value === 'all' || (q.approvalStatus ?? 'draft') === statusQueryFilter.value)
  .filter(q => statusFilter.value === 'all' || (q.approvalStatus ?? 'draft') === statusFilter.value)
  .filter(matchesSearch)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

/**
 * "Complexity" (Wajib "Detail review ... complexity") — DIRIVASI dari jumlah service scope dan estimasi
 * traveler, bukan field tersimpan baru (konsisten pola derived-status lainnya, mis. `getLeadWorkflowStatus`).
 */
function complexityLabel (leadId: string): string {
  const lead = getLeadById(leadId)
  if (!lead) { return '—' }
  const serviceCount = lead.serviceScope?.length ?? 0
  const pax = lead.travelerEstimate ?? 0
  if (serviceCount >= 3 || pax >= 40) { return 'Kompleks' }
  if (serviceCount === 2 || pax >= 15) { return 'Sedang' }
  return 'Sederhana'
}

/* Review dialog (Wajib "Detail review quotation, margin, discount, terms, complexity, risk" + "Approve, reject, return for revision dengan notes/history") */
const isReviewOpen = ref(false)
const selectedQuotation = ref<Quotation | null>(null)
const decisionNote = ref('')

const selectedLead = computed(() => (selectedQuotation.value ? getLeadById(selectedQuotation.value.leadId) : undefined))

function openReview (quotation: Quotation) {
  selectedQuotation.value = quotation
  decisionNote.value = ''
  isReviewOpen.value = true
}

function submitApprove () {
  if (!selectedQuotation.value) { return }
  const result = approveQuotation(selectedQuotation.value.id, currentUser.value.id, decisionNote.value.trim() || undefined)
  if (!result) {
    showToast('Approve Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Disetujui', `${result.id} disetujui — AE dapat melanjutkan ke Mark as Won.`, 'success')
  isReviewOpen.value = false
}

function submitReject () {
  if (!selectedQuotation.value || !decisionNote.value.trim()) { return }
  const result = rejectQuotation(selectedQuotation.value.id, currentUser.value.id, decisionNote.value.trim())
  if (!result) {
    showToast('Reject Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Dikembalikan untuk Revisi', `${result.id} ditolak — AE perlu merevisi sebelum submit ulang.`, 'warning')
  isReviewOpen.value = false
}

/** Edit lengkap (amount/discount/tax/service breakdown/dst) hidup di tab "Quotation" milik `LeadDetailSheet`
 * — dibuka di sini lewat lead-nya, bukan navigasi ke halaman terpisah (`/crm/leads/[id]` sudah deprecated). */
const isEditDrawerOpen = ref(false)
const editDrawerLeadId = ref<string | null>(null)

function openQuotationEdit (leadId: string) {
  editDrawerLeadId.value = leadId
  isEditDrawerOpen.value = true
}

function viewLeadDetail () {
  if (!selectedQuotation.value) { return }
  isReviewOpen.value = false
  openQuotationEdit(selectedQuotation.value.leadId)
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('sales')" module-label="modul Sales" />

    <template v-else>
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="relative flex-1 w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari quotation, lead, atau party..." class="pl-9" />
        </div>
        <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Status
          </option>
          <option v-for="opt in QUOTATION_APPROVAL_STATUSES" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <SectionCard description="Seluruh quotation lintas Lead, apa pun status approval-nya.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Versi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="quotation in allQuotations" :key="quotation.id" class="group cursor-pointer transition-colors hover:bg-muted/50" @click="openReview(quotation)">
              <TableCell class="font-medium text-primary group-hover:underline">
                {{ quotation.id }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ leadTitle(quotation.leadId) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ partyName(quotation.leadId) }}
              </TableCell>
              <TableCell>{{ formatCurrencyIdr(quotation.amountIdr) }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ quotation.version }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').label"
                  :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').tone"
                />
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(quotation.createdAt) }}
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end gap-1.5">
                  <Button size="sm" variant="outline" @click.stop="openReview(quotation)">
                    Detail
                  </Button>
                  <Button size="sm" variant="outline" @click.stop="openQuotationEdit(quotation.leadId)">
                    Edit
                  </Button>
                  <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="allQuotations.length === 0" :colspan="8">
              Belum ada quotation.
            </TableEmpty>
          </TableBody>
        </Table>
      </SectionCard>
    </template>

    <!-- Review Dialog -->
    <Dialog v-model:open="isReviewOpen">
      <DialogScrollContent class="max-w-lg">
        <template v-if="selectedQuotation && selectedLead">
          <DialogHeader>
            <DialogTitle>{{ selectedQuotation.id }} — {{ selectedLead.title ?? selectedLead.companyName ?? selectedLead.name }}</DialogTitle>
            <DialogDescription>
              {{ selectedLead.partyId ? (getPartyById(selectedLead.partyId)?.name ?? '—') : '—' }} · AE {{ getUserById(selectedLead.handedOverTo ?? selectedLead.ownerId)?.name ?? selectedLead.handedOverTo ?? selectedLead.ownerId }}
            </DialogDescription>
          </DialogHeader>

          <div class="flex items-center gap-2">
            <StatusBadge
              :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, selectedQuotation.approvalStatus ?? 'draft').label"
              :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, selectedQuotation.approvalStatus ?? 'draft').tone"
            />
            <StatusBadge :label="`Versi ${selectedQuotation.version}`" tone="info" />
          </div>

          <DetailMetadataList
            :items="[
              { label: 'Nilai Quotation', value: formatCurrencyIdr(selectedQuotation.amountIdr) },
              { label: 'Discount', value: selectedQuotation.discountIdr ? formatCurrencyIdr(selectedQuotation.discountIdr) : '—' },
              { label: 'Tax / Fee', value: selectedQuotation.taxIdr ? formatCurrencyIdr(selectedQuotation.taxIdr) : '—' },
              { label: 'Markup', value: selectedQuotation.markupIdr ? formatCurrencyIdr(selectedQuotation.markupIdr) : '—' },
              { label: 'Estimated Margin', value: selectedQuotation.estimatedMarginIdr ? formatCurrencyIdr(selectedQuotation.estimatedMarginIdr) : '—' },
              { label: 'Payment Terms', value: selectedQuotation.paymentTerms || '—' },
              { label: 'Valid Until', value: selectedQuotation.validUntil ? formatDate(selectedQuotation.validUntil) : '—' },
              { label: 'Complexity', value: complexityLabel(selectedLead.id) },
            ]"
          />

          <div v-if="selectedQuotation.serviceBreakdown && selectedQuotation.serviceBreakdown.length > 0" class="mt-2">
            <p class="text-xs font-medium text-muted-foreground mb-2">
              Service Breakdown
            </p>
            <ul class="divide-y divide-border">
              <li v-for="(item, index) in selectedQuotation.serviceBreakdown" :key="index" class="py-2 flex items-center justify-between gap-2">
                <span class="text-sm text-foreground">{{ findStatusOption(SERVICE_TYPES, item.service).label }}<template v-if="item.description"> — {{ item.description }}</template></span>
                <span class="text-sm text-foreground shrink-0">{{ formatCurrencyIdr(item.amountIdr) }}</span>
              </li>
            </ul>
          </div>

          <p v-if="selectedQuotation.approvalNote" class="text-sm text-muted-foreground mt-2">
            Catatan keputusan terakhir: {{ selectedQuotation.approvalNote }}
          </p>

          <button type="button" class="text-sm text-primary hover:underline block mt-2" @click="viewLeadDetail">
            Lihat Lead lengkap →
          </button>

          <DialogFooter class="mt-4">
            <template v-if="canApproveCommercial && selectedQuotation.approvalStatus === 'submitted'">
              <div class="w-full space-y-2">
                <Label for="decision-note">Catatan Keputusan</Label>
                <Input id="decision-note" v-model="decisionNote" placeholder="mis. Disetujui sesuai standar margin / Margin terlalu rendah, revisi harga" />
                <div class="flex justify-end gap-2 pt-1">
                  <Button variant="outline" @click="isReviewOpen = false">
                    Batal
                  </Button>
                  <Button variant="destructive" :disabled="!decisionNote.trim()" :title="!decisionNote.trim() ? 'Catatan wajib diisi untuk reject' : undefined" @click="submitReject">
                    Reject (Return for Revision)
                  </Button>
                  <Button @click="submitApprove">
                    Approve
                  </Button>
                </div>
              </div>
            </template>
            <Button v-else variant="outline" @click="isReviewOpen = false">
              Tutup
            </Button>
          </DialogFooter>
        </template>
      </DialogScrollContent>
    </Dialog>

    <!-- Edit Quotation lengkap — tab "Quotation" di sheet ini, bukan navigasi ke halaman terpisah -->
    <LeadDetailSheet v-model:open="isEditDrawerOpen" :lead-id="editDrawerLeadId" initial-tab="quotation" />
  </div>
</template>
