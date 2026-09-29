<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { ApiBookingType, CancellationPolicyDto } from '~/types/api'
import { todayJakarta } from '~/lib/finance/dates'
import { thresholdProblems, thresholdsFromTiers, tierLabel, tiersFromThresholds } from '~/lib/finance/policy'

/**
 * Create a cancellation policy or edit a draft. Tiers are entered as "from H-x days" thresholds, so the result
 * is always contiguous (no gaps, no overlaps) and always covers departure day and after. Saved as a draft;
 * publishing (from the list) freezes it.
 */
const props = defineProps<{ open: boolean; policy?: CancellationPolicyDto | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const today = todayJakarta()
const isEdit = computed(() => !!props.policy)

interface Band { key: number; from: number | null; refund: number }
let bandKey = 0
const form = reactive({ code: '', name: '', description: '', bookingType: null as string | null, effectiveFrom: today, effectiveTo: '' })
/** Farthest from departure first. The last band (no `from`) = the rest down to departure day and after. */
const bands = ref<Band[]>([])

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  const p = props.policy
  Object.assign(form, {
    code: p?.code ?? '',
    name: p?.name ?? '',
    description: p?.description ?? '',
    bookingType: p?.bookingType ?? null,
    effectiveFrom: p?.effectiveFrom ?? today,
    effectiveTo: p?.effectiveTo ?? ''
  })
  const { thresholds, refunds } = p ? thresholdsFromTiers(p.tiers) : { thresholds: [30, 14, 7, 1], refunds: [100, 50, 30, 0, 0] }
  bands.value = refunds.map((r, i) => ({ key: ++bandKey, from: i < thresholds.length ? thresholds[i]! : null, refund: r }))
})

const thresholds = computed(() => bands.value.filter(b => b.from !== null).map(b => Number(b.from)))
const refunds = computed(() => bands.value.map(b => Number(b.refund)))
const problems = computed(() => thresholdProblems(thresholds.value, refunds.value))
const preview = computed(() => (problems.value.length || bands.value.length < 2 ? [] : tiersFromThresholds(thresholds.value, refunds.value).map(t => ({ ...t, forfeitBp: 10_000 - t.refundBp }))))

function addBand () {
  // Insert a new threshold above the last bounded band (halfway, at least 1 day apart).
  const last = [...thresholds.value].pop() ?? 1
  const next = Math.max(last - 1, 0)
  bands.value.splice(bands.value.length - 1, 0, { key: ++bandKey, from: next, refund: 0 })
}
function removeBand (key: number) {
  if (bands.value.length <= 2) { return }
  bands.value = bands.value.filter(b => b.key !== key)
}

const typeOptions = [
  { value: 'flight', label: 'Tiket pesawat' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'transport', label: 'Transportasi' },
  { value: 'mice', label: 'MICE' }
]

const action = useFinanceAction(async () => {
  const body = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    bookingType: (form.bookingType as ApiBookingType | null),
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
    tiers: tiersFromThresholds(thresholds.value, refunds.value)
  }
  if (props.policy) { return (await api.finance.updatePolicy(props.policy.id, body)).data }
  return (await api.finance.createPolicy({ ...body, code: form.code.trim().toUpperCase() })).data
})

