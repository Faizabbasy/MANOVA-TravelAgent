<script setup lang="ts">
import { reactive } from 'vue'
import type { AccountingPolicyDto } from '~/types/api'
defineProps<{policy:AccountingPolicyDto;pending:boolean;error?:string}>()
const emit = defineEmits<{save:[input:{reason:string;confirm:boolean}];cancel:[]}>()
const form = reactive({ reason: '', confirm: false })
</script>
<template>
  <form aria-label="Uji kebijakan rehearsal" class="space-y-4" @submit.prevent="!pending && form.confirm && form.reason.trim().length>=5 && emit('save',{reason:form.reason.trim(),confirm:true})">
    <p class="text-sm">
      {{ policy.sourceKind }} · usulan v{{ policy.version }}. Metode dan nilai usulan disalin persis ke versi <strong>TEST_ONLY</strong>. Versi lama tetap tersimpan.
    </p>
    <p class="text-sm text-muted-foreground">
      Hanya untuk data terisolasi. Tidak mengesahkan keputusan produksi, tidak mengaktifkan buku atau membuat pembayaran. Transaksi pending diproses melalui antrean sumber yang sama.
    </p>
    <fieldset :disabled="pending" class="space-y-3">
      <label class="block text-sm">Dasar pengujian<textarea
        v-model="form.reason"
        name="reason"
        required
        minlength="5"
        maxlength="500"
        class="mt-1 block w-full rounded border bg-background p-3"
      /></label>
      <label class="flex items-start gap-2 text-sm"><input v-model="form.confirm" name="confirm" type="checkbox" class="mt-1">Saya menguji data fiktif terisolasi dan memahami versi ini bukan kebijakan produksi.</label>
    </fieldset>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-2">
      <Button type="submit" :disabled="pending || !form.confirm || form.reason.trim().length<5">
        Uji di rehearsal
      </Button><Button type="button" variant="outline" :disabled="pending" @click="emit('cancel')">
        Batal
      </Button>
    </div>
  </form>
</template>
