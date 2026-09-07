import { computed, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

/**
 * Pagination client-side generik (halaman Payments/Reconciliation, dst.) — dipakai bareng
 * `TablePaginationFooter.vue`. Reset ke halaman 1 otomatis saat `items` berubah (mis. hasil search/filter
 * berubah) atau saat `pageSize` diganti, supaya tidak nyangkut di halaman kosong.
 */
export function usePagination<T> (items: Ref<T[]> | ComputedRef<T[]>, defaultPageSize = 25) {
  const pageSize = ref(defaultPageSize)
  const currentPage = ref(1)

  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSize.value)))

  watch(() => items.value.length, () => {
    if (currentPage.value > totalPages.value) { currentPage.value = totalPages.value }
  })
  watch(pageSize, () => { currentPage.value = 1 })

  const pageItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  const rangeLabel = computed(() => {
    if (items.value.length === 0) { return '0 dari 0' }
    const start = (currentPage.value - 1) * pageSize.value + 1
    const end = Math.min(items.value.length, currentPage.value * pageSize.value)
    return `${start}-${end} dari ${items.value.length}`
  })

  return { pageSize, currentPage, totalPages, pageItems, rangeLabel }
}
