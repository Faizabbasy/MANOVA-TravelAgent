<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, ClipboardCheck } from 'lucide-vue-next'
import { getClientApprovalsByParty, getProjectById } from '~/data'
import { APPROVAL_STATUSES, APPROVAL_ENTITY_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isApprovalExpired } from '~/utils/attention'

/**
 * Tab "Approvals" — Menu Client Portal > Request & Approval (Penyederhanaan 7-Role/Menu). Dulu
 * `/client/approvals`, kini tab dalam satu menu bersama Travel Requests/Quotations — logika tidak diubah.
 * Tab internal "Expired" adalah derivasi (`isApprovalExpired`), BUKAN filter `status` tersimpan — approval
 * yang expired tetap `status: 'pending'` sampai diputuskan, hanya ditandai secara tampilan.
 */

const { canView, clientScopeId } = usePermissions()

type ApprovalTabKey = 'pending' | 'approved' | 'rejected' | 'revision-requested' | 'expired'
const APPROVAL_TABS: { key: ApprovalTabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revision-requested', label: 'Revision Requested' },
  { key: 'expired', label: 'Expired' }
]
const activeApprovalTab = ref<ApprovalTabKey>('pending')
const search = ref('')

const approvals = computed(() => (clientScopeId.value ? getClientApprovalsByParty(clientScopeId.value) : []))

const tabCounts = computed(() => ({
  pending: approvals.value.filter(item => item.status === 'pending' && !isApprovalExpired(item)).length,
  approved: approvals.value.filter(item => item.status === 'approved').length,
  rejected: approvals.value.filter(item => item.status === 'rejected').length,
  'revision-requested': approvals.value.filter(item => item.status === 'revision-requested').length,
  expired: approvals.value.filter(item => isApprovalExpired(item)).length
}))

const filteredApprovals = computed(() => {
  let result = approvals.value
  if (activeApprovalTab.value === 'expired') {
    result = result.filter(item => isApprovalExpired(item))
  } else {
    result = result.filter(item => item.status === activeApprovalTab.value && !isApprovalExpired(item))
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(item => item.entityType.toLowerCase().includes(q) || item.entityId.toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          v-for="tab in APPROVAL_TABS"
          :key="tab.key"
          type="button"
          class="rounded-lg border p-3 text-left transition-colors"
          :class="activeApprovalTab === tab.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'"
          @click="activeApprovalTab = tab.key"
        >
          <p class="text-xs text-muted-foreground">
            {{ tab.label }}
          </p>
          <p class="text-lg font-semibold text-foreground">
            {{ tabCounts[tab.key] }}
          </p>
        </button>
      </div>

      <SectionCard>
        <div class="relative max-w-sm mb-4">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="search" placeholder="Cari jenis atau ID approval..." class="pl-9" />
        </div>

        <ul v-if="filteredApprovals.length" class="divide-y divide-border">
          <li v-for="approval in filteredApprovals" :key="approval.id" class="py-3">
            <NuxtLink :to="`/client/approvals/${approval.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ findStatusOption(APPROVAL_ENTITY_TYPES, approval.entityType).label }} · {{ approval.entityId }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ getProjectById(approval.projectId)?.name ?? approval.projectId }} · Diajukan {{ formatDate(approval.requestedAt) }}
                </p>
              </div>
              <StatusBadge
                :label="isApprovalExpired(approval) ? 'Expired' : findStatusOption(APPROVAL_STATUSES, approval.status).label"
                :tone="isApprovalExpired(approval) ? 'destructive' : findStatusOption(APPROVAL_STATUSES, approval.status).tone"
              />
            </NuxtLink>
          </li>
        </ul>
        <EmptyState v-else :icon="ClipboardCheck" title="Tidak ada approval" description="Approval pada kategori ini akan tampil di sini." />
      </SectionCard>
    </template>
  </div>
</template>
