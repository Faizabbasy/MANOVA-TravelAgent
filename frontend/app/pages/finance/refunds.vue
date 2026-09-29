<script setup lang="ts">
import { ChevronRight, ClipboardCheck, Copy, FilePlus2, Loader2, Power, Send, ShieldCheck, Trash2, Undo2, Wallet } from 'lucide-vue-next'
import type { CancellationPolicyDto, RefundDto } from '~/types/api'
import { formatBusinessDate, todayJakarta } from '~/lib/finance/dates'
import { refundTag, subjectLabel } from '~/lib/finance/refunds'
import { SUBJECT_LABEL } from '~/lib/finance/policy'
import { cn } from '~/lib/utils'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Refund & Pembatalan — Finance' })

/**
 * Refund cases from cancellations (decide → pay) and the cancellation policies they are computed from.
 * Recording a cancellation happens on the booking/project itself; this is Finance's worklist.
 */
const api = useApi()
const route = useRoute()
const session = useServerSession()
const { showToast } = useToast()
const today = todayJakarta()

type Tab = 'requested' | 'to_pay' | 'settled' | 'rejected' | 'policies'
const TABS: Tab[] = ['requested', 'to_pay', 'settled', 'rejected', 'policies']
const tab = ref<Tab>(TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'requested')
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'requested' ? undefined : t } }, { replace: true }))

const totals = useFinanceQuery(async () => (await api.finance.refunds({ view: 'all', limit: 1 })).meta.summary)

