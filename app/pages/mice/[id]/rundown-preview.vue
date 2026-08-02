<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileX } from 'lucide-vue-next'
import { getMiceEventById, getProjectById, getUserById } from '~/data'
import { MICE_EVENT_STATUSES, MICE_APPROVAL_STATUSES, findStatusOption } from '~/constants/status'
import { formatDateTime } from '~/utils/format'

/**
 * "Agenda/rundown" (Section 16 — roadmap Section 00–24 baru, Wajib) — mockup frontend-only: halaman
 * print-friendly (tanpa layout dashboard), `window.print()`, client-facing untuk kebutuhan "Client
 * approval states" (Wajib) — pola IDENTIK `eticket-preview.vue`/`voucher-preview.vue`/`service-order-preview.vue`
 * (D-070/D-071/D-072). SANITIZED — tidak menampilkan BOQ/harga apa pun (lihat `boq-preview.vue` terpisah
 * untuk breakdown biaya yang sudah tersanitasi net cost internal).
 */
definePageMeta({ layout: false, middleware: 'auth' })

const route = useRoute()
const { canView } = usePermissions()

const event = computed(() => getMiceEventById(String(route.params.id)))
const project = computed(() => (event.value ? getProjectById(event.value.projectId) : undefined))

useHead({ title: computed(() => event.value ? `Rundown — ${event.value.id}` : 'MICE Event Tidak Ditemukan') })

function userName (id?: string) {
  return id ? (getUserById(id)?.name ?? id) : '—'
}

function printPage () {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
    <div class="mx-auto max-w-3xl px-4 print:px-0 print:max-w-none">
      <template v-if="!event">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <EmptyState
            :icon="FileX"
            title="MICE Event tidak ditemukan"
            :description="`MICE Event dengan ID '${route.params.id}' tidak ada di data demo saat ini.`"
          >
            <NuxtLink to="/mice">
              <Button>Kembali ke MICE</Button>
            </NuxtLink>
          </EmptyState>
        </div>
      </template>

      <template v-else-if="!canView('mice')">
        <div class="rounded-xl border border-border bg-card p-8 print:hidden">
          <RoleAccessState module-label="modul MICE" />
        </div>
      </template>

      <template v-else>
        <div class="mb-4 flex items-center justify-between print:hidden">
          <NuxtLink :to="`/mice/${event.id}`" class="text-sm text-primary hover:underline">
            ← Kembali ke MICE Event
          </NuxtLink>
          <Button size="sm" @click="printPage">
            Print / Save as PDF
          </Button>
        </div>

        <div class="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          <div class="flex items-start justify-between border-b border-border pb-6 mb-6">
            <div>
              <p class="text-2xl font-bold tracking-tight text-foreground">
                MANOVA
              </p>
              <p class="text-xs text-muted-foreground">
                Travel Agent B2B — Event Rundown (Mock)
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-foreground">
                RUNDOWN
              </p>
              <p class="text-sm text-muted-foreground">
                {{ event.id }}
              </p>
              <div class="flex gap-1.5 justify-end mt-1">
                <StatusBadge :label="findStatusOption(MICE_EVENT_STATUSES, event.status).label" :tone="findStatusOption(MICE_EVENT_STATUSES, event.status).tone" />
                <StatusBadge :label="findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).label" :tone="findStatusOption(MICE_APPROVAL_STATUSES, event.clientApprovalStatus).tone" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Project
              </p>
              <p class="text-sm text-foreground">
                {{ project?.name ?? event.projectId }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ project?.destination }}
              </p>
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Venue
              </p>
              <p class="text-sm text-foreground">
                {{ event.venueName ?? '—' }}
              </p>
              <p class="text-sm text-muted-foreground">
                {{ event.venueAddress }}
              </p>
            </div>
          </div>

          <div v-if="event.brief" class="mb-6 text-sm">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Brief
            </p>
            <p class="text-foreground whitespace-pre-line">
              {{ event.brief }}
            </p>
          </div>

          <table class="w-full text-sm mb-6">
            <thead>
              <tr class="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th class="py-2">
                  Sesi
                </th>
                <th class="py-2">
                  Room
                </th>
                <th class="py-2">
                  Jadwal
                </th>
                <th class="py-2">
                  PIC
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(session, index) in event.sessions" :key="index" class="border-b border-border/60">
                <td class="py-2 text-foreground">
                  {{ session.sessionTitle }}{{ !session.isConfirmed ? ' (tentatif)' : '' }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ session.roomName }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ formatDateTime(session.startAt) }} – {{ formatDateTime(session.endAt) }}
                </td>
                <td class="py-2 text-muted-foreground">
                  {{ userName(session.picUserId) }}
                </td>
              </tr>
              <tr v-if="event.sessions.length === 0">
                <td colspan="4" class="py-2 text-muted-foreground">
                  Belum ada sesi tercatat.
                </td>
              </tr>
            </tbody>
          </table>

          <div class="mb-6">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Participant Categories
            </p>
            <ul class="text-sm text-foreground grid grid-cols-2 gap-1">
              <li v-for="(category, index) in event.participantCategories" :key="index">
                {{ category.category }} — {{ category.expectedCount }} pax
              </li>
            </ul>
            <p v-if="event.participantCategories.length === 0" class="text-sm text-muted-foreground">
              Belum ada kategori peserta.
            </p>
          </div>

          <p class="mt-8 text-center text-[10px] text-muted-foreground">
            Dokumen mock untuk keperluan demo — bukan rundown resmi event organizer.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@media print {
  @page { margin: 1.5cm; }
}
</style>
