export interface ToastItem {
  id: number
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

/**
 * Toast global (Section 09) — diekstrak dari pola lokal `pages/expenses.vue` (dicatat sejak Section 05
 * sebagai pola yang akan direuse) menjadi composable+component bersama, karena Section 09 adalah
 * pemakai pertama di luar halaman itu ("Success/error feedback" — Approve/Reject Won).
 */
const toasts = ref<ToastItem[]>([])
let toastId = 0

export function useToast() {
  function showToast(title: string, message: string, type: ToastItem['type'] = 'success') {
    const id = ++toastId
    toasts.value.push({ id, title, message, type })
    setTimeout(() => removeToast(id), 4000)
  }

  function removeToast(id: number) {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  return { toasts, showToast, removeToast }
}
