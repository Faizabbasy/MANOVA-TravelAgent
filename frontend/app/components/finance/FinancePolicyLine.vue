<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
import type { ApiSubjectType } from '~/types/api'

/**
 * The cancellation policy that will apply to this project/booking (a snapshot: later versions never change it).
 * Everyone who may cancel sees it; Finance can set or change it until a cancellation is recorded.
 */
const props = defineProps<{ subjectType: ApiSubjectType; subjectId: string; locked?: boolean }>()

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const data = useFinanceQuery(async () => (await api.finance.subjectPolicy(props.subjectType, props.subjectId)).data,
  { watch: [() => props.subjectType, () => props.subjectId] })
const assignment = computed(() => data.data.value?.assignment ?? null)
const canAssign = computed(() => session.can('finance.manage-policy') && !props.locked)

const open = ref(false)
const chosen = ref<string | null>(null)
watch(open, (v) => { if (v) { chosen.value = data.data.value?.inherited ? null : (assignment.value?.policyId ?? null); assign.reset() } })
const assign = useFinanceAction(() => api.finance.assignPolicy(props.subjectType, props.subjectId, { policyId: chosen.value! }))
async function submit () {
  if (!(await assign.run())) { return }
  open.value = false
  showToast('Kebijakan ditetapkan', 'Dipakai bila booking/project ini dibatalkan.')
}
const hidden = computed(() => !!data.error.value && (data.error.value.isForbidden || data.error.value.isNotFound || data.error.value.status === 0))
</script>

<template>
  <div v-if="!hidden" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
    <span class="flex items-center gap-1.5 text-muted-foreground">
      <ShieldCheck class="h-4 w-4" /> Kebijakan pembatalan
    </span>
    <span v-if="!data.data.value" class="h-5 w-32 animate-pulse rounded bg-muted" />
    <template v-else-if="assignment">
      <Popover>
        <PopoverTrigger as-child>
          <button type="button" class="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:text-primary">
            {{ assignment.snapshot.name }} (v{{ assignment.version }})
          </button>
        </PopoverTrigger>
        <span v-if="data.data.value?.inherited" class="ml-1.5 text-xs text-muted-foreground">mengikuti project</span>
        <PopoverContent align="start" class="w-80 p-3">
          <p class="mb-2 text-xs text-muted-foreground">
            {{ assignment.snapshot.code }} v{{ assignment.version }} — refund dari DP yang sudah diterima
          </p>
          <FinancePolicyTiers :tiers="assignment.snapshot.tiers" compact />
        </PopoverContent>
      </Popover>
    </template>
    <span v-else class="text-muted-foreground">Belum ditetapkan</span>
    <button v-if="canAssign" type="button" class="text-xs font-medium text-primary hover:underline" @click="open = true">
      {{ data.data.value?.inherited ? 'Atur khusus untuk ini' : assignment ? 'Ganti' : 'Tetapkan' }}
    </button>

    <FinanceFormDialog
      v-model:open="open"
      title="Kebijakan pembatalan"
      description="Hanya kebijakan terbit yang berlaku hari ini dan cocok dengan jenis booking yang bisa dipilih. Yang disimpan adalah salinan versinya saat ini."
      submit-label="Tetapkan"
      :pending="assign.pending.value"
      :error="assign.error.value"
      :submit-disabled="!chosen"
      @submit="submit"
    >
      <p v-if="!data.data.value?.assignable.length" class="text-sm text-muted-foreground">
        Belum ada kebijakan terbit yang cocok. Buat dan terbitkan di Finance › Refund & Pembatalan › Kebijakan.
      </p>
      <FinanceField v-else id="pl-policy" label="Kebijakan">
        <FinanceSelect id="pl-policy" v-model="chosen" :options="data.data.value.assignable.map(p => ({ value: p.id, label: `${p.name} (${p.code} v${p.version})` }))" placeholder="Pilih kebijakan" />
      </FinanceField>
      <FinancePolicyTiers v-if="chosen" :tiers="data.data.value?.assignable.find(p => p.id === chosen)?.tiers ?? []" compact />
    </FinanceFormDialog>
  </div>
</template>
