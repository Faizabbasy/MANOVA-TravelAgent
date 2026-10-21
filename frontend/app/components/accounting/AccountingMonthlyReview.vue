<script setup lang="ts">
import { reactive } from 'vue'
import type { AccountingPeriodReviewDto } from '~/types/api'

/**
 * Cek bulanan: the server's checklist in order, each item with what it means and where to fix it. Closing needs no
 * blockers, a note and an explicit confirmation; open AR/AP that are legitimately not due never block.
 */
const props = defineProps<{ review: AccountingPeriodReviewDto; canClose: boolean; pending: boolean; error?: string | null }>()
const emit = defineEmits<{ close: [input: { version: number; reason: string; confirm: boolean }] }>()
const form = reactive({ reason: '', confirm: false })
const TONE = { ok: 'Beres', warning: 'Perlu dilihat', blocker: 'Harus diselesaikan' } as const
function submit () { emit('close', { version: props.review.period.version, reason: form.reason.trim(), confirm: form.confirm }) }
</script>

<template>
  <section class="space-y-4 rounded-xl border bg-card p-5" aria-label="Cek bulanan">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold">
          Cek bulanan
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ review.period.startsOn }} – {{ review.period.endsOn }} · {{ review.period.status === 'closed' ? 'sudah ditutup' : 'terbuka' }}
          <template v-if="review.bookPurpose === 'rehearsal'">
            · rehearsal
          </template>
        </p>
      </div>
      <span class="rounded-md bg-muted px-3 py-1 text-sm">{{ review.blockers ? `${review.blockers} hal harus diselesaikan` : 'Siap ditutup' }}</span>
    </div>
    <ol class="space-y-2">
      <li v-for="c in review.checks" :key="c.code" class="rounded-lg border p-3 text-sm" :data-status="c.status">
        <p class="flex flex-wrap items-center justify-between gap-2 font-medium">
          <span>{{ c.title }}</span>
          <span :class="c.status === 'blocker' ? 'text-destructive' : c.status === 'warning' ? 'text-warning' : 'text-success'">{{ TONE[c.status] }}</span>
        </p>
        <p class="mt-1 text-muted-foreground">
          {{ c.detail }}
        </p>
        <NuxtLink v-if="c.action" :to="c.action.to" class="mt-1 inline-block text-sm underline">
          {{ c.action.label }}
        </NuxtLink>
      </li>
    </ol>
    <form v-if="canClose && review.period.status !== 'closed'" class="space-y-3 border-t pt-4" @submit.prevent="submit">
      <label class="block text-sm">Catatan review
        <textarea v-model="form.reason" name="reason" rows="2" maxlength="500" class="mt-1 w-full rounded-md border bg-background p-2" />
      </label>
      <label class="flex items-start gap-2 text-sm">
        <input v-model="form.confirm" name="confirm" type="checkbox" class="mt-1">
        <span>Saya sudah memeriksa daftar ini. Setelah ditutup, transaksi baru pada periode ini ditolak dan koreksi memerlukan pembukaan kembali yang tercatat.</span>
      </label>
      <p v-if="error" role="alert" class="text-sm font-medium text-destructive">
        {{ error }}
      </p>
      <button type="submit" class="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50" :disabled="pending || !review.readyToClose || !form.confirm || form.reason.trim().length < 5">
        Tutup periode
      </button>
    </form>
  </section>
</template>
