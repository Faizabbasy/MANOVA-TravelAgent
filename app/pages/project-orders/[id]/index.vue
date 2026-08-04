<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, FileX, ExternalLink } from 'lucide-vue-next'
import { getProjectById, getProjectOrderStatus, updateProjectStatus } from '~/data'
import {
  getProjectOrderStep,
  getProjectOrderStepViews,
  getProjectOrderLateralTransitions,
  getProjectMilestones,
  advanceProjectOrder,
  createProjectNote,
  toggleProjectNotePin,
  setMilestoneActualDate,
  updateMilestonePlannedDate
} from '~/data/project-order-workflow'
import { PROJECT_ORDER_STATUSES, findStatusOption } from '~/constants/status'
import { formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { ProjectStatus } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, canViewFinancials, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

/**
 * Workspace terpusat Project Order (Revisi 9-Modul) — seluruh alur 6 step, dari Drafting sampai
 * Closing & Review, dijalankan dari satu halaman ini tanpa berpindah-pindah modul.
 *
 * `refreshKey` memaksa seluruh derivasi dihitung ulang setelah mutasi. Data layer mock ini memutasi
 * objek `reactive` di tempat, tapi sebagian selector mengembalikan array/objek baru hasil derivasi yang
 * tidak selalu ikut ter-track — menaikkan key adalah cara paling sederhana dan pasti benar di sini.
 */
const refreshKey = ref(0)

const projectId = computed(() => String(route.params.id))
const project = computed(() => {
  void refreshKey.value
  return getProjectById(projectId.value)
})

useHead({ title: computed(() => (project.value ? `${project.value.name} — Project Order` : 'Project Order Tidak Ditemukan')) })

const hasAccess = computed(() => canView('operations'))
const canAdvance = computed(() => can('project-order.advance-step'))
const canManageOperations = computed(() => can('project-order.manage-operations'))
const canClose = computed(() => can('project-order.close'))
const canViewMargin = computed(() => canViewFinancials.value && can('project-order.view-margin'))

const orderStatus = computed(() => (project.value ? findStatusOption(PROJECT_ORDER_STATUSES, getProjectOrderStatus(project.value)) : undefined))
const stepViews = computed(() => {
  void refreshKey.value
  return getProjectOrderStepViews(projectId.value)
})
const currentStep = computed(() => stepViews.value.find(view => view.state === 'current' || view.state === 'blocked'))
const doneStep = computed(() => stepViews.value.find(view => view.def.key === 'done'))
const lateralTransitions = computed(() => {
  void refreshKey.value
  return getProjectOrderLateralTransitions(projectId.value)
})
const milestones = computed(() => {
  void refreshKey.value
  return getProjectMilestones(projectId.value)
})

/** Tanggal rencana dikunci begitu Project Order lewat tahap Drafting — sesuai aturan di panel. */
const plannedDatesLocked = computed(() => (project.value ? getProjectOrderStep(project.value) !== 'drafting' : true))

const activeTab = ref<'overview' | 'financial'>('overview')
const selectedStepKey = ref<string | undefined>()

function refresh () {
  refreshKey.value += 1
}

function onAdvance () {
  const result = advanceProjectOrder(projectId.value, currentUser.value.id)
  refresh()
  if (result.success) {
    showToast('Berhasil', `Project Order lanjut dari step "${currentStep.value?.def.label ?? ''}".`, 'success')
  } else {
    showToast('Belum dapat dilanjutkan', result.blockers[0] ?? 'Syarat step ini belum terpenuhi.', 'error')
  }
}

function onLateral (payload: { status: ProjectStatus; reason: string }) {
  const updated = updateProjectStatus(projectId.value, payload.status, currentUser.value.id, payload.reason)
  refresh()
  if (updated) {
    showToast('Status diperbarui', `Project Order kini berstatus "${payload.status}".`, 'success')
  } else {
    showToast('Gagal', 'Transisi tersebut tidak diizinkan dari status saat ini.', 'error')
  }
}

function onClose (payload: { finalNote: string; clientFeedback: string }) {
  const result = advanceProjectOrder(projectId.value, currentUser.value.id, payload)
  refresh()
  if (result.success) {
    showToast('Project Order Ditutup', 'Laporan akhir tersimpan dan project resmi selesai.', 'success')
  } else {
    showToast('Belum dapat ditutup', result.blockers[0] ?? 'Syarat penutupan belum terpenuhi.', 'error')
  }
}

function onAddNote (body: string) {
  createProjectNote(projectId.value, currentUser.value.id, body)
  refresh()
  showToast('Catatan ditambahkan', 'Catatan internal tersimpan.', 'success')
}

function onTogglePin (noteId: string) {
  toggleProjectNotePin(noteId)
  refresh()
}

function onMarkActual (milestoneId: string) {
  setMilestoneActualDate(milestoneId, DEMO_REFERENCE_DATE)
  refresh()
  showToast('Milestone diperbarui', `Tanggal realisasi diisi ${formatDate(DEMO_REFERENCE_DATE)}.`, 'success')
}

function onUpdatePlanned (payload: { milestoneId: string; plannedDate: string }) {
  updateMilestonePlannedDate(payload.milestoneId, payload.plannedDate)
  refresh()
}
</script>

<template>
  <div class="space-y-5">
    <template v-if="!project">
      <PageHeader title="Project Order Tidak Ditemukan" :breadcrumb="[{ label: 'Project Orders', to: '/project-orders' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="FileX" title="Project Order tidak ditemukan" :description="`Tidak ada Project Order dengan ID '${projectId}' pada data demo.`">
          <Button @click="router.push('/project-orders')">
            Kembali ke Daftar Project Order
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!hasAccess" module-label="modul Operations & Scheduling" />

    <template v-else>
      <!-- Header -->
      <div>
        <NuxtLink to="/project-orders" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft class="h-4 w-4" />
          Kembali ke Project Orders
        </NuxtLink>

        <div class="flex flex-wrap items-start justify-between gap-3 mt-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground font-mono">
              {{ project.id }}
            </h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ project.name }} · dibuat untuk {{ formatDate(project.travelStartDate) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadge v-if="orderStatus" :label="orderStatus.label" :tone="orderStatus.tone" />
            <NuxtLink :to="`/projects/${project.id}`">
              <Button variant="outline" size="sm">
                <ExternalLink class="h-3.5 w-3.5 mr-1.5" />
                Detail Lengkap
              </Button>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Stepper -->
      <SectionCard title="Order Status">
        <ProjectOrderStepper
          :steps="stepViews"
          :selected-step-key="selectedStepKey"
          @select="value => selectedStepKey = selectedStepKey === value ? undefined : value"
        />

        <div v-if="selectedStepKey" class="mt-4 pt-4 border-t border-border">
          <template v-for="view in stepViews.filter(item => item.def.key === selectedStepKey)" :key="view.def.key">
            <p class="text-sm font-medium text-foreground">
              Step {{ view.def.index }} — {{ view.def.label }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5 mb-2">
              {{ view.def.description }}
            </p>
            <ProjectOrderGateList
              :blockers="view.gate.blockers"
              :title="view.state === 'completed' ? 'Catatan step ini' : 'Belum dapat dilanjutkan'"
              ready-message="Seluruh syarat step ini terpenuhi."
            />
          </template>
        </div>
      </SectionCard>

      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="financial">
            Financial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="pt-4">
          <!--
            Refinement UI: Document Folder sebelumnya berada di kolom utama bersebelahan dengan kartu
            ringkasan, membuat kolom kiri jauh lebih pendek dari kolom kanan dan menyisakan ruang kosong
            besar di bawah Timeline. Dokumen adalah bahan rujukan, bukan konten utama — dipindah ke kolom
            kanan. Kartu ringkasan kini selebar penuh sehingga enam faktanya tersusun satu baris rapi.
          -->
          <div class="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
            <div class="space-y-5 xl:col-span-8">
              <ProjectOrderSummaryCard :project="project" />

              <ProjectOrderTimelineTracking
                :project-id="project.id"
                :milestones="milestones"
                :can-manage="canManageOperations"
                :planned-dates-locked="plannedDatesLocked"
                @mark-actual="onMarkActual"
                @update-planned="onUpdatePlanned"
              />

              <ProjectOrderActivityLog :project-id="project.id" />
            </div>

            <div class="space-y-5 xl:col-span-4">
              <ProjectOrderStatusWorkflowPanel
                :project="project"
                :steps="stepViews"
                :current-step="currentStep"
                :lateral-transitions="lateralTransitions"
                :can-advance="canAdvance"
                @advance="onAdvance"
                @lateral="onLateral"
              />

              <ProjectOrderDocumentFolder :project-id="project.id" />

              <ProjectOrderNotesAttachments
                :project-id="project.id"
                :can-manage="canManageOperations"
                @add-note="onAddNote"
                @toggle-pin="onTogglePin"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financial" class="pt-4">
          <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div class="xl:col-span-8 space-y-5">
              <ProjectOrderInvoicesCard :project-id="project.id" :can-view-financials="canViewFinancials" />
              <ProjectOrderReviewCard
                :project="project"
                :can-close="canClose"
                :blockers="doneStep?.gate.blockers ?? []"
                @close="onClose"
              />
            </div>

            <div class="xl:col-span-4 space-y-5">
              <ProjectOrderContractValueCard
                :project="project"
                :can-view-financials="canViewFinancials"
                :can-view-margin="canViewMargin"
              />
              <ProjectOrderQuotationCard :project="project" :can-view-financials="canViewFinancials" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
