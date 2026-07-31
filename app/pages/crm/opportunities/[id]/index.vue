<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileX, Plus } from 'lucide-vue-next'
import {
  getOpportunityById, getPartyById, getQuotationByOpportunity, getPartyActivitiesByOpportunity, getUserById,
  createQuotation, reviseQuotation, advanceOpportunityStage, createPartyActivity,
  getOpportunityMissingRequirements, approveOpportunityWon, rejectOpportunityWon,
  submitQuotationForApproval, approveQuotation, rejectQuotation,
} from '~/data'
import { OPPORTUNITY_STAGES, SERVICE_TYPES, PARTY_ACTIVITY_TYPES, QUOTATION_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate, formatDateRange } from '~/utils/format'
import type { OpportunityStage } from '~/types/opportunity'
import type { PartyActivityType } from '~/types/party'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { currentRole, currentUser } = useCurrentUser()
const { canView, canApprove } = usePermissions()
const { showToast } = useToast()

/** Sama seperti `canManageParty` (Section 07) — pengecualian sempit, bukan mekanisme role-check baru.
 * Management sengaja TIDAK termasuk: level modul `crm`-nya (`APPROVE`) dikhususkan untuk approve
 * Won di Section 09, bukan untuk mengelola stage sehari-hari (docs bagian 1.2).
 * Prompt 19 (Change Request) — role dipindah dari `sales` ke `account-executive`: di bawah model role
 * baru, Sales berhenti mengelola Opportunity/Quotation (scoped ke Lead, lihat `/customer-journey/leads`),
 * Account Executive yang menerima handover dan mengelola Opportunity sampai Won. */
const canManageOpportunity = computed(() => ['account-executive', 'super-admin'].includes(currentRole.value))

/** Commercial Approval (Prompt 19) — Management/Super Admin approve/reject quotation, TERPISAH dari `canApproveOpportunity` (approve Won). Reuse `canApprove('crm')`, bukan constant baru. */
const canApproveCommercial = computed(() => canApprove('crm'))

const opportunity = computed(() => getOpportunityById(String(route.params.id)))
useHead({ title: computed(() => opportunity.value ? opportunity.value.title : 'Opportunity Tidak Ditemukan') })

const party = computed(() => (opportunity.value ? getPartyById(opportunity.value.partyId) : undefined))
const quotation = computed(() => (opportunity.value ? getQuotationByOpportunity(opportunity.value.id) : undefined))
const activities = computed(() => (opportunity.value ? getPartyActivitiesByOpportunity(opportunity.value.id) : []))

/** Permission Approve/Reject Won (Section 09) — Management/Super Admin (rank `APPROVE`), berbeda dari
 * `canManageOpportunity` (Sales/Super Admin) yang dipakai untuk transisi stage sehari-hari (Section 08). */
const canApproveOpportunity = computed(() => canApprove('crm'))
const missingRequirements = computed(() => (opportunity.value ? getOpportunityMissingRequirements(opportunity.value.id) : []))

const summaryMetadata = computed(() => {
  if (!opportunity.value) return []
  return [
    { label: 'Party', value: party.value?.name ?? '—' },
    { label: 'Account Executive', value: getUserById(opportunity.value.ownerId)?.name ?? '—' },
    { label: 'Destinasi', value: opportunity.value.destination },
    {
      label: 'Tanggal Perkiraan',
      value: opportunity.value.travelStartDate && opportunity.value.travelEndDate
        ? formatDateRange(opportunity.value.travelStartDate, opportunity.value.travelEndDate)
        : 'Belum ditentukan',
    },
    { label: 'Estimasi Traveler', value: opportunity.value.travelerEstimate ? `${opportunity.value.travelerEstimate} pax` : '—' },
    { label: 'Estimasi Nilai', value: formatCurrencyIdr(opportunity.value.estimatedValueIdr) },
    { label: 'Dibuat', value: formatDate(opportunity.value.createdAt) },
  ]
})

/* Stage stepper & aksi transisi */
const MAIN_STAGES: OpportunityStage[] = ['draft', 'qualification', 'requirement-gathering', 'proposal', 'negotiation', 'won-requested', 'won']
const currentStageIndex = computed(() => (opportunity.value ? MAIN_STAGES.indexOf(opportunity.value.stage) : -1))

