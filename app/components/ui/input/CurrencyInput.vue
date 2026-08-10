<script setup lang="ts">
/**
 * Input angka dengan pemisah ribuan otomatis (format Indonesia — titik), dipakai untuk field
 * Rupiah/nominal supaya angka besar gampang dibaca sambil mengetik (mis. ketik "1000000" langsung
 * tampil "1.000.000"). Nilai yang di-emit lewat v-model tetap angka polos (`number | null`) — hanya cara
 * tampilnya di layar yang berubah, tidak ada perhitungan/logic apa pun di komponen ini.
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const displayValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined || Number.isNaN(props.modelValue)) { return '' }
  return props.modelValue.toLocaleString('id-ID')
})

function onInput (event: Event) {
  const digitsOnly = (event.target as HTMLInputElement).value.replace(/[^\d]/g, '')
  emit('update:modelValue', digitsOnly ? Number(digitsOnly) : null)
}
</script>

<template>
  <input
    v-bind="$attrs"
    type="text"
    inputmode="numeric"
    :value="displayValue"
    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    @input="onInput"
  >
</template>
