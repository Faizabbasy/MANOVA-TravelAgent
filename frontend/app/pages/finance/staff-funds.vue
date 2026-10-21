<script setup lang="ts">
import { HandCoins, ReceiptText, Undo2, Wallet } from 'lucide-vue-next'
import type { StaffFundsDto } from '~/types/api'
import { formatBusinessDate } from '~/lib/finance/dates'
import { MOVEMENT_LABEL, staffActionAvailable, type StaffAction } from '~/lib/finance/staff-funds'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Kasbon & Bukti Biaya — Finance' })

/**
 * Kasbon dan bukti biaya: who holds company cash, who is owed a reimbursement, and every movement behind it.
 * All figures come from the server (one definition); actions open business forms, never journal entry.
 */
const api = useApi()
const session = useServerSession()
const funds = useFinanceQuery<StaffFundsDto>(async () => (await api.finance.staffFunds()).data)
const evidenceId = ref<string|null>(null)

const dialog = reactive({ open: false, action: 'employee_advance' as StaffAction, employeeId: null as string | null })
function open (action: StaffAction, employeeId: string | null = null) { Object.assign(dialog, { open: true, action, employeeId }) }
const names = computed(() => new Map((funds.data.value?.employees ?? []).map(e => [e.employeeId, e.name])))

const voiding = ref<string | null>(null)
const voidAction = useFinanceAction((reason: string) => api.finance.voidExpenseClaim(voiding.value!, reason))
async function confirmVoid (value: { reason: string }) {
  if (await voidAction.run(value.reason)) { voiding.value = null }
}
</script>

<template>
  <FinancePage title="Kasbon & Bukti Biaya" description="Uang jalan staf, pertanggungjawaban bukti, pengembalian sisa dan reimbursement.">
    <div class="flex flex-wrap gap-2">
      <Button v-if="session.can('finance.post-cash')" size="sm" @click="open('employee_advance')">
        <Wallet class="mr-1.5 h-4 w-4" /> Beri uang jalan
      </Button>
      <Button v-if="session.can('finance.manage-opex')" size="sm" variant="outline" @click="open('expense_claim')">
        <ReceiptText class="mr-1.5 h-4 w-4" /> Catat bukti pengeluaran
      </Button>
    </div>

    <FinanceErrorState v-if="funds.error.value && !funds.data.value" :error="funds.error.value" @retry="funds.refresh" />
    <div v-else-if="!funds.data.value" class="h-32 animate-pulse rounded-xl bg-muted" />
    <template v-else>
      <section class="rounded-xl border border-border bg-card shadow-sm" aria-label="Posisi uang jalan per karyawan">
        <p v-if="!funds.data.value.employees.length" class="px-5 py-8 text-center text-sm text-muted-foreground">
          Belum ada uang jalan atau bukti pengeluaran staf.
        </p>
        <div v-else class="divide-y divide-border">
          <div v-for="e in funds.data.value.employees" :key="e.employeeId" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div class="min-w-0">
              <p class="font-medium">
                {{ e.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                <template v-if="e.heldMinor !== '0'">
                  Masih memegang <FinanceAmount :value="e.heldMinor" class="font-medium text-foreground" />
                </template>
                <template v-else-if="e.owedToEmployeeMinor !== '0'">
                  Perusahaan berutang <FinanceAmount :value="e.owedToEmployeeMinor" class="font-medium text-warning" />
                </template>
                <template v-else>
                  Selesai
                </template>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button v-if="session.can('finance.manage-opex')" size="sm" variant="outline" @click="open('expense_claim', e.employeeId)">
                Bukti
              </Button>
              <Button
                v-if="session.can('finance.post-cash') && staffActionAvailable('employee_advance_return', e)"
                size="sm"
                variant="outline"
                @click="open('employee_advance_return', e.employeeId)"
              >
                <Undo2 class="mr-1.5 h-3.5 w-3.5" /> Sisa kembali
              </Button>
              <Button
                v-if="session.can('finance.post-cash') && staffActionAvailable('employee_reimbursement', e)"
                size="sm"
                @click="open('employee_reimbursement', e.employeeId)"
              >
                <HandCoins class="mr-1.5 h-3.5 w-3.5" /> Bayar reimbursement
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-border bg-card shadow-sm" aria-label="Riwayat uang jalan">
        <h2 class="border-b border-border px-5 py-3 text-[15px] font-semibold">
          Riwayat
        </h2>
        <p v-if="!funds.data.value.movements.length" class="px-5 py-6 text-sm text-muted-foreground">
          Belum ada riwayat.
        </p>
        <div v-else class="divide-y divide-border">
          <div v-for="m in funds.data.value.movements" :key="m.id" class="flex items-center justify-between gap-3 px-5 py-3 text-sm" :class="m.status !== 'recorded' && 'opacity-60'">
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ MOVEMENT_LABEL[m.type] }} · {{ names.get(m.employeeId) ?? m.employeeId }}
                <span v-if="m.status !== 'recorded'" class="text-xs font-normal text-muted-foreground"> · dibatalkan</span>
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ formatBusinessDate(m.date) }}<template v-if="m.evidenceRef">
                  · bukti {{ m.evidenceRef }}
                </template><template v-if="m.projectId">
                  · {{ m.projectId }}
                </template><template v-if="m.note">
                  · {{ m.note }}
                </template>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button v-if="m.type==='expense_claim'" size="sm" variant="outline" @click="evidenceId=m.id">
                Bukti asli
              </Button>
              <FinanceAmount :value="m.amountMinor" :class="m.status !== 'recorded' && 'line-through'" />
              <Button
                v-if="m.type === 'expense_claim' && m.status === 'recorded' && session.can('finance.manage-opex')"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :aria-label="`Batalkan bukti ${m.evidenceRef}`"
                @click="voiding = m.id"
              >
                <Undo2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <FinanceStaffActionDialog v-model:open="dialog.open" :action="dialog.action" :employee-id="dialog.employeeId" :funds="funds.data.value ?? null" />
    <FinanceReasonDialog
      :open="!!voiding"
      title="Batalkan bukti pengeluaran"
      description="Biaya dari bukti ini dibalik dengan jurnal koreksi; uang yang dipegang karyawan bertambah kembali."
      confirm-label="Batalkan bukti"
      tone="destructive"
      :pending="voidAction.pending.value"
      :error="voidAction.error.value"
      @update:open="v => { if (!v) voiding = null }"
      @confirm="confirmVoid"
    />
    <PrivateEvidenceSheet v-model:source-id="evidenceId" source-type="expense_claim" :can-upload="session.can('finance.post-cash')" />
  </FinancePage>
</template>