const isProposalDialogOpen = ref(false)
const proposalQuotationAmount = ref<number | null>(null)

function goToNextSimpleStage(next: OpportunityStage) {
  if (!opportunity.value) return
  advanceOpportunityStage(opportunity.value.id, next)
}

function openProposalDialog() {
  if (quotation.value) {
    // Quotation sudah ada (edge case) — langsung lanjut tanpa dialog.
    goToNextSimpleStage('proposal')
    return
  }
  proposalQuotationAmount.value = null
  isProposalDialogOpen.value = true
}

function submitProposal() {
  if (!opportunity.value || !proposalQuotationAmount.value || proposalQuotationAmount.value <= 0) return
  createQuotation(opportunity.value.id, proposalQuotationAmount.value)
  advanceOpportunityStage(opportunity.value.id, 'proposal')
  isProposalDialogOpen.value = false
}

const isLostDialogOpen = ref(false)
const lostReasonInput = ref('')

function submitLost() {
  if (!opportunity.value || !lostReasonInput.value.trim()) return
  advanceOpportunityStage(opportunity.value.id, 'lost', { lostReason: lostReasonInput.value.trim() })
  isLostDialogOpen.value = false
  lostReasonInput.value = ''
}

const isReviseDialogOpen = ref(false)
const revisedAmount = ref<number | null>(null)

function openReviseDialog() {
  revisedAmount.value = quotation.value?.amountIdr ?? null
  isReviseDialogOpen.value = true
}

function submitRevise() {
  if (!quotation.value || !revisedAmount.value || revisedAmount.value <= 0) return
  reviseQuotation(quotation.value.id, revisedAmount.value)
  isReviseDialogOpen.value = false
}

/* Approve / Reject Won (Section 09) */
const isApproveDialogOpen = ref(false)
const isRejectDialogOpen = ref(false)
const rejectNoteInput = ref('')

function submitApprove() {
  if (!opportunity.value) return
  const project = approveOpportunityWon(opportunity.value.id, currentUser.value.id)
  isApproveDialogOpen.value = false
  if (!project) {
    showToast('Approve Won Gagal', 'Requirement belum lengkap atau opportunity sudah diproses sebelumnya.', 'error')
    return
  }
  showToast('Project Berhasil Dibuat', `${project.name} (${project.id}) dibuat dari opportunity ini.`, 'success')
  router.push(`/projects/${project.id}`)
}