const PAGE = 50
const list = useFinanceQuery(async () => {
  if (tab.value === 'policies') { return { items: [] as RefundDto[], next: null } }
  const res = await api.finance.refunds({ view: tab.value, limit: PAGE })
  return { items: res.data, next: res.meta.pagination.nextCursor }
}, { watch: [tab] })
const more = ref<RefundDto[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
let generation = 0
watch(tab, () => { generation++ })
watch(() => list.data.value, (v) => { generation++; more.value = []; nextCursor.value = v?.next ?? null })
async function loadMore () {
  if (!nextCursor.value || loadingMore.value || tab.value === 'policies') { return }
  loadingMore.value = true
  const mine = generation
  try {
    const res = await api.finance.refunds({ view: tab.value, limit: PAGE, cursor: nextCursor.value })
    if (mine !== generation) { return }
    more.value = [...more.value, ...res.data]
    nextCursor.value = res.meta.pagination.nextCursor
  } finally { loadingMore.value = false }
}
const items = computed(() => [...(list.data.value?.items ?? []), ...more.value])

const policies = useFinanceQuery(async () => (await api.finance.listPolicies()).data, { enabled: () => tab.value === 'policies', watch: [tab] })
/** Latest version per code first; older versions stay visible (cases keep their version). */
const policyGroups = computed(() => {
  const byCode = new Map<string, CancellationPolicyDto[]>()
  for (const p of policies.data.value ?? []) { byCode.set(p.code, [...(byCode.get(p.code) ?? []), p]) }
  return [...byCode.entries()].map(([code, versions]) => ({ code, versions: versions.sort((a, b) => b.version - a.version) }))
})

const tabs = computed(() => [
  { key: 'requested' as Tab, label: 'Perlu diputuskan', count: totals.data.value?.requestedCount },
  { key: 'to_pay' as Tab, label: 'Perlu dibayar', count: totals.data.value?.toPayCount },
  { key: 'settled' as Tab, label: 'Selesai', count: undefined },
  { key: 'rejected' as Tab, label: 'Dibatalkan', count: undefined },
  { key: 'policies' as Tab, label: 'Kebijakan pembatalan', count: undefined }
])

const selected = ref<string | null>(null)
const showPolicy = ref(false)
const editing = ref<CancellationPolicyDto | null>(null)
const deactivating = ref<CancellationPolicyDto | null>(null)
const canManagePolicy = computed(() => session.can('finance.manage-policy'))

const policyCmd = useFinanceAction(async (kind: 'publish' | 'version' | 'delete', p: CancellationPolicyDto) => {
  if (kind === 'publish') { return (await api.finance.publishPolicy(p.id)).data }
  if (kind === 'version') { return (await api.finance.newPolicyVersion(p.id)).data }
  await api.finance.deletePolicy(p.id)
  return p
})
async function runPolicy (kind: 'publish' | 'version' | 'delete', p: CancellationPolicyDto) {
  const res = await policyCmd.run(kind, p)
  if (!res) { showToast('Belum berhasil', policyCmd.error.value?.message ?? 'Coba lagi.', 'error'); return }
  if (kind === 'publish') { showToast('Kebijakan terbit', `${p.code} v${p.version} bisa ditetapkan ke booking/project. Isinya kini terkunci.`) }
  if (kind === 'version') { showToast('Draft versi baru dibuat', `${res.code} v${res.version} — ubah lalu terbitkan. Booking lama tetap memakai versinya.`); editing.value = res; showPolicy.value = true }
  if (kind === 'delete') { showToast('Draft dihapus', `${p.code} v${p.version} dihapus.`) }
}
const deactivate = useFinanceAction((id: string, reason: string) => api.finance.deactivatePolicy(id, reason))
async function confirmDeactivate (value: { reason: string }) {
  if (!deactivating.value || !(await deactivate.run(deactivating.value.id, value.reason))) { return }
  showToast('Kebijakan dinonaktifkan', 'Tidak bisa ditetapkan lagi; kasus yang sudah memakainya tidak berubah.')
  deactivating.value = null
}

const POLICY_STATUS: Record<CancellationPolicyDto['status'], { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  draft: { label: 'Draft', tone: 'warning' },
  published: { label: 'Terbit', tone: 'success' },
  inactive: { label: 'Nonaktif', tone: 'neutral' }
}
</script>

<template>
  <FinancePage
    title="Refund & Pembatalan"
    description="Refund customer dari booking atau project yang dibatalkan, dan kebijakan pembatalan yang dipakai menghitungnya."
    :breadcrumb="[{ label: 'Finance', to: '/finance' }, { label: 'Piutang Customer', to: '/finance/receivables' }, { label: 'Refund & Pembatalan' }]"
  >
    <template #actions>
      <Button v-if="tab === 'policies' && canManagePolicy" @click="editing = null; showPolicy = true">
        <FilePlus2 class="mr-2 h-4 w-4" /> Kebijakan baru
      </Button>
    </template>

    <section class="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Ringkasan refund">
      <button type="button" class="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-chart-5/40" @click="tab = 'requested'">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardCheck class="h-3.5 w-3.5 text-chart-5" /> Menunggu keputusan
        </p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">
          {{ totals.data.value?.requestedCount ?? '…' }}
        </p>
      </button>
      <button type="button" class="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40" @click="tab = 'to_pay'">
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet class="h-3.5 w-3.5 text-primary" /> Refund disetujui, belum dibayar
        </p>
        <FinanceAmount :value="totals.data.value?.toPayMinor ?? null" unavailable-label="…" class="mt-1 block text-2xl font-semibold tracking-tight" />
        <p class="text-xs text-muted-foreground">
          {{ totals.data.value?.toPayCount ?? '…' }} kasus
        </p>
      </button>
      <div class="col-span-2 rounded-xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground lg:col-span-1">
        Pembatalan dicatat dari halaman booking atau project (ubah status ke <span class="font-medium text-foreground">Cancelled</span>). Refund baru keluar dari rekening saat dibayar di sini.
      </div>
    </section>

    <div class="-mx-1 overflow-x-auto px-1">
      <div class="inline-flex min-w-max rounded-lg border border-border bg-card p-0.5 shadow-sm" role="tablist" aria-label="Kelompok refund">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key"
          :class="cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span v-if="t.count !== undefined" :class="cn('rounded-full px-1.5 text-[11px] tabular-nums', tab === t.key ? 'bg-primary-foreground/20' : t.count ? 'bg-chart-5/10 text-chart-5' : 'bg-muted')">{{ t.count }}</span>
        </button>
      </div>
    </div>

    <!-- Policies -->
    <template v-if="tab === 'policies'">
      <FinanceErrorState v-if="policies.error.value && !policies.data.value" :error="policies.error.value" @retry="policies.refresh" />
      <div v-else-if="!policies.loaded.value" class="grid gap-4 md:grid-cols-2">
        <div v-for="i in 2" :key="i" class="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
      <Card v-else-if="!policyGroups.length">
        <EmptyState :icon="ShieldCheck" title="Belum ada kebijakan pembatalan" description="Buat kebijakan (mis. refund 100% bila batal ≥ H-30), terbitkan, lalu tetapkan ke project atau booking.">
          <Button v-if="canManagePolicy" @click="editing = null; showPolicy = true">
            <FilePlus2 class="mr-2 h-4 w-4" /> Kebijakan baru
          </Button>
        </EmptyState>
      </Card>
      <div v-else class="grid gap-4 md:grid-cols-2">
        <article v-for="g in policyGroups" :key="g.code" class="flex flex-col rounded-xl border border-border bg-card shadow-sm">
          <div class="flex items-start justify-between gap-3 p-5 pb-3">
            <div class="min-w-0">
              <p class="truncate text-[15px] font-semibold">
                {{ g.versions[0]!.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ g.code }} · {{ g.versions[0]!.bookingType ? SUBJECT_LABEL[g.versions[0]!.bookingType] : 'Semua jenis & seluruh project' }}
              </p>
            </div>
            <StatusBadge :label="`v${g.versions[0]!.version} · ${POLICY_STATUS[g.versions[0]!.status].label}`" :tone="POLICY_STATUS[g.versions[0]!.status].tone" />
          </div>
          <div class="px-5">
            <FinancePolicyTiers :tiers="g.versions[0]!.tiers" compact />
            <p class="mt-2 text-xs text-muted-foreground">
              Berlaku {{ formatBusinessDate(g.versions[0]!.effectiveFrom) }}{{ g.versions[0]!.effectiveTo ? ` s/d ${formatBusinessDate(g.versions[0]!.effectiveTo)}` : '' }}
              <template v-if="g.versions.length > 1">
                · versi lain: {{ g.versions.slice(1).map(v => `v${v.version} (${POLICY_STATUS[v.status].label.toLowerCase()})`).join(', ') }}
              </template>
            </p>
          </div>
          <div v-if="canManagePolicy" class="mt-auto flex flex-wrap gap-2 border-t border-border px-5 py-3 pt-3">
            <template v-if="g.versions[0]!.status === 'draft'">
              <Button size="sm" :disabled="policyCmd.pending.value" @click="runPolicy('publish', g.versions[0]!)">
                <Send class="mr-1.5 h-4 w-4" /> Terbitkan
              </Button>
              <Button size="sm" variant="outline" @click="editing = g.versions[0]!; showPolicy = true">
                Ubah draft
              </Button>
              <Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" :disabled="policyCmd.pending.value" @click="runPolicy('delete', g.versions[0]!)">
                <Trash2 class="mr-1.5 h-4 w-4" /> Hapus
              </Button>
            </template>
            <template v-else>
              <Button size="sm" variant="outline" :disabled="policyCmd.pending.value" @click="runPolicy('version', g.versions[0]!)">
                <Copy class="mr-1.5 h-4 w-4" /> Buat versi baru
              </Button>
              <Button v-if="g.versions[0]!.status === 'published'" size="sm" variant="ghost" class="text-muted-foreground" @click="deactivate.reset(); deactivating = g.versions[0]!">
                <Power class="mr-1.5 h-4 w-4" /> Nonaktifkan
              </Button>
            </template>
          </div>
        </article>
      </div>
    </template>

    <!-- Cases -->
    <Card v-else class="overflow-clip">
      <FinanceErrorState v-if="list.error.value && !list.data.value" :error="list.error.value" @retry="list.refresh" />
      <div v-else-if="!list.loaded.value" class="space-y-2 p-4">
        <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-lg bg-muted" />
      </div>
      <EmptyState
        v-else-if="!items.length"
        :icon="Undo2"
        :title="tab === 'requested' ? 'Tidak ada refund yang menunggu keputusan' : tab === 'to_pay' ? 'Tidak ada refund yang perlu dibayar' : tab === 'settled' ? 'Belum ada refund selesai' : 'Tidak ada kasus yang dibatalkan'"
      />
      <div v-else :class="list.pending.value && 'opacity-70 transition-opacity'">
        <ul class="divide-y divide-border">
          <li v-for="r in items" :key="r.id">
            <button type="button" class="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 sm:px-5" @click="selected = r.id">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-semibold">
                    {{ r.party.name }}
                  </p>
                  <StatusBadge :label="refundTag(r).label" :tone="refundTag(r).tone" class="max-sm:hidden" />
                </div>
                <p class="truncate text-xs text-muted-foreground">
                  {{ r.project.name }} · {{ subjectLabel(r.subject) }} · batal {{ formatBusinessDate(r.cancelDate, { short: true, today }) }}<template v-if="r.daysBefore !== null">
                    (H-{{ r.daysBefore }})
                  </template>
                </p>
              </div>
              <div class="hidden w-36 shrink-0 text-xs text-muted-foreground sm:block">
                {{ r.calculation === 'manual' ? 'Manual' : `${r.policy?.code} · ${(r.tier?.refundBp ?? 0) / 100}%` }}
              </div>
              <div class="shrink-0 text-right">
                <FinanceAmount :value="r.status === 'approved' ? r.outstandingMinor : r.refundableMinor" class="block text-sm font-semibold" />
                <p class="text-[11px] text-muted-foreground">
                  {{ r.status === 'approved' ? (r.settlement === 'settled' ? 'lunas' : 'sisa refund') : r.calculation === 'manual' && r.status === 'requested' ? 'usulan' : 'refund' }}
                </p>
              </div>
              <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <div v-if="nextCursor" class="border-t border-border p-3 text-center">
          <Button variant="ghost" size="sm" :disabled="loadingMore" @click="loadMore">
            <Loader2 v-if="loadingMore" class="mr-2 h-4 w-4 animate-spin" /> Muat lebih banyak
          </Button>
        </div>
      </div>
    </Card>

    <FinanceRefundSheet v-model:refund-id="selected" />
    <FinancePolicyDialog v-model:open="showPolicy" :policy="editing" />
    <FinanceReasonDialog
      :open="!!deactivating"
      :title="`Nonaktifkan ${deactivating?.code ?? ''} v${deactivating?.version ?? ''}?`"
      description="Kebijakan tidak bisa ditetapkan lagi ke booking/project baru. Booking yang sudah memakainya dan kasus yang sudah tercatat tidak berubah."
      confirm-label="Nonaktifkan"
      tone="destructive"
      :pending="deactivate.pending.value"
      :error="deactivate.error.value"
      @update:open="v => { if (!v) deactivating = null }"
      @confirm="confirmDeactivate"
    />
  </FinancePage>
</template>
