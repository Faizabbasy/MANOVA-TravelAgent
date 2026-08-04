<script setup lang="ts">
import { computed, ref } from 'vue'
import { Clock } from 'lucide-vue-next'
import { getUnifiedActivityTimeline } from '~/data'
import { formatDate } from '~/utils/format'

const props = withDefaults(defineProps<{
  projectId: string
  initialLimit?: number
}>(), { initialLimit: 8 })

const showAll = ref(false)

/**
 * Memakai `getUnifiedActivityTimeline` yang sudah ada (Activity + SystemEvent + Message + Document dalam
 * satu urutan kronologis) — tidak membuat log baru, sehingga workspace ini melihat jejak yang sama persis
 * dengan Document Center dan tab Activity & Changes.
 */
const entries = computed(() => getUnifiedActivityTimeline('project', props.projectId, 'internal'))

const visibleEntries = computed(() => (showAll.value ? entries.value : entries.value.slice(0, props.initialLimit)))

const KIND_TONE: Record<string, string> = {
  activity: 'primary',
  'system-event': 'neutral',
  message: 'info',
  document: 'purple'
}
</script>

<template>
  <SectionCard title="Activity Log" description="Riwayat kronologis perubahan dan kejadian.">
    <ul v-if="visibleEntries.length" class="space-y-3">
      <li v-for="entry in visibleEntries" :key="entry.id" class="flex gap-3">
        <span class="mt-0.5 shrink-0">
          <Clock class="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :label="entry.label" :tone="KIND_TONE[entry.kind] as never" />
            <span class="text-xs text-muted-foreground ml-auto shrink-0">{{ formatDate(entry.at) }}</span>
          </div>
          <p class="text-sm text-foreground mt-1 leading-relaxed">
            {{ entry.detail }}
          </p>
        </div>
      </li>
    </ul>

    <EmptyState v-else title="Belum ada aktivitas" />

    <Button
      v-if="entries.length > props.initialLimit"
      variant="ghost"
      size="sm"
      class="mt-3 w-full"
      @click="showAll = !showAll"
    >
      {{ showAll ? 'Tampilkan lebih sedikit' : `Lihat ${entries.length - props.initialLimit} aktivitas lainnya` }}
    </Button>
  </SectionCard>
</template>
