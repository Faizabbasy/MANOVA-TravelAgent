<script setup lang="ts">
import { collabApi, commentAuthor } from '~/lib/collab'
import { createSaveGate } from '~/lib/save-gate'
import { isApiError } from '~/lib/api/errors'
import { formatDateTime } from '~/utils/format'
import type { CollabEntityType, CommentDto } from '~/types/api'

/**
 * S12c-5: the comment thread of a client-facing record, read and written on the server. `portal` = the client portal
 * (own party only); otherwise the staff routes. The other side is notified of every new comment.
 */
const props = withDefaults(defineProps<{ entityType: CollabEntityType; entityId: string; portal?: boolean; title?: string; description?: string }>(), {
  portal: false, title: 'Komentar', description: undefined
})

const api = useApi()
const session = useServerSession()
const { showToast } = useToast()
const gate = createSaveGate((title, message, tone) => showToast(title, message, tone))
const collab = computed(() => collabApi(api, props.portal))

const comments = ref<CommentDto[]>([])
const loadError = ref('')
async function load () {
  try {
    await session.ensure()
    comments.value = await collab.value.comments(props.entityType, props.entityId)
    loadError.value = ''
  } catch (error) {
    loadError.value = isApiError(error) ? error.message : 'Komentar belum bisa dimuat.'
  }
}
onMounted(load)
watch(() => [props.entityType, props.entityId], load)

const draft = ref('')
async function submit () {
  const body = draft.value.trim()
  if (!body) { return }
  const saved = await gate.run('Komentar Gagal Dikirim', () => collab.value.addComment(props.entityType, props.entityId, body))
  if (!saved) { return }
  comments.value = saved
  draft.value = ''
}
</script>

<template>
  <SectionCard :title="title" :description="description">
    <p v-if="loadError" class="text-xs text-destructive mb-3">
      {{ loadError }}
    </p>
    <ul v-if="comments.length" class="divide-y divide-border mb-3">
      <li v-for="comment in comments" :key="comment.id" class="py-2">
        <p class="text-sm text-foreground whitespace-pre-line">
          {{ comment.body }}
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ commentAuthor(comment, portal) }} · {{ formatDateTime(comment.createdAt) }}
        </p>
      </li>
    </ul>
    <p v-else-if="!loadError" class="text-sm text-muted-foreground mb-3">
      Belum ada komentar.
    </p>
    <div class="flex gap-2">
      <Input v-model="draft" placeholder="Tulis komentar..." class="flex-1" @keyup.enter="submit" />
      <Button :disabled="gate.saving.value || !draft.trim()" @click="submit">
        Kirim
      </Button>
    </div>
  </SectionCard>
</template>
