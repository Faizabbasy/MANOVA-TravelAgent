<script setup lang="ts">
import { ShieldAlert } from 'lucide-vue-next'

withDefaults(defineProps<{
  moduleLabel?: string
}>(), {
  moduleLabel: 'modul ini'
})
</script>

<template>
  <SectionCard>
    <EmptyState
      :icon="ShieldAlert"
      title="Anda tidak memiliki akses"
      :description="`Role saat ini tidak memiliki izin untuk melihat ${moduleLabel}. Gunakan role switcher di halaman Settings untuk berganti peran demo.`"
    />
  </SectionCard>
</template>
