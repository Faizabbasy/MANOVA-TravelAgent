<script setup lang="ts">
import { Plus, Receipt } from 'lucide-vue-next'
import { CATEGORY_LABEL, PROJECT_EXPENSE_CATEGORIES } from '~/lib/finance/labels'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'

/**
 * Pengeluaran tab of a project (V2 layout): field costs posted as real expenses on the server, so they leave
 * a bank account and count in the project's actual cost. Only Finance and Super Admin record them
 * (`finance.post-cash`); the tab itself is hidden from Admin by the page.
 */
const props = defineProps<{ projectId: string }>()

const api = useApi()
const session = useServerSession()
const today = todayJakarta()
const recordOpen = ref(false)

/** Every expense of the project since the start of the books, newest first (server statement order). */
const expenses = useFinanceQuery(
  async () => await api.finance.statement({ projectId: props.projectId, kind: 'expense', from: '2000-01-01', to: today, limit: 100 }),
  { watch: [() => props.projectId] }
)
const rows = computed(() => (expenses.data.value?.data ?? []).filter(m => !m.reversalOfId && !m.reversedById))
const totalMinor = computed(() => rows.value.reduce((sum, m) => sum + BigInt(m.amountMinor), 0n).toString())
const canRecord = computed(() => session.can('finance.post-cash'))
</script>

<template>
  <SectionCard compact title-class="text-sm font-bold normal-case tracking-normal text-foreground" title="Pengeluaran Project" description="Biaya lapangan (transport, konsumsi, perlengkapan, dll) yang dibayar dari rekening perusahaan dan ikut Actual Cost project.">
    <template v-if="canRecord" #actions>
      <Button size="sm" @click="recordOpen = true">
        <Plus class="mr-1 h-3.5 w-3.5" />Catat Pengeluaran
      </Button>
    </template>

    <div v-if="!expenses.loaded.value && !expenses.error.value" class="space-y-2" role="status" aria-label="Memuat pengeluaran">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-muted" />
    </div>
    <FinanceErrorState v-else-if="expenses.error.value && !expenses.data.value" :error="expenses.error.value" compact @retry="expenses.refresh" />
    <EmptyState v-else-if="!rows.length" :icon="Receipt" title="Belum ada pengeluaran project tercatat" size="compact" />
    <template v-else>
      <ul class="divide-y divide-border">
        <li v-for="m in rows" :key="m.id" class="flex items-center justify-between gap-3 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">
              {{ m.memo || m.counterparty || CATEGORY_LABEL[m.category ?? 'other'] }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ CATEGORY_LABEL[m.category ?? 'other'] }} · {{ formatBusinessDate(m.effectiveDate, { short: true, today }) }} · {{ m.account.code }}
            </p>
          </div>
          <FinanceAmount :value="m.amountMinor" direction="out" class="shrink-0 text-sm font-semibold" />
        </li>
      </ul>
      <div class="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
        <span class="text-xs text-muted-foreground">Total pengeluaran</span>
        <FinanceAmount :value="totalMinor" class="text-sm font-bold" />
      </div>
    </template>

    <FinanceManualTransactionDialog v-model:open="recordOpen" kind="expense" :project-id="projectId" :categories="PROJECT_EXPENSE_CATEGORIES" />
  </SectionCard>
</template>
