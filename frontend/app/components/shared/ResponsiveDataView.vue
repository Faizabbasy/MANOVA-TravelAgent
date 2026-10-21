<script setup lang="ts" generic="T">
/**
 * Pilih tampilan tabel desktop (`#desktop`, markup existing lewat apa adanya) atau card-list mobile
 * (`#mobile-card`, satu card per item) berdasarkan `useIsMobile()`. Tidak menyentuh markup desktop sama
 * sekali — hanya memilih slot mana yang dirender.
 */
interface Props {
  items: T[]
  getKey: (item: T, index: number) => string | number
}

const props = defineProps<Props>()
defineSlots<{
  desktop:(props: { items: T[] }) => unknown
  'mobile-card': (props: { item: T; index: number }) => unknown
}>()

const isMobile = useIsMobile()
</script>

<template>
  <div v-if="isMobile" class="space-y-3">
    <template
      v-for="(item, index) in props.items"
      :key="props.getKey(item, index)"
    >
      <slot name="mobile-card" :item="item" :index="index" />
    </template>
  </div>
  <slot v-else name="desktop" :items="props.items" />
</template>
