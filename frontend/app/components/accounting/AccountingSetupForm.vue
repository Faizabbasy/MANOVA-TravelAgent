<script setup lang="ts">
import { reactive } from 'vue'
import type { AccountingSetupInput } from '~/types/api'

defineProps<{ pending: boolean; error?: string | null }>()
const emit = defineEmits<{ submit: [input: AccountingSetupInput] }>()
const form = reactive<AccountingSetupInput>({ name: '', purpose: 'rehearsal', cutoverDate: '', timezone: 'Asia/Jakarta', entityType: '', accountingStandard: '' })
</script>

<template>
  <form class="space-y-4 rounded-xl border bg-card p-5" @submit.prevent="emit('submit', { ...form })">
    <h2 class="text-lg font-semibold">
      Siapkan accounting
    </h2>
    <p class="text-sm text-muted-foreground">
      Aktivitas tetap dicatat lewat Finance. Setup ini menyiapkan profil dan template akun; aktivasi buku produksi memerlukan cutover terpisah.
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="space-y-1 text-sm">Nama buku
        <input
          v-model="form.name"
          name="name"
          required
          minlength="2"
          maxlength="120"
          class="flex h-10 w-full rounded-md border bg-background px-3"
          autocomplete="organization"
        >
      </label>
      <label class="space-y-1 text-sm">Tujuan
        <select v-model="form.purpose" name="purpose" class="h-10 w-full rounded-md border bg-background px-3">
          <option value="rehearsal">Rehearsal — hasil percobaan terpisah</option>
          <option value="production">Konfigurasi produksi — tetap nonaktif</option>
        </select>
      </label>
      <label class="space-y-1 text-sm">Tanggal awal buku yang diusulkan
        <input v-model="form.cutoverDate" name="cutoverDate" type="date" required class="h-10 w-full rounded-md border bg-background px-3">
      </label>
      <label class="space-y-1 text-sm">Zona waktu bisnis
        <select v-model="form.timezone" class="h-10 w-full rounded-md border bg-background px-3">
          <option value="Asia/Jakarta">Asia/Jakarta</option>
          <option value="Asia/Bangkok">Asia/Bangkok</option>
        </select>
      </label>
      <label class="space-y-1 text-sm">Bentuk entitas (boleh belum diketahui)
        <input v-model="form.entityType" maxlength="120" class="h-10 w-full rounded-md border bg-background px-3" placeholder="Belum ditentukan">
      </label>
      <label class="space-y-1 text-sm">Standar accounting (boleh belum diketahui)
        <input v-model="form.accountingStandard" maxlength="120" class="h-10 w-full rounded-md border bg-background px-3" placeholder="Menunggu validasi">
      </label>
    </div>
    <p class="text-sm text-muted-foreground">
      Mata uang IDR. Mode tim dan pengamanan saldo awal existing tetap berlaku. Kebijakan pajak belum diketahui.
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <button type="submit" :disabled="pending" class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
      {{ pending ? 'Menyimpan…' : 'Simpan konfigurasi' }}
    </button>
  </form>
</template>
