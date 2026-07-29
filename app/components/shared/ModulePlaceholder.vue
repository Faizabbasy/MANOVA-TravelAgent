<script setup lang="ts">
import { Construction } from 'lucide-vue-next'

interface BreadcrumbItem {
  label: string
  to?: string
}

withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
  phase?: string
}>(), {
  breadcrumb: () => [],
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="title" :description="description" :breadcrumb="breadcrumb">
      <template #actions>
        <StatusBadge label="Segera Hadir" tone="warning" />
      </template>
    </PageHeader>
    <SectionCard>
      <EmptyState
        :icon="Construction"
        title="Modul ini belum diimplementasikan"
        :description="phase
          ? `Halaman ini akan dibangun pada fase ${phase} sesuai docs/template-reuse-mapping.md. Struktur navigasi dan foundation sudah disiapkan.`
          : 'Halaman ini akan dibangun pada fase implementasi modul berikutnya. Struktur navigasi dan foundation sudah disiapkan.'"
      />
    </SectionCard>
  </div>
</template>