async function submit () {
  const saved = await action.run()
  if (!saved) { return }
  showToast(isEdit.value ? 'Draft kebijakan disimpan' : 'Kebijakan dibuat sebagai draft', 'Terbitkan agar bisa dipakai. Setelah terbit, perubahan dibuat sebagai versi baru.')
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    :title="isEdit ? `Ubah draft ${policy?.code} v${policy?.version}` : 'Kebijakan pembatalan baru'"
    description="Berapa persen DP yang dikembalikan bila customer membatalkan, menurut jarak hari ke keberangkatan."
    submit-label="Simpan draft"
    size="lg"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.name.trim() || (!isEdit && !form.code.trim()) || problems.length > 0"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
      <FinanceField id="pol-code" label="Kode" :error="action.fieldError('code')" :hint="isEdit ? 'Tidak bisa diubah.' : 'mis. STD-DP'">
        <Input id="pol-code" v-model="form.code" class="h-10 uppercase" maxlength="40" :disabled="isEdit" />
      </FinanceField>
      <FinanceField id="pol-name" label="Nama" :error="action.fieldError('name')">
        <Input id="pol-name" v-model="form.name" class="h-10" maxlength="120" placeholder="mis. Standar DP perjalanan" />
      </FinanceField>
      <FinanceField id="pol-type" label="Berlaku untuk" class="sm:col-span-2" hint="Kosong = semua jenis booking dan pembatalan seluruh project.">
        <FinanceSelect id="pol-type" v-model="form.bookingType" :options="typeOptions" clear-label="Semua jenis & seluruh project" placeholder="Semua jenis & seluruh project" />
      </FinanceField>
      <FinanceField id="pol-from" label="Berlaku mulai" :error="action.fieldError('effectiveFrom')">
        <FinanceDateInput id="pol-from" v-model="form.effectiveFrom" />
      </FinanceField>
      <FinanceField id="pol-to" label="Berlaku sampai" optional :error="action.fieldError('effectiveTo')">
        <FinanceDateInput id="pol-to" v-model="form.effectiveTo" :min="form.effectiveFrom" />
      </FinanceField>
    </div>

    <section class="space-y-2">
      <p class="text-[13px] font-medium">
        Tingkat refund
      </p>
      <ul class="space-y-2">
        <li v-for="(band, i) in bands" :key="band.key" class="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <template v-if="band.from !== null">
            <span class="text-muted-foreground">Mulai H-</span>
            <Input v-model.number="band.from" type="number" step="1" class="h-9 w-20 tabular-nums" :aria-label="`Batas hari baris ${i + 1}`" />
            <span class="text-muted-foreground">{{ i === 0 ? 'atau lebih' : `s/d sebelum H-${bands[i - 1]?.from}` }}</span>
          </template>
          <span v-else class="text-muted-foreground">Kurang dari H-{{ thresholds[thresholds.length - 1] }}, hari keberangkatan & sesudahnya</span>
          <span class="ml-auto flex items-center gap-2">
            <span class="text-muted-foreground">refund</span>
            <Input
              v-model.number="band.refund"
              type="number"
              min="0"
              max="100"
              step="1"
              class="h-9 w-20 text-right tabular-nums"
              :aria-label="`Persen refund baris ${i + 1}`"
            />
            <span class="text-muted-foreground">%</span>
            <Button
              v-if="band.from !== null && bands.length > 2"
              type="button"
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground"
              :aria-label="`Hapus baris ${i + 1}`"
              @click="removeBand(band.key)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
            <span v-else class="h-8 w-8" aria-hidden="true" />
          </span>
        </li>
      </ul>
      <Button type="button" variant="ghost" size="sm" class="-ml-2 text-primary" @click="addBand">
        <Plus class="mr-1 h-4 w-4" /> Tambah tingkat
      </Button>
      <ul v-if="problems.length" class="space-y-1 text-xs font-medium text-destructive" role="alert">
        <li v-for="pr in problems" :key="pr">
          {{ pr }}
        </li>
      </ul>
      <p v-if="action.fieldError('tiers')" class="text-xs font-medium text-destructive">
        {{ action.fieldError('tiers') }}
      </p>
    </section>

    <FinanceField id="pol-desc" label="Catatan untuk tim" optional>
      <FinanceTextarea id="pol-desc" v-model="form.description" :rows="2" maxlength="1000" />
    </FinanceField>

    <template v-if="preview.length" #summary>
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Yang akan dibaca customer
      </p>
      <ul class="space-y-0.5 text-sm">
        <li v-for="t in preview" :key="`${t.minDays}-${t.maxDays}`" class="flex justify-between gap-3">
          <span>{{ tierLabel(t) }}</span><span class="tabular-nums">refund {{ t.refundBp / 100 }}%</span>
        </li>
      </ul>
    </template>
  </FinanceFormDialog>
</template>
