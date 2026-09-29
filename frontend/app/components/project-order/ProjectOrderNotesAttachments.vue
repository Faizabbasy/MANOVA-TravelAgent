<script setup lang="ts">
import { computed, ref } from 'vue'
import { Paperclip, MessageSquare, Send, Pin, FileText } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { getProjectNotes } from '~/data/project-order-workflow'
import { getDocumentsForProject, getUserById } from '~/data'
import { formatDate } from '~/utils/format'

const props = defineProps<{
  projectId: string
  canManage: boolean
}>()

const emit = defineEmits<{
  'add-note': [body: string]
  'toggle-pin': [noteId: string]
}>()

const tab = ref<'notes' | 'attachments'>('notes')
const draft = ref('')

const notes = computed(() => getProjectNotes(props.projectId))
const attachments = computed(() => getDocumentsForProject(props.projectId).filter(document => document.sourceType === 'uploaded'))

function submit () {
  if (!draft.value.trim()) { return }
  emit('add-note', draft.value)
  draft.value = ''
}

/** Ctrl+Enter mengirim — pola yang sama dengan kolom pesan lain di aplikasi ini. */
function onKeydown (event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { submit() }
}
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-3">
      <Paperclip class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Attachments & Notes
      </h3>
    </div>

    <div class="inline-flex rounded-lg border border-border p-0.5 mb-3">
      <button
        v-for="option in (['notes', 'attachments'] as const)"
        :key="option"
        type="button"
        :class="cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          tab === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )"
        @click="tab = option"
      >
        <component :is="option === 'notes' ? MessageSquare : Paperclip" class="h-3.5 w-3.5" />
        {{ option === 'notes' ? 'Notes' : 'Attachments' }}
      </button>
    </div>

    <template v-if="tab === 'notes'">
      <div v-if="canManage" class="space-y-2 mb-3">
        <textarea
          v-model="draft"
          rows="3"
          placeholder="Tambahkan catatan... (Ctrl+Enter untuk kirim)"
          class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          @keydown="onKeydown"
        />
        <Button size="sm" :disabled="!draft.trim()" @click="submit">
          <Send class="h-3.5 w-3.5 mr-1.5" />
          Tambah Catatan
        </Button>
      </div>

      <ul v-if="notes.length" class="space-y-2">
        <li
          v-for="note in notes"
          :key="note.id"
          :class="cn('rounded-lg border px-3 py-2', note.pinned ? 'border-warning/40 bg-warning/5' : 'border-border')"
        >
          <div class="flex items-start gap-2">
            <p class="text-sm text-foreground flex-1 leading-relaxed">
              {{ note.body }}
            </p>
            <button
              v-if="canManage"
              :class="cn('p-1 rounded shrink-0', note.pinned ? 'text-warning' : 'text-muted-foreground hover:text-foreground')"
              :title="note.pinned ? 'Lepas pin' : 'Pin catatan'"
              @click="emit('toggle-pin', note.id)"
            >
              <Pin class="h-3.5 w-3.5" />
            </button>
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            {{ getUserById(note.authorId)?.name ?? note.authorId }} · {{ formatDate(note.createdAt) }}
          </p>
        </li>
      </ul>

      <EmptyState v-else title="Belum ada catatan" description="Catatan internal tim akan muncul di sini." />
    </template>

    <template v-else>
      <ul v-if="attachments.length" class="space-y-1">
        <li
          v-for="document in attachments"
          :key="document.id"
          class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <FileText class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-foreground truncate">
              {{ document.name }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ document.category }}
              <template v-if="document.uploadedAt"> · {{ formatDate(document.uploadedAt) }}</template>
            </p>
          </div>
        </li>
      </ul>

      <EmptyState
        v-else
        :icon="Paperclip"
        title="Belum ada lampiran"
        description="Lampiran yang diunggah tim akan muncul di sini, sekaligus tercatat di Document Folder."
      />
    </template>
  </SectionCard>
</template>