function submitReject() {
  if (!opportunity.value || !rejectNoteInput.value.trim()) return
  const result = rejectOpportunityWon(opportunity.value.id, rejectNoteInput.value.trim())
  isRejectDialogOpen.value = false
  rejectNoteInput.value = ''
  if (!result) {
    showToast('Reject Gagal', 'Opportunity tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Opportunity Ditolak', 'Dikembalikan ke stage Negotiation dengan catatan.', 'warning')
}

/* Commercial Approval (Prompt 19) — AE submit quotation untuk approval, Management approve/reject. */
const isSubmitApprovalDialogOpen = ref(false)
const isApproveCommercialDialogOpen = ref(false)
const isRejectCommercialDialogOpen = ref(false)
const commercialNoteInput = ref('')

function submitForCommercialApproval() {
  if (!quotation.value) return
  submitQuotationForApproval(quotation.value.id)
  isSubmitApprovalDialogOpen.value = false
  showToast('Quotation Diajukan', 'Menunggu commercial approval dari Management.', 'success')
}

function submitApproveCommercial() {
  if (!quotation.value) return
  const result = approveQuotation(quotation.value.id, currentUser.value.id, commercialNoteInput.value.trim() || undefined)
  isApproveCommercialDialogOpen.value = false
  commercialNoteInput.value = ''
  if (!result) {
    showToast('Approve Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Disetujui', 'AE dapat melanjutkan ke Negotiation / mengajukan sebagai Won.', 'success')
}

function submitRejectCommercial() {
  if (!quotation.value || !commercialNoteInput.value.trim()) return
  const result = rejectQuotation(quotation.value.id, currentUser.value.id, commercialNoteInput.value.trim())
  isRejectCommercialDialogOpen.value = false
  commercialNoteInput.value = ''
  if (!result) {
    showToast('Reject Gagal', 'Quotation tidak lagi berstatus menunggu approval.', 'error')
    return
  }
  showToast('Quotation Ditolak', 'AE perlu merevisi quotation sebelum mengajukan ulang.', 'warning')
}

/* Catat Activity */
const isActivityDialogOpen = ref(false)
const activityType = ref<PartyActivityType>('call')
const activityMessage = ref('')
const activityDueAt = ref('')

function submitActivity() {
  if (!opportunity.value || !activityMessage.value.trim()) return
  createPartyActivity({
    partyId: opportunity.value.partyId,
    opportunityId: opportunity.value.id,
    type: activityType.value,
    message: activityMessage.value.trim(),
    ownerId: currentUser.value.id,
    dueAt: activityDueAt.value || undefined,
  })
  activityMessage.value = ''
  activityDueAt.value = ''
  activityType.value = 'call'
  isActivityDialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!opportunity">
      <PageHeader title="Opportunity Tidak Ditemukan" :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Opportunities', to: '/crm/opportunities' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState
          :icon="FileX"
          title="Opportunity tidak ditemukan"
          :description="`Opportunity dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
        >
          <Button @click="router.push('/crm/opportunities')">Kembali ke Daftar Opportunity</Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('crm')" module-label="modul CRM" />

    <template v-else>
      <PageHeader
        :title="opportunity.title"
        :breadcrumb="[{ label: 'CRM', to: '/crm' }, { label: 'Opportunities', to: '/crm/opportunities' }, { label: opportunity.title }]"
      >
        <template #actions>
          <StatusBadge :label="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).label" :tone="findStatusOption(OPPORTUNITY_STAGES, opportunity.stage).tone" />
        </template>
      </PageHeader>

      <SectionCard>
        <DetailMetadataList :items="summaryMetadata" />
        <div class="mt-4 pt-4 border-t border-border">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Service Scope</p>
          <div class="flex flex-wrap gap-2 mb-4">
            <StatusBadge
              v-for="type in SERVICE_TYPES.filter(t => opportunity!.serviceScope.includes(t.value))"
              :key="type.value"
              :label="type.label"
              :tone="type.tone"
            />
          </div>
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Requirement</p>
          <p class="text-sm text-foreground">{{ opportunity.requirementNotes || 'Requirement belum digali.' }}</p>
        </div>
      </SectionCard>

      <!-- Stage Stepper -->
      <SectionCard title="Stage Opportunity">
        <div v-if="opportunity.stage !== 'lost'" class="flex flex-wrap items-center gap-2 mb-4">
          <template v-for="(stage, index) in MAIN_STAGES" :key="stage">
            <StatusBadge
              :label="findStatusOption(OPPORTUNITY_STAGES, stage).label"
              :tone="index <= currentStageIndex ? findStatusOption(OPPORTUNITY_STAGES, stage).tone : 'neutral'"
            />
            <span v-if="index < MAIN_STAGES.length - 1" class="text-muted-foreground text-xs">→</span>
          </template>
          <template v-if="opportunity.stage === 'on-hold'">
            <span class="text-muted-foreground text-xs">↳</span>
            <StatusBadge label="On Hold" tone="warning" />
          </template>
        </div>
        <p v-else class="text-sm text-destructive mb-4">Lost — {{ opportunity.lostReason }}</p>

        <div v-if="opportunity.stage === 'won' && opportunity.projectId" class="mb-4">
          <NuxtLink :to="`/projects/${opportunity.projectId}`" class="text-sm text-primary hover:underline">
            Lihat Project hasil konversi ({{ opportunity.projectId }}) →
          </NuxtLink>
        </div>
        <template v-else-if="opportunity.stage === 'won-requested'">
          <div v-if="!canApproveOpportunity" class="mb-4">
            <p class="text-sm text-muted-foreground">Menunggu approval Management/Super Admin.</p>
          </div>
          <div v-else class="mb-4 space-y-3">
            <div v-if="missingRequirements.length > 0" class="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p class="text-sm font-medium text-warning">Belum bisa di-approve — requirement berikut belum lengkap:</p>
              <ul class="mt-1 text-xs text-muted-foreground list-disc list-inside">
                <li v-for="item in missingRequirements" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <Dialog v-model:open="isApproveDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm">Approve Won</Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Approve Opportunity Won</DialogTitle>
                    <DialogDescription>
                      Project baru akan otomatis dibuat dari opportunity ini (destinasi {{ opportunity.destination }},
                      {{ opportunity.travelerEstimate }} pax<template v-if="party?.lifecycleStatus === 'prospect'">, dan {{ party?.name }} akan berubah status menjadi Client</template>).
                      Aksi ini tidak dapat dibatalkan pada mockup ini.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" @click="isApproveDialogOpen = false">Batal</Button>
                    <Button @click="submitApprove">Approve dan Buat Project</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog v-model:open="isRejectDialogOpen">
                <DialogTrigger as-child>
                  <Button size="sm" variant="outline">Reject</Button>
                </DialogTrigger>
                <DialogContent class="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Reject Approval Won</DialogTitle>
                    <DialogDescription>Opportunity akan kembali ke stage Negotiation dengan catatan.</DialogDescription>
                  </DialogHeader>
                  <div class="space-y-1.5 py-2">
                    <Label for="reject-note">Catatan</Label>
                    <Input id="reject-note" v-model="rejectNoteInput" placeholder="mis. Nilai quotation perlu ditinjau ulang" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isRejectDialogOpen = false">Batal</Button>
                    <Button variant="destructive" :disabled="!rejectNoteInput.trim()" @click="submitReject">Reject</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </template>

        <div v-if="canManageOpportunity" class="flex flex-wrap gap-2">
          <Button v-if="opportunity.stage === 'draft'" size="sm" @click="goToNextSimpleStage('qualification')">Lanjut ke Qualification</Button>
          <Button v-if="opportunity.stage === 'qualification'" size="sm" @click="goToNextSimpleStage('requirement-gathering')">Lanjut ke Requirement Gathering</Button>
          <Button v-if="opportunity.stage === 'requirement-gathering'" size="sm" @click="openProposalDialog">Lanjut ke Proposal (Siapkan Quotation)</Button>
          <Button v-if="opportunity.stage === 'proposal'" size="sm" @click="goToNextSimpleStage('negotiation')">Lanjut ke Negotiation</Button>

          <template v-if="opportunity.stage === 'negotiation'">
            <Button
              size="sm"
              :disabled="quotation?.approvalStatus !== 'approved'"
              :title="quotation?.approvalStatus !== 'approved' ? 'Quotation harus disetujui (Commercial Approval) sebelum diajukan sebagai Won' : undefined"
              @click="goToNextSimpleStage('won-requested')"
            >Ajukan sebagai Won</Button>
            <p v-if="quotation?.approvalStatus !== 'approved'" class="text-xs text-muted-foreground basis-full">
              Quotation harus melalui Commercial Approval (lihat section di bawah) sebelum dapat diajukan sebagai Won.
            </p>
            <Button size="sm" variant="outline" @click="goToNextSimpleStage('on-hold')">Tahan (On Hold)</Button>
            <Dialog v-model:open="isLostDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm" variant="destructive">Tandai Lost</Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Tandai Opportunity sebagai Lost</DialogTitle>
                  <DialogDescription>Aksi ini bersifat final (terminal) untuk mockup ini.</DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="lost-reason">Alasan</Label>
                  <Input id="lost-reason" v-model="lostReasonInput" placeholder="mis. Budget internal client dipotong" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isLostDialogOpen = false">Batal</Button>
                  <Button variant="destructive" :disabled="!lostReasonInput.trim()" @click="submitLost">Tandai Lost</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </template>

          <Button v-if="opportunity.stage === 'on-hold'" size="sm" @click="goToNextSimpleStage('negotiation')">Lanjutkan Kembali</Button>
        </div>

        <Dialog v-model:open="isProposalDialogOpen">
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle>Siapkan Quotation Awal</DialogTitle>
              <DialogDescription>Masukkan nilai quotation untuk melanjutkan opportunity ini ke stage Proposal.</DialogDescription>
            </DialogHeader>
            <div class="space-y-1.5 py-2">
              <Label for="proposal-amount">Nilai Quotation (Rp)</Label>
              <Input id="proposal-amount" v-model.number="proposalQuotationAmount" type="number" placeholder="mis. 100000000" />
            </div>
            <DialogFooter>
              <Button variant="outline" @click="isProposalDialogOpen = false">Batal</Button>
              <Button :disabled="!proposalQuotationAmount || proposalQuotationAmount <= 0" @click="submitProposal">Simpan dan Lanjut</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SectionCard>

      <!-- Quotation -->
      <SectionCard title="Quotation">
        <template v-if="canManageOpportunity && quotation && !['won', 'lost'].includes(opportunity.stage)" #actions>
          <Dialog v-model:open="isReviseDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline" @click="openReviseDialog">Revisi Quotation</Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Revisi Quotation</DialogTitle>
                <DialogDescription>Nilai lama akan tersimpan sebagai versi sebelumnya.</DialogDescription>
              </DialogHeader>
              <div class="space-y-1.5 py-2">
                <Label for="revise-amount">Nilai Quotation Baru (Rp)</Label>
                <Input id="revise-amount" v-model.number="revisedAmount" type="number" />
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isReviseDialogOpen = false">Batal</Button>
                <Button :disabled="!revisedAmount || revisedAmount <= 0" @click="submitRevise">Simpan Revisi</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>

        <div v-if="quotation" class="space-y-2">
          <div class="flex items-center gap-2">
            <p class="text-2xl font-bold text-foreground">{{ formatCurrencyIdr(quotation.amountIdr) }}</p>
            <StatusBadge :label="`Versi ${quotation.version}`" tone="info" />
            <StatusBadge v-if="quotation.accepted" label="Accepted" tone="success" />
          </div>
          <p v-if="quotation.supersededAmountIdr" class="text-xs text-muted-foreground">
            Direvisi dari {{ formatCurrencyIdr(quotation.supersededAmountIdr) }}
          </p>
          <p class="text-xs text-muted-foreground">Dibuat {{ formatDate(quotation.createdAt) }}</p>
        </div>
        <EmptyState v-else title="Belum ada quotation" description="Quotation akan dibuat saat opportunity ini lanjut ke stage Proposal." />
      </SectionCard>

      <!-- Commercial Approval (Prompt 19 — Change Request) -->
      <SectionCard v-if="quotation" title="Commercial Approval" description="Workflow: Draft → Submitted for Approval → Approved by Management → Negotiation / Final Confirmation → Opportunity Won.">
        <div class="flex items-center gap-2 mb-4">
          <StatusBadge
            :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').label"
            :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, quotation.approvalStatus ?? 'draft').tone"
          />
          <span v-if="quotation.approvedBy" class="text-xs text-muted-foreground">
            oleh {{ getUserById(quotation.approvedBy)?.name ?? quotation.approvedBy }}
          </span>
        </div>
        <p v-if="quotation.approvalNote" class="text-sm text-muted-foreground mb-4">Catatan: {{ quotation.approvalNote }}</p>

        <div v-if="canManageOpportunity && (quotation.approvalStatus ?? 'draft') === 'draft'">
          <Dialog v-model:open="isSubmitApprovalDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm">Submit for Approval</Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Quotation for Approval</DialogTitle>
                <DialogDescription>Quotation {{ formatCurrencyIdr(quotation.amountIdr) }} akan diajukan ke Management untuk commercial approval.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" @click="isSubmitApprovalDialogOpen = false">Batal</Button>
                <Button @click="submitForCommercialApproval">Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div v-else-if="quotation.approvalStatus === 'submitted'">
          <p v-if="!canApproveCommercial" class="text-sm text-muted-foreground">Menunggu commercial approval dari Management/Super Admin.</p>
          <div v-else class="flex flex-wrap gap-2">
            <Dialog v-model:open="isApproveCommercialDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm">Approve Commercial</Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Approve Commercial Terms</DialogTitle>
                  <DialogDescription>
                    Meninjau nilai quotation {{ formatCurrencyIdr(quotation.amountIdr) }}, discount, estimated margin, payment terms, service scope,
                    kompleksitas project, dan commercial risk. Setelah disetujui, AE dapat melanjutkan ke Negotiation / mengajukan sebagai Won.
                  </DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="approve-commercial-note">Catatan (opsional)</Label>
                  <Input id="approve-commercial-note" v-model="commercialNoteInput" placeholder="mis. Disetujui sesuai standar margin" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isApproveCommercialDialogOpen = false">Batal</Button>
                  <Button @click="submitApproveCommercial">Approve</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog v-model:open="isRejectCommercialDialogOpen">
              <DialogTrigger as-child>
                <Button size="sm" variant="outline">Reject Commercial</Button>
              </DialogTrigger>
              <DialogContent class="max-w-md">
                <DialogHeader>
                  <DialogTitle>Reject Commercial Terms</DialogTitle>
                  <DialogDescription>AE perlu merevisi quotation sebelum submit ulang.</DialogDescription>
                </DialogHeader>
                <div class="space-y-1.5 py-2">
                  <Label for="reject-commercial-note">Catatan</Label>
                  <Input id="reject-commercial-note" v-model="commercialNoteInput" placeholder="mis. Margin terlalu rendah, revisi harga" />
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="isRejectCommercialDialogOpen = false">Batal</Button>
                  <Button variant="destructive" :disabled="!commercialNoteInput.trim()" @click="submitRejectCommercial">Reject</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div v-else-if="quotation.approvalStatus === 'rejected'" class="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p class="text-sm text-destructive">Ditolak — revisi quotation lalu submit ulang untuk approval.</p>
        </div>

        <p v-else-if="quotation.approvalStatus === 'approved'" class="text-sm text-success">
          Disetujui — AE dapat mengajukan opportunity ini sebagai Won pada stage Negotiation.
        </p>
      </SectionCard>

      <!-- Activity / Follow-up -->
      <SectionCard title="Activity / Follow-up">
        <template v-if="canManageOpportunity" #actions>
          <Dialog v-model:open="isActivityDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" variant="outline"><Plus class="h-4 w-4 mr-1.5" />Catat Activity</Button>
            </DialogTrigger>
            <DialogContent class="max-w-md">
              <DialogHeader>
                <DialogTitle>Catat Activity Baru</DialogTitle>
                <DialogDescription>Activity akan dicatat untuk opportunity ini dan tampil juga di Party Detail.</DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-2">
                <div class="space-y-1.5">
                  <Label for="opp-activity-type">Jenis Activity</Label>
                  <select
                    id="opp-activity-type"
                    v-model="activityType"
                    class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option v-for="type in PARTY_ACTIVITY_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <Label for="opp-activity-message">Catatan</Label>
                  <Input id="opp-activity-message" v-model="activityMessage" placeholder="mis. Follow-up keputusan quotation" />
                </div>
                <div class="space-y-1.5">
                  <Label for="opp-activity-due">Jadwal Follow-up Mendatang (opsional)</Label>
                  <Input id="opp-activity-due" v-model="activityDueAt" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" @click="isActivityDialogOpen = false">Batal</Button>
                <Button :disabled="!activityMessage.trim()" @click="submitActivity">Simpan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </template>

        <ul class="divide-y divide-border">
          <li v-for="activity in activities" :key="activity.id" class="py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-foreground">{{ activity.message }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatDate(activity.createdAt) }}<template v-if="activity.dueAt"> · Follow-up dijadwalkan {{ formatDate(activity.dueAt) }}</template>
              </p>
            </div>
            <StatusBadge
              :label="findStatusOption(PARTY_ACTIVITY_TYPES, activity.type).label"
              :tone="findStatusOption(PARTY_ACTIVITY_TYPES, activity.type).tone"
            />
          </li>
        </ul>
        <EmptyState v-if="activities.length === 0" title="Belum ada activity untuk opportunity ini" />
      </SectionCard>
    </template>
  </div>
</template>
