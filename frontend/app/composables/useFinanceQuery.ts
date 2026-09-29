import type { WatchSource } from 'vue'
import { ApiError, isApiError } from '~/lib/api/errors'

/**
 * Loads server data for a finance screen: waits for the server session, keeps the previous result on screen
 * while refreshing (no flicker), ignores out-of-order responses, and refetches when any finance mutation
 * happens anywhere in the app (`useFinanceRefresh()`), so the dashboard, lists and context panels never show
 * numbers older than the last thing the user did.
 *
 * Client-only on purpose: finance figures are per-user and time-sensitive, and SSR would render them before
 * the session is synchronised.
 */

function useFinanceVersion () {
  return useState<number>('manova-finance-version', () => 0)
}

/** Call after a successful mutation: every mounted finance query refreshes. */
export function useFinanceRefresh () {
  const version = useFinanceVersion()
  return () => { version.value++ }
}

export interface FinanceQueryOptions {
  watch?: WatchSource[]
  /** Skip loading while false (e.g. a filter not chosen yet). */
  enabled?: () => boolean
  /** Refetch after any finance mutation (default). Off for master data that finance commands never change. */
  refreshOnMutation?: boolean
}

export function useFinanceQuery<T> (fetcher: () => Promise<T>, options: FinanceQueryOptions = {}) {
  const session = useServerSession()
  const version = useFinanceVersion()
  const data = shallowRef<T | null>(null)
  const error = shallowRef<ApiError | null>(null)
  const pending = ref(false)
  /** True once a result arrived (distinguishes "loading the first time" from "refreshing"). */
  const loaded = ref(false)
  let sequence = 0

  async function refresh () {
    const mine = ++sequence
    try {
      // Session first: `enabled` may depend on server capabilities, which exist only once it is ready.
      await session.ensure()
      if (options.enabled && !options.enabled()) { return }
      pending.value = true
      const result = await fetcher()
      if (mine !== sequence) { return }
      data.value = result
      error.value = null
      loaded.value = true
    } catch (cause) {
      if (mine !== sequence) { return }
      if (isApiError(cause) && cause.isUnauthenticated) { session.reset() }
      error.value = isApiError(cause) ? cause : new ApiError(0, 'UNEXPECTED_RESPONSE', 'Terjadi kesalahan tak terduga saat memuat data.')
    } finally {
      if (mine === sequence) { pending.value = false }
    }
  }

  onMounted(refresh)
  watch([...(options.watch ?? []), ...(options.refreshOnMutation === false ? [] : [version])], () => { refresh() }, { deep: true })

  return { data, error, pending, loaded, refresh }
}
