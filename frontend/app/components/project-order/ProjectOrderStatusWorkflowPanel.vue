<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileText, Send, PauseCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { PROJECT_ORDER_STEPS } from '~/data/project-order-workflow'
import { PROJECT_STATUSES, findStatusOption } from '~/constants/status'
import type { Project, ProjectStatus } from '~/types/project'
import type { ProjectOrderStepView } from '~/types/project-order'

const props = defineProps<{
  project: Project
  steps: ProjectOrderStepView[]
  currentStep: ProjectOrderStepView | undefined
  lateralTransitions: ProjectStatus[]
  canAdvance: boolean
}>()

const emit = defineEmits<{
  advance: []
  lateral: [payload: { status: ProjectStatus; reason: string }]
}>()

const isFlowOpen = ref(false)

const statusOption = computed(() => findStatusOption(PROJECT_STATUSES, props.project.status))
const isClosed = computed(() => Boolean(props.project.closedAt))
const gateReady = computed(() => props.currentStep?.gate.ready ?? false)

/** Ringkasan alur 6 step sebagai teks — sama seperti panel referensi, agar user paham peta besarnya. */
const flowText = computed(() => PROJECT_ORDER_STEPS.map(step => step.label).join(' → '))

const LATERAL_META: Record<string, { label: string; icon: typeof PauseCircle }> = {
  'on-hold': { label: 'Tahan Sementara (On Hold)', icon: PauseCircle },
  cancelled: { label: 'Batalkan Project Order', icon: XCircle }
}

const pendingLateral = ref<ProjectStatus | undefined>()
const lateralReason = ref('')

function openLateral (status: ProjectStatus) {
  pendingLateral.value = status
  lateralReason.value = ''
}

function submitLateral () {
  if (!pendingLateral.value || !lateralReason.value.trim()) { return }
  emit('lateral', { status: pendingLateral.value, reason: lateralReason.value.trim() })
  pendingLateral.value = undefined
  lateralReason.value = ''
}
</script>

<template>
  <SectionCard title="Status Workflow" description="Status saat ini dan aksi yang tersedia.">
    <div class="space-y-4">
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-1.5">
          Status Saat Ini
        </p>
        <div class="flex items-center gap-2">
          <FileText class="h-4 w-4 text-muted-foreground" />
          <span class="text-base font-semibold text-foreground">
            {{ isClosed ? 'Closed' : statusOption.label }}
          </span>
          <StatusBadge v-if="currentStep" :label="`Step ${currentStep.def.index}/6`" :tone="currentStep.gate.ready ? 'primary' : 'destructive'" />
        </div>
        <p v-if="currentStep" class="text-xs text-muted-foreground mt-1.5">
          {{ currentStep.def.description }}
        </p>
      </div>

      <div v-if="!isClosed">
        <p class="text-xs font-medium text-muted-foreground mb-1.5">
          Aksi Berikutnya
        </p>
        <Button
          class="w-full"
          :disabled="!canAdvance || !gateReady"
          @click="emit('advance')"
        >
          <Send class="h-4 w-4 mr-1.5" />
          {{ currentStep?.def.nextActionLabel ?? 'Tidak ada aksi' }}
        </Button>
        <p v-if="!canAdvance" class="text-[11px] text-muted-foreground mt-1.5">
          Anda tidak memiliki wewenang menjalankan transisi step (action flag "Jalankan transisi step Project Order").
        </p>

        <div class="mt-2">
          <ProjectOrderGateList
            :blockers="currentStep?.gate.blockers ?? []"
            :ready-message="`Siap dilanjutkan ke step berikutnya.`"
          />
        </div>
      </div>

      <div v-else class="rounded-lg border border-success/40 bg-success/5 px-3 py-2.5">
        <p class="text-xs text-success">
          Project Order sudah ditutup pada {{ project.closedAt }}. Seluruh alur 6 step selesai.
        </p>
      </div>

      <Separator />

      <div>
        <button
          type="button"
          class="w-full flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          @click="isFlowOpen = !isFlowOpen"
        >
          Alur Status (6 Step)
          <component :is="isFlowOpen ? ChevronUp : ChevronDown" class="h-3.5 w-3.5 ml-auto" />
        </button>

        <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          {{ flowText }}
        </p>

        <div v-if="isFlowOpen" class="mt-3 space-y-2.5">
          <div v-for="step in steps" :key="step.def.key">
            <p class="text-xs font-medium text-foreground">
              {{ step.def.index }}. {{ step.def.label }}
            </p>
            <ul class="mt-0.5 space-y-0.5">
              <li
                v-for="gate in step.def.gates"
                :key="gate.id"
                class="text-[11px] text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0"
              >
                {{ gate.label }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <template v-if="lateralTransitions.length && canAdvance && !isClosed">
        <Separator />
        <div>
          <p class="text-xs font-medium text-muted-foreground mb-1.5">
            Transisi Lateral
          </p>
          <div class="flex flex-col gap-1.5">
            <Button
              v-for="status in lateralTransitions"
              :key="status"
              variant="outline"
              size="sm"
              class="justify-start"
              @click="openLateral(status)"
            >
              <component :is="LATERAL_META[status].icon" class="h-4 w-4 mr-1.5" />
              {{ LATERAL_META[status].label }}
            </Button>
          </div>
        </div>
      </template>
    </div>

    <Dialog :open="Boolean(pendingLateral)" @update:open="value => { if (!value) pendingLateral = undefined }">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ pendingLateral ? LATERAL_META[pendingLateral].label : '' }}</DialogTitle>
          <DialogDescription>
            Alasan wajib diisi — transisi ini berdampak besar dan harus terlihat jejaknya di Activity Log.
          </DialogDescription>
        </DialogHeader>
        <textarea
          v-model="lateralReason"
          rows="3"
          placeholder="Tuliskan alasan..."
          class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <DialogFooter>
          <Button variant="outline" @click="pendingLateral = undefined">
            Batal
          </Button>
          <Button variant="destructive" :disabled="!lateralReason.trim()" @click="submitLateral">
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SectionCard>
</template>
