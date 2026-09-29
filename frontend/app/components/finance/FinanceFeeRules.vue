<script setup lang="ts">
import { ArrowRight, Plus } from 'lucide-vue-next'
import { describeFee, FEE_RULE_STATE, feeRuleState } from '~/lib/finance/fee-rules'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'
import type { TransferFeeRuleDto } from '~/types/api'

/**
 * Transfer fees for one account, both directions: "keluar" (this account pays the fee) and "masuk" (the other
 * account pays). The transfer form quotes from these rules; editing needs finance.manage-bank-accounts.
 */
const props = defineProps<{ accountId: string }>()

const api = useApi()
const session = useServerSession()
const lookups = useFinanceLookups(() => true)
const today = todayJakarta()
const rules = useFinanceQuery(async () => (await api.finance.listFeeRules({ accountId: props.accountId })).data, { watch: [() => props.accountId] })

const canManage = computed(() => session.can('finance.manage-bank-accounts'))
const code = (id: string) => lookups.accounts.data.value?.find(a => a.id === id)?.code ?? id
const groups = computed(() => {
  const all = rules.data.value ?? []
  return [
    { key: 'out', title: 'Transfer keluar dari rekening ini', items: all.filter(r => r.fromAccountId === props.accountId) },
    { key: 'in', title: 'Transfer masuk ke rekening ini', items: all.filter(r => r.toAccountId === props.accountId) }
  ].filter(g => g.items.length)
})

const editing = ref<TransferFeeRuleDto | null>(null)
const showDialog = ref(false)
function open (rule: TransferFeeRuleDto | null) {
  editing.value = rule
  showDialog.value = true
}
function period (r: TransferFeeRuleDto) {
  const start = formatBusinessDate(r.effectiveFrom, { short: true })
  return r.effectiveTo ? `${start} – ${formatBusinessDate(r.effectiveTo, { short: true })}` : `mulai ${start}`
}
</script>

<template>
  <SectionCard title="Biaya transfer" description="Biaya bank per arah transfer. Saat mencatat transfer, biayanya terisi otomatis dari aturan ini." flush>
    <template v-if="canManage" #actions>
      <Button variant="outline" size="sm" @click="open(null)">
        <Plus class="mr-1.5 h-4 w-4" /> Tambah aturan
      </Button>
    </template>

    <FinanceErrorState v-if="rules.error.value && !rules.data.value" :error="rules.error.value" class="m-4" @retry="rules.refresh" />
    <div v-else-if="!rules.data.value" class="mx-5 mb-5 h-16 animate-pulse rounded-lg bg-muted" />
    <p v-else-if="!groups.length" class="px-5 pb-5 text-sm text-muted-foreground">
      Belum ada aturan. Tanpa aturan, biaya transfer diisi manual setiap kali.
    </p>
    <div v-else class="divide-y divide-border border-t border-border">
      <section v-for="g in groups" :key="g.key" :aria-label="g.title">
        <h3 class="bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground">
          {{ g.title }}
        </h3>
        <ul class="divide-y divide-border">
          <li v-for="r in g.items" :key="r.id" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-1.5 text-sm font-medium">
                {{ code(r.fromAccountId) }} <ArrowRight class="h-3.5 w-3.5 text-muted-foreground" aria-label="ke" /> {{ code(r.toAccountId) }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ describeFee(r) }} · {{ period(r) }}<template v-if="r.note">
                  · {{ r.note }}
                </template>
              </p>
            </div>
            <StatusBadge :label="FEE_RULE_STATE[feeRuleState(r, today)].label" :tone="FEE_RULE_STATE[feeRuleState(r, today)].tone" />
            <Button v-if="canManage" variant="ghost" size="sm" :aria-label="`Ubah aturan ${code(r.fromAccountId)} ke ${code(r.toAccountId)}`" @click="open(r)">
              Ubah
            </Button>
          </li>
        </ul>
      </section>
    </div>

    <FinanceFeeRuleDialog v-model:open="showDialog" :rule="editing" :from-account-id="accountId" />
  </SectionCard>
</template>
