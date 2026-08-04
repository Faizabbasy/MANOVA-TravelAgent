<script setup lang="ts">
/**
 * Dashboard header — page-local, hanya dipakai `index.vue`.
 *
 * Refinement UI: banner gradien tiga warna beserta dua blur blob dihapus. Alasan aslinya ("agar bagian
 * atas halaman tidak terasa kosong di sebelah grid KPI yang berwarna") sudah tidak berlaku — grid KPI kini
 * tenang, sehingga banner berwarna justru menjadi elemen paling ramai di halaman dan menarik perhatian ke
 * kalimat sapaan, bukan ke angka yang perlu dibaca.
 */
defineProps<{
  roleLabel: string
  greeting: string
  dateLabel: string
  description: string
}>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">
        {{ greeting }}
      </h1>
      <p class="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <StatusBadge :label="roleLabel" tone="primary" dot />
      <span class="text-xs text-muted-foreground">{{ dateLabel }}</span>
    </div>
  </header>
</template>
