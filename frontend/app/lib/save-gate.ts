import { ref } from 'vue'
import { isApiError } from '~/lib/api/errors'

type Toast = (title: string, message: string, tone: 'info' | 'error') => void

/**
 * One server write at a time for a screen (S7c). A failure shows the reason; a second write while one is running is
 * refused with a notice instead of being dropped silently.
 */
export function createSaveGate (showToast: Toast) {
  const saving = ref(false)

  async function run<T> (title: string, action: () => Promise<T>): Promise<T | undefined> {
    if (saving.value) {
      showToast('Tunggu Sebentar', 'Perubahan sebelumnya masih disimpan. Coba lagi sesaat lagi.', 'info')
      return undefined
    }
    saving.value = true
    try {
      return await action()
    } catch (error) {
      showToast(title, isApiError(error) ? error.message : 'Server belum bisa dihubungi. Coba lagi.', 'error')
      return undefined
    } finally {
      saving.value = false
    }
  }

  return { saving, run }
}

/**
 * The browser flips a checkbox / changes a date input on its own; put back the stored value so the screen never shows
 * a change the server has not accepted. The server's answer updates the data, and Vue then shows the new value.
 */
export function showStoredValue (target: { type: string; checked: boolean; value: string }, stored: boolean | string): void {
  if (target.type === 'checkbox') { target.checked = Boolean(stored) } else { target.value = String(stored) }
}
