<script setup lang="ts">
import { ChevronRight, Undo2 } from 'lucide-vue-next'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'
import { refundTag, subjectLabel } from '~/lib/finance/refunds'

/**
 * Refund cases from cancellations, as operations sees them (Changes screen): who, what was cancelled, when, and
 * where the refund stands — never amounts (the server sends Admin the status view). Finance opens the case in
 * Finance › Refund & Pembatalan.
 */
const api = useApi()
const session = useServerSession()
const today = todayJakarta()
const cases = useFinanceQuery(async () => (await api.finance.refundStatuses({ view: 'all', limit: 100 })).data)
const isFinance = computed(() => session.can('finance.view-cash'))
const hidden = computed(() => ['offline', 'signed-out'].includes(session.state.value.status) || !!cases.error.value?.isForbidden)
</script>

<template>
  <ClientOnly>
    <SectionCard v-if="!hidden" flush>
      <template #header>
        <div>
          <p class="text-[0.9375rem] font-semibold leading-6">
            Refund dari pembatalan
          </p>
          <p class="mt-1 text-sm text-muted-foreground">
            Dibuat otomatis saat booking atau project dibatalkan. Nominal dihitung, disetujui, dan dibayar oleh tim Finance.
          </p>
        </div>
      </template>
      <FinanceErrorState v-if="cases.error.value && !cases.data.value" :error="cases.error.value" compact @retry="cases.refresh" />
      <div v-else-if="!cases.loaded.value" class="space-y-2 p-4">
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-muted" />
      </div>
      <EmptyState v-else-if="!cases.data.value?.length" :icon="Undo2" title="Belum ada refund" description="Refund muncul di sini setelah booking atau project dibatalkan." size="compact" />
      <ul v-else class="divide-y divide-border border-t border-border">
        <li v-for="r in cases.data.value" :key="r.id">
          <component
            :is="isFinance ? 'NuxtLink' : 'div'"
            :to="isFinance ? `/finance/refunds?tab=${r.status === 'requested' ? 'requested' : r.status === 'rejected' ? 'rejected' : r.settlement === 'settled' || r.settlement === 'none' ? 'settled' : 'to_pay'}` : undefined"
            class="flex items-center gap-4 px-5 py-3"
            :class="isFinance && 'transition-colors hover:bg-muted/40'"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ r.party.name }} <span class="font-normal text-muted-foreground">· {{ r.id }}</span>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ r.project.name }} · {{ subjectLabel(r.subject) }} · batal {{ formatBusinessDate(r.cancelDate, { short: true, today }) }}
              </p>
            </div>
            <StatusBadge v-bind="refundTag(r)" />
            <ChevronRight v-if="isFinance" class="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </component>
        </li>
      </ul>
    </SectionCard>
  </ClientOnly>
</template>
