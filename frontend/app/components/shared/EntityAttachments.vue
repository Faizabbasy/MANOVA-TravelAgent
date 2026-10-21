<script setup lang="ts">
import { Paperclip } from 'lucide-vue-next'
import { collabApi } from '~/lib/collab'
import { createSaveGate } from '~/lib/save-gate'
import { isApiError } from '~/lib/api/errors'
import { formatDate } from '~/utils/format'
import type { AttachmentDto, CollabEntityType } from '~/types/api'

/**
 * S12c-5: attachment names on a change request / quotation / travel request, stored on the server. Only the file
 * name is kept — real files wait for ADR-005. `portal` = the client portal routes.
 */
const props = withDefaults(defineProps<{ entityType: CollabEntityType; entityId: string; portal?: boolean; title?: string; readonly?: boolean }>(), {
  portal: false, title: 'Lampiran', readonly: false
})

const api = useApi()
const privateSource = computed(() => props.entityType === 'itinerary' ? null : props.entityType)
const session = useServerSession()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const collab = computed(() => collabApi(api, props.portal))

const attachments = ref<AttachmentDto[]>([])
const loadError = ref('')
async function load () {
  try {
    await session.ensure()
    attachments.value = await collab.value.attachments(props.entityType, props.entityId)
    loadError.value = ''
  } catch (error) {
    loadError.value = isApiError(error) ? error.message : 'Lampiran belum bisa dimuat.'
  }
}
onMounted(load)
watch(() => [props.entityType, props.entityId], load)

const fileName = ref('')
async function submit () {
  const name = fileName.value.trim()
  if (!name) { return }
  const saved = await gate.run('Lampiran Gagal Dicatat', () => collab.value.addAttachment(props.entityType, props.entityId, name))
  if (!saved) { return }
  attachments.value = saved
  fileName.value = ''
  showToast('Lampiran Dicatat', 'Nama file tersimpan (file asli belum diunggah).', 'success')
}
</script>

<template>
  <SectionCard :title="title">
    <p v-if="loadError" class="text-xs text-destructive mb-3">
      {{ loadError }}
    </p>
    <ul v-if="attachments.length" class="divide-y divide-border mb-3">
      <li v-for="attachment in attachments" :key="attachment.id" class="py-2 flex items-center gap-2 text-sm text-foreground">
        <Paperclip class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {{ attachment.fileName }}
        <span class="text-xs text-muted-foreground ml-auto shrink-0">{{ attachment.uploadedByName }} · {{ formatDate(attachment.uploadedAt) }}</span>
      </li>
    </ul>
    <p v-else-if="!loadError" class="text-sm text-muted-foreground mb-3">
      Belum ada lampiran.
    </p>
    <PrivateEvidencePanel v-if="privateSource" :source-type="privateSource" :source-id="entityId" :can-upload="!readonly" :allow-sharing="!portal" />
    <p class="text-xs text-muted-foreground">
      Daftar nama legacy di atas belum menyimpan file asli. Gunakan unggah file asli untuk bukti yang dapat diunduh.
    </p>
    <div v-if="!readonly" class="flex gap-2">
      <Input v-model="fileName" placeholder="Nama file (mis. foto-kondisi.jpg)" class="flex-1" @keyup.enter="submit" />
      <Button :disabled="gate.saving.value || !fileName.trim()" @click="submit">
        Tambah
      </Button>
    </div>
  </SectionCard>
</template>
