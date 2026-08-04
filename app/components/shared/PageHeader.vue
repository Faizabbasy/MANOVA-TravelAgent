<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  to?: string
}

withDefaults(defineProps<{
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
}>(), {
  breadcrumb: () => []
})
</script>

<template>
  <!--
    Refinement UI: banner gradien tiga warna (primary → violet → cyan) dihapus. Ia muncul di SETIAP
    halaman sehingga menjadi latar dekoratif yang bersaing dengan konten, bukan penanda hierarki.
    Digantikan blok judul bersih dengan garis pemisah — judul halaman kini menonjol karena ukuran dan
    bobotnya, bukan karena warna latarnya.
  -->
  <div class="space-y-3">
    <Breadcrumb v-if="breadcrumb.length" :items="breadcrumb" />

    <div class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
