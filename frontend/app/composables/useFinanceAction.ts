import { ApiError, isApiError } from '~/lib/api/errors'

/**
 * Wraps one finance command (post, issue, approve, …): no double submit, the server's error kept for the form
 * (banner + `fieldError(name)` next to inputs), and on success every mounted finance query refreshes so all
 * screens agree immediately.
 */
export function useFinanceAction<A extends unknown[], R> (action: (...args: A) => Promise<R>) {
  const pending = ref(false)
  const error = shallowRef<ApiError | null>(null)
  const refreshAll = useFinanceRefresh()
  const session = useServerSession()

  async function run (...args: A): Promise<R | undefined> {
    if (pending.value) { return undefined }
    pending.value = true
    error.value = null
    try {
      await session.ensure()
      const result = await action(...args)
      refreshAll()
      return result
    } catch (cause) {
      error.value = isApiError(cause) ? cause : new ApiError(0, 'UNEXPECTED_RESPONSE', 'Terjadi kesalahan tak terduga. Coba lagi.')
      if (error.value.isUnauthenticated) { session.reset() }
      return undefined
    } finally {
      pending.value = false
    }
  }

  function fieldError (name: string): string | null {
    return error.value?.fieldError(name) ?? null
  }

  return { run, pending, error, fieldError, reset: () => { error.value = null } }
}
