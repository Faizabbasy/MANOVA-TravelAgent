import type { FinanceOverviewFull, OverviewProjectStatus } from '~/types/api'

/**
 * Finance at a glance for screens outside Finance (the app dashboard): one request, role-scoped by the
 * server. Admin receives payment status per project only; Finance and Super Admin also get cash, the
 * 30-day forecast, receivables/payables and cost per project. Refreshes after every finance mutation.
 */
export function useFinanceOverview () {
  const api = useApi()
  const session = useServerSession()
  const query = useFinanceQuery(async () => (await api.finance.overview()).data, {
    enabled: () => session.can('finance.view-project-finance') || session.can('project-order.view-payment-status')
  })
  const full = computed<FinanceOverviewFull | null>(() => (query.data.value?.view === 'full' ? query.data.value : null))
  const byProject = computed(() => new Map<string, OverviewProjectStatus>((query.data.value?.projects ?? []).map(p => [p.projectId, p])))
  return { ...query, full, byProject }
}
