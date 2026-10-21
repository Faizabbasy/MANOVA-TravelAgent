<script setup lang="ts">
import { ref, shallowRef } from 'vue'
const props = defineProps<{ pending: boolean; allowSharing?: boolean; error?: string }>()
const emit = defineEmits<{ upload: [file: File, visibility: 'internal'|'source-party'] }>()
const file = shallowRef<File|null>(null); const share = ref(false); const validation = ref('')
function choose (event: Event) {
  validation.value = ''
  const selected = (event.target as HTMLInputElement).files?.[0] ?? null
  file.value = null
  if (selected && (selected.size < 1 || selected.size > 10 * 1024 * 1024)) { validation.value = 'File harus berisi data dan maksimal 10 MB.'; return }
  file.value = selected
}
function submit () { if (file.value && !props.pending) { emit('upload', file.value, props.allowSharing && share.value ? 'source-party' : 'internal') } }
</script>
<template>
  <form class="space-y-3" aria-label="Unggah bukti asli" @submit.prevent="submit">
    <fieldset :disabled="pending" class="space-y-2">
      <label class="block text-sm">File asli (PDF, JPEG, PNG, WebP; maksimal 10 MB)<input name="private-evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" class="mt-1 block w-full min-w-0 text-sm" @change="choose"></label>
      <label v-if="allowSharing" class="flex items-start gap-2 text-sm"><input v-model="share" name="share-with-source-party" type="checkbox">Izinkan customer pemilik sumber mengunduh file ini.</label>
    </fieldset>
    <p v-if="validation || error" role="alert" class="text-sm text-destructive">
      {{ validation || error }}
    </p>
    <Button type="submit" size="sm" variant="outline" :disabled="pending || !file">
      {{ pending ? 'Menyimpan file…' : 'Unggah file asli' }}
    </Button>
  </form>
</template>
