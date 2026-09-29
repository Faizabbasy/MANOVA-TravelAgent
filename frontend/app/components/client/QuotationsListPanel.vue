<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, FileText } from 'lucide-vue-next'
import { getLeadsByParty, getQuotationByLead } from '~/data'
import { QUOTATION_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { QuotationApprovalStatus } from '~/types/quotation'

/**
 * Tab "Quotations" — Menu Client Portal > Request & Approval (Penyederhanaan 7-Role/Menu). Dulu
 * `/client/quotations`, kini tab dalam satu menu bersama Travel Requests/Approvals — logika tidak diubah.
 * Mengagregasi seluruh Quotation company lintas Lead — REUSE `getLeadsByParty`+ `getQuotationByLead`
 * existing (pengganti `getOpportunitiesByParty`/`getQuotationByOpportunity` lama, entitas Opportunity
 * dihapus, lihat komentar desain di `app/types/lead.ts`).
 */

const { canView, clientScopeId } = usePermissions()

const search = ref('')
const statusFilter = ref<'all' | QuotationApprovalStatus>('all')

const rows = computed(() => {
  const leads = clientScopeId.value ? getLeadsByParty(clientScopeId.value) : []
  return leads
    .map(lead => ({ lead, quotation: getQuotationByLead(lead.id) }))
    .filter((row): row is { lead: typeof row.lead; quotation: NonNullable<typeof row.quotation> } => Boolean(row.quotation))
})

const filteredRows = computed(() => {
  let result = rows.value
  if (statusFilter.value !== 'all') { result = result.filter(row => (row.quotation.approvalStatus ?? 'draft') === statusFilter.value) }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(row => (row.lead.title ?? row.lead.companyName ?? row.lead.name ?? '').toLowerCase().includes(q) || (row.lead.destination ?? '').toLowerCase().includes(q))
  }
  return result.sort((a, b) => b.quotation.createdAt.localeCompare(a.quotation.createdAt))
})
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('client-portal')" module-label="Client Portal" />

    <template v-else>
      <SectionCard>
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="search" placeholder="Cari nama lead atau destinasi..." class="pl-9" />
          </div>
          <select v-model="statusFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
            <option value="all">
              Semua Status
            </option>
            <option v-for="option in QUOTATION_APPROVAL_STATUSES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <ul v-if="filteredRows.length" class="divide-y divide-border">
          <li v-for="row in filteredRows" :key="row.quotation.id" class="py-3">
            <NuxtLink :to="`/client/quotations/${row.quotation.id}`" class="flex items-center justify-between gap-3 group">
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground truncate group-hover:underline">
                  {{ row.lead.title ?? row.lead.companyName ?? row.lead.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.lead.destination }} · v{{ row.quotation.version }}
                  <template v-if="row.quotation.sentToClientAt">
                    · Dikirim {{ formatDate(row.quotation.sentToClientAt) }}
                  </template>
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-medium text-foreground">
                  {{ formatCurrencyIdr(row.quotation.amountIdr) }}
                </p>
                <StatusBadge :label="findStatusOption(QUOTATION_APPROVAL_STATUSES, row.quotation.approvalStatus ?? 'draft').label" :tone="findStatusOption(QUOTATION_APPROVAL_STATUSES, row.quotation.approvalStatus ?? 'draft').tone" />
              </div>
            </NuxtLink>
          </li>
        </ul>
        <EmptyState
          v-else
          :icon="FileText"
          :title="rows.length ? 'Tidak ada quotation yang cocok' : 'Belum ada Quotation'"
          :description="rows.length ? 'Coba ubah kata kunci pencarian atau filter status.' : 'Quotation akan tampil di sini setelah Travel Request Anda diproses.'"
        />
      </SectionCard>
    </template>
  </div>
</template>
