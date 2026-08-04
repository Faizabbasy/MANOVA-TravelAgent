<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen, FileText, ExternalLink, AlertTriangle } from 'lucide-vue-next'
import { getDocumentsForProject } from '~/data'
import { formatDate } from '~/utils/format'
import { isDocumentExpired, isDocumentExpiringSoon } from '~/utils/attention'

const props = defineProps<{ projectId: string }>()

/**
 * Folder dokumen memakai entitas `Document` existing (`entityType: 'project'`) — bukan tipe attachment
 * baru — supaya dokumen yang sama tetap muncul konsisten di Document Center.
 */
const documents = computed(() => getDocumentsForProject(props.projectId))

/**
 * Refinement UI: judul grup sebelumnya menampilkan nilai mentah `document.category` di-uppercase, sehingga
 * kategori teknis seperti "legacy" bocor ke layar sebagai "LEGACY" — istilah internal yang tidak berarti
 * apa pun bagi pengguna. Kini dipetakan ke label yang manusiawi, dengan Title Case sebagai cadangan untuk
 * kategori yang belum terdaftar.
 */
const CATEGORY_LABEL: Record<string, string> = {
  finance: 'Keuangan',
  'travel-document': 'Dokumen Perjalanan',
  'travel document': 'Dokumen Perjalanan',
  quotation: 'Penawaran',
  contract: 'Kontrak',
  legacy: 'Arsip Lama',
  manifest: 'Manifest',
  voucher: 'Voucher',
  itinerary: 'Itinerary',
  invoice: 'Invoice',
  report: 'Laporan'
}

function categoryLabel (category: string): string {
  const key = category.trim().toLowerCase()
  if (CATEGORY_LABEL[key]) { return CATEGORY_LABEL[key] }
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

const grouped = computed(() => {
  const byCategory = new Map<string, typeof documents.value>()
  for (const document of documents.value) {
    const list = byCategory.get(document.category) ?? []
    list.push(document)
    byCategory.set(document.category, list)
  }
  return [...byCategory.entries()]
    .map(([category, items]) => ({ category, label: categoryLabel(category), items }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const expiredCount = computed(() => documents.value.filter(document => isDocumentExpired(document.expiresAt)).length)
</script>

<template>
  <SectionCard>
    <div class="flex items-center gap-2 mb-4">
      <FolderOpen class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-base font-semibold text-foreground">
        Document Folder
      </h3>
      <StatusBadge :label="`${documents.length}`" tone="neutral" class="ml-auto" />
    </div>

    <div v-if="expiredCount" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 mb-3 flex items-center gap-2">
      <AlertTriangle class="h-3.5 w-3.5 text-destructive shrink-0" />
      <p class="text-xs text-destructive">
        {{ expiredCount }} dokumen sudah kedaluwarsa — ini menahan penutupan Project Order.
      </p>
    </div>

    <div v-if="grouped.length" class="space-y-4">
      <div v-for="group in grouped" :key="group.category">
        <p class="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {{ group.label }}
          <span class="text-muted-foreground/60">·</span>
          <span class="text-muted-foreground/80">{{ group.items.length }}</span>
        </p>
        <ul class="space-y-1">
          <li
            v-for="document in group.items"
            :key="document.id"
            class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <FileText class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-foreground truncate">
                {{ document.name }}
              </p>
              <p class="text-xs text-muted-foreground">
                v{{ document.version }}
                <template v-if="document.uploadedAt || document.generatedAt">
                  · {{ formatDate(document.uploadedAt ?? document.generatedAt!) }}
                </template>
              </p>
            </div>
            <StatusBadge
              v-if="isDocumentExpired(document.expiresAt)"
              label="Kedaluwarsa"
              tone="destructive"
            />
            <StatusBadge
              v-else-if="isDocumentExpiringSoon(document.expiresAt)"
              label="Segera Habis"
              tone="warning"
            />
            <NuxtLink
              v-if="document.previewRoute"
              :to="document.previewRoute"
              class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
              title="Buka pratinjau"
            >
              <ExternalLink class="h-3.5 w-3.5" />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <EmptyState
      v-else
      :icon="FolderOpen"
      title="Belum ada dokumen"
      description="Dokumen yang di-generate (quotation, voucher, manifest) akan muncul di sini."
    />
  </SectionCard>
</template>
