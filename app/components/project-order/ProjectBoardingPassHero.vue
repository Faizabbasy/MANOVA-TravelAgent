<script setup lang="ts">
import { computed } from 'vue'
import { Plane, AlertTriangle, Rocket } from 'lucide-vue-next'
import { formatDate } from '~/utils/format'
import { findStatusOption, PROJECT_ORDER_STATUSES, PROJECT_CHARACTERISTICS } from '~/constants/status'
import type { Project, ProjectOrderStatus } from '~/types/project'
import type { BadgeTone } from '~/types/common'

const props = defineProps<{
  project: Project
  clientName: string
  pmName: string
  aeName: string
  orderStatus?: ProjectOrderStatus
  needsAttention?: boolean
  upcomingDeparture?: boolean
}>()

/**
 * Palet chip "Kelas" di atas dasar navy (bukan `text-warning`/dst bawaan tema — tone itu dikalibrasi
 * untuk kartu putih/terang, kontrasnya kurang di atas `--ticket-navy`). Map lokal ke variant yang sudah
 * diuji kontras AA di atas navy.
 */
const STAMP_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-white/25 text-white/70',
  primary: 'border-[#D9B15C]/60 text-[#E9C878]',
  success: 'border-emerald-400/50 text-emerald-300',
  warning: 'border-amber-400/50 text-amber-300',
  destructive: 'border-rose-400/50 text-rose-300',
  info: 'border-sky-400/50 text-sky-300',
  purple: 'border-violet-400/50 text-violet-300'
}

/** Stamp status — dasarnya PUTIH SOLID (bukan transparan) supaya tidak tertembus pola barcode di
 * belakangnya, jadi tone-nya "tinta di atas kertas putih" bukan varian tone di atas navy seperti di atas. */
const WHITE_STAMP_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-slate-300 text-slate-600',
  primary: 'border-[#C89B3C] text-[#8B6914]',
  success: 'border-emerald-600 text-emerald-700',
  warning: 'border-amber-600 text-amber-700',
  destructive: 'border-rose-600 text-rose-700',
  info: 'border-sky-600 text-sky-700',
  purple: 'border-violet-600 text-violet-700'
}

const orderStatusOption = computed(() => (props.orderStatus ? findStatusOption(PROJECT_ORDER_STATUSES, props.orderStatus) : undefined))
const characteristicOption = computed(() => findStatusOption(PROJECT_CHARACTERISTICS, props.project.characteristic))

const ticketFields = computed(() => [
  { label: 'Project', value: props.project.id },
  { label: 'Klien', value: props.clientName },
  { label: 'Berangkat', value: formatDate(props.project.travelStartDate) },
  { label: 'Kembali', value: formatDate(props.project.travelEndDate) },
  { label: 'Pax', value: String(props.project.travelerCount) }
])
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-[#D9B15C]/25 bg-[#0F1B33] text-white shadow-[0_20px_50px_-25px_rgba(15,27,51,0.6)]">
    <div class="px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="font-ticket-mono text-[11px] uppercase tracking-[0.25em] text-white/50">
          Manova · Project Order
        </p>
        <div class="flex items-center gap-3">
          <!-- Barcode mock, dekoratif murni — merepresentasikan "tiket ini asli", bukan data sungguhan -->
          <div
            aria-hidden="true"
            class="hidden h-8 w-20 opacity-40 sm:block"
            style="background-image: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px)"
          />
          <span
            v-if="orderStatusOption"
            class="rounded-full border bg-white px-3 py-1 font-ticket-mono text-[11px] font-semibold uppercase tracking-[0.15em] shadow-sm"
            :class="WHITE_STAMP_TONE_CLASS[orderStatusOption.tone]"
          >
            {{ orderStatusOption.label }}
          </span>
        </div>
      </div>

      <h1 class="mt-3 font-ticket-display text-3xl font-extrabold uppercase leading-none tracking-tight text-white sm:text-4xl">
        {{ project.name }}
      </h1>

      <div class="mt-4 flex items-center gap-3 text-white/70">
        <span class="font-ticket-mono text-xs uppercase tracking-[0.2em] shrink-0">CGK · Jakarta</span>
        <span class="relative h-px flex-1 max-w-[220px]" style="background-image: repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 12px)" />
        <Plane class="h-4 w-4 rotate-90 shrink-0 text-[#E9C878]" />
        <span class="relative h-px flex-1 max-w-[220px]" style="background-image: repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 12px)" />
        <span class="font-ticket-display text-sm uppercase tracking-wide text-white sm:text-base">{{ project.destination }}</span>
      </div>

      <dl class="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-5">
        <div v-for="field in ticketFields" :key="field.label">
          <dt class="font-ticket-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
            {{ field.label }}
          </dt>
          <dd class="mt-0.5 truncate font-ticket-mono text-sm font-semibold text-white" :title="field.value">
            {{ field.value }}
          </dd>
        </div>
        <div>
          <dt class="font-ticket-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
            Kelas
          </dt>
          <dd class="mt-0.5">
            <span
              class="inline-block rounded border px-1.5 py-0.5 font-ticket-mono text-[11px] font-semibold uppercase"
              :class="STAMP_TONE_CLASS[characteristicOption.tone]"
            >
              {{ characteristicOption.label.replace(' Project', '') }}
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Perforasi robek tiket — notch mengikuti `bg-background` supaya "melubangi" ke warna halaman aktif (light/dark) -->
    <div class="relative flex items-center" aria-hidden="true">
      <span class="absolute left-0 h-5 w-5 -translate-x-1/2 rounded-full bg-background" />
      <div class="h-px w-full border-t border-dashed border-white/20" />
      <span class="absolute right-0 h-5 w-5 translate-x-1/2 rounded-full bg-background" />
    </div>

    <div class="relative flex flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-8">
      <p class="font-ticket-mono text-xs text-white/60">
        PM <span class="text-white/90">{{ pmName }}</span> · AE <span class="text-white/90">{{ aeName }}</span>
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="upcomingDeparture" class="inline-flex items-center gap-1 rounded-full border border-sky-400/40 px-2.5 py-1 font-ticket-mono text-[11px] uppercase tracking-wide text-sky-300">
          <Rocket class="h-3 w-3" /> Keberangkatan Dekat
        </span>
        <span v-if="needsAttention" class="inline-flex items-center gap-1 rounded-full border border-rose-400/40 px-2.5 py-1 font-ticket-mono text-[11px] uppercase tracking-wide text-rose-300">
          <AlertTriangle class="h-3 w-3" /> Perlu Perhatian
        </span>
      </div>
    </div>
  </div>
</template>
