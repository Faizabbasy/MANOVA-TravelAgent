<script setup lang="ts">
import { formatMoneyMinor } from '~/lib/money'
import { upsertServerProject } from '~/data/projects-sync'

/**
 * Finance corrects a project's contract value (ADR-007: owned by Project, set at creation). The server refuses
 * a value below what is already billed; the reason is kept in the audit trail.
 */
const props = defineProps<{ open: boolean; projectId: string; currentMinor: string | null; billedMinor: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const api = useApi()
const { showToast } = useToast()
const form = reactive({ amount: '', reason: '' })

watch(() => props.open, (open) => {
  if (!open) { return }
  action.reset()
  Object.assign(form, { amount: props.currentMinor ?? '', reason: '' })
})

const belowBilled = computed(() => !!form.amount && BigInt(form.amount) < BigInt(props.billedMinor))
const action = useFinanceAction(() => api.core.setContractValue(props.projectId, { contractValueMinor: form.amount, reason: form.reason.trim() }))

async function submit () {
  const res = await action.run()
  if (!res) { return }
  upsertServerProject(res.data)
  showToast('Nilai kontrak diperbarui', `${props.projectId}: ${formatMoneyMinor(form.amount)}.`)
  emit('update:open', false)
}
</script>

<template>
  <FinanceFormDialog
    :open="open"
    title="Ubah nilai kontrak"
    :description="`Sudah ditagih ${formatMoneyMinor(billedMinor)}. Nilai kontrak tidak boleh di bawah angka itu.`"
    submit-label="Simpan"
    :pending="action.pending.value"
    :error="action.error.value"
    :submit-disabled="!form.amount || !form.reason.trim() || belowBilled"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="grid gap-4">
      <FinanceField id="cv-amount" label="Nilai kontrak baru" :error="action.fieldError('contractValueMinor')">
        <FinanceMoneyInput id="cv-amount" v-model="form.amount" :invalid="belowBilled || !!action.fieldError('contractValueMinor')" />
        <p v-if="belowBilled" class="mt-1 text-xs font-medium text-destructive" role="alert">
          Di bawah yang sudah ditagih.
        </p>
      </FinanceField>
      <FinanceField id="cv-reason" label="Alasan perubahan" :error="action.fieldError('reason')" hint="Tercatat di audit trail.">
        <FinanceTextarea id="cv-reason" v-model="form.reason" :rows="3" maxlength="500" />
      </FinanceField>
    </div>
  </FinanceFormDialog>
</template>
