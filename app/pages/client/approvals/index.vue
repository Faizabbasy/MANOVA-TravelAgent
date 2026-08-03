<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, ClipboardCheck } from 'lucide-vue-next'
import { getClientApprovalsByParty, getProjectById } from '~/data'
import { APPROVAL_STATUSES, APPROVAL_ENTITY_TYPES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { isApprovalExpired } from '~/utils/attention'

/**
 * Approval Center — List (Repair Phase Section 3 — Request & Commercial). Menggantikan `ModulePlaceholder`
 * Section 1. Tab "Expired" adalah derivasi (`isApprovalExpired`), BUKAN filter `status` tersimpan — approval
 * yang expired tetap `status: 'pending'` sampai diputuskan, hanya ditandai secara tampilan.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Approval Center' })

const { canView, clientScopeId } = usePermissions()

type TabKey = 'pending' | 'approved' | 'rejected' | 'revision-requested' | 'expired'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'revision-requested', label: 'Revision Requested' },
  { key: 'expired', label: 'Expired' }
]
const activeTab = ref<TabKey>('pending')
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
  if (activeTab.value === 'expired') {
    result = result.filter(item => isApprovalExpired(item))
  } else {
    result = result.filter(item => item.status === activeTab.value && !isApprovalExpired(item))
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
    <PageHeader
      title="Approval Center"
      description="Persetujuan final itinerary, participant list, rooming list, change request, dan dokumen lain yang membutuhkan keputusan Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Request & Commercial' }, { label: 'Approval Center' }]"
    />

    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          class="rounded-lg border p-3 text-left transition-colors"
          :class="activeTab === tab.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'"
          @click="activeTab = tab.key"
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
