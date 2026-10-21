<script setup lang="ts">
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'
import type { PrivateFileDto, PrivateFileSource } from '~/types/api'
const props = withDefaults(defineProps<{ sourceType: PrivateFileSource; sourceId: string; canUpload?: boolean; allowSharing?: boolean }>(), { canUpload: false, allowSharing: false })
const api = useApi()
const data = useFinanceQuery(async () => (await api.files.list(props.sourceType, props.sourceId)).data, { watch: [() => props.sourceType, () => props.sourceId] })
const formVersion = ref(0); const saved = ref(''); const downloadError = ref(''); const downloading = ref<string|null>(null)
let key = newIdempotencyKey(); let previousFile: File|null = null; let previousVisibility = ''
const save = useFinanceAction((file: File, visibility: 'internal'|'source-party') => {
  if (file !== previousFile || visibility !== previousVisibility) { previousFile = file; previousVisibility = visibility; key = newIdempotencyKey() }
  return api.files.upload(props.sourceType, props.sourceId, file, visibility, key)
})
watch(() => [props.sourceType, props.sourceId], () => { previousFile = null; saved.value = ''; formVersion.value++; save.reset() })
async function upload (file: File, visibility: 'internal'|'source-party') {
  const result = await save.run(file, visibility)
  if (result) { saved.value = `${result.data.name} tersimpan sebagai file privat.`; formVersion.value++ }
}
async function download (file: PrivateFileDto) {
  if (downloading.value) { return }
  downloading.value = file.id; downloadError.value = ''
  try {
    const bytes = await api.files.download(file.id)
    const url = URL.createObjectURL(bytes)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name
    try { anchor.click() } finally { URL.revokeObjectURL(url) }
  } catch (e) { downloadError.value = isApiError(e) ? e.message : 'File belum bisa diunduh. Coba lagi.' } finally { downloading.value = null }
}
</script>
<template>
  <section class="space-y-3 rounded-lg border p-3" aria-label="Bukti asli privat">
    <h3 class="text-sm font-semibold">
      Bukti asli privat
    </h3>
    <p class="text-xs text-muted-foreground">
      File mengikuti akses sumber. Unggah bukan verifikasi pembayaran atau pengakuan biaya.
    </p>
    <FinanceErrorState v-if="data.error.value" :error="data.error.value" compact @retry="data.refresh" />
    <p v-else-if="!data.data.value" role="status" class="text-sm">
      Memuat file…
    </p>
    <template v-else>
      <p v-if="!data.data.value.items.length" class="text-sm text-muted-foreground">
        Belum ada file asli tertaut.
      </p>
      <p v-if="data.data.value.truncated" role="status" class="text-sm">
        100 file terbaru ditampilkan. Hubungi pengelola untuk riwayat lengkap.
      </p>
      <ul class="space-y-2">
        <li v-for="f in data.data.value.items" :key="f.id" class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span class="min-w-0 break-all">{{ f.name }} · {{ Math.ceil(f.sizeBytes/1024) }} KB · {{ f.visibility==='internal' ? 'Internal' : 'Customer sumber' }}<span v-if="f.sourceType!==sourceType || f.sourceId!==sourceId" class="block text-xs text-muted-foreground">Dari sumber {{ f.sourceId }}, file asli yang sama.</span></span><Button size="sm" variant="outline" :disabled="!!downloading" @click="download(f)">
            {{ downloading===f.id ? 'Memeriksa file…' : 'Unduh asli' }}
          </Button>
        </li>
      </ul>
    </template>
    <p v-if="downloadError" role="alert" class="text-sm text-destructive">
      {{ downloadError }}
    </p>
    <p v-if="saved" role="status" class="text-sm">
      {{ saved }}
    </p>
    <PrivateEvidenceForm
      v-if="canUpload"
      :key="formVersion"
      :pending="save.pending.value"
      :allow-sharing="allowSharing"
      :error="save.error.value?.message"
      @upload="upload"
    />
  </section>
</template>
