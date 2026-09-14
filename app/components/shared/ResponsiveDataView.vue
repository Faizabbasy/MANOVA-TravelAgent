<script setup lang="ts">
/**
 * Pilih tampilan tabel desktop (`#desktop`, markup existing lewat apa adanya) atau card-list mobile
 * (`#mobile-card`, satu card per item) berdasarkan `useIsMobile()`. Tidak menyentuh markup desktop sama
 * sekali — hanya memilih slot mana yang dirender.
 */
interface Props {
  items: unknown[]
  getKey: (item: any, index: number) => string | number
}

const props = defineProps<Props>()

const isMobile = useIsMobile()
</script>

<template>
  <div v-if="isMobile" class="space-y-3">
    <slot
      v-for="(item, index) in props.items"
      :key="props.getKey(item, index)"
      name="mobile-card"
      :item="item"
      :index="index"
    />
  </div>
  <slot v-else name="desktop" :items="props.items" />
</template>
