import { isInternalProject, type ApiList, type BankAccountDto, type PartyDto, type ProjectDto, type VendorDto } from '~/types/api'
import type { FinanceOption } from '~/lib/finance/types'
import { formatMoneyMinor } from '~/lib/money'

/** Follows the cursor to the end, so a reference list is never silently cut at one page. */
async function fetchAll<T> (page: (cursor: string | null) => Promise<ApiList<T>>): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null
  for (let guard = 0; guard < 50; guard++) {
    const res = await page(cursor)
    all.push(...res.data)
    cursor = res.meta.pagination.nextCursor
    if (!cursor) { break }
  }
  return all
}

/**
 * Reference lists for finance forms (accounts, projects, customers, vendors), loaded from the API when the
 * form mounts. Like every finance query they refresh after a mutation, so an account balance hint is never
 * stale after a posting.
 */
export function useFinanceLookups (active: () => boolean = () => true) {
  const api = useApi()
  // Load when the form is actually open (dialogs mount with their page but may never be used).
  const lazy = { enabled: active, watch: [active] }

  const accounts = useFinanceQuery(async () => (await api.finance.listAccounts()).data, lazy)
  const references = useFinanceQuery(async () => {
    const [projects, parties, vendors] = await Promise.all([
      fetchAll(cursor => api.core.listProjects({ limit: 100, cursor })),
      fetchAll(cursor => api.core.listParties({ limit: 100, cursor })),
      fetchAll(cursor => api.core.listVendors({ limit: 100, cursor }))
    ])
    return { projects, parties, vendors }
  }, lazy)

  const postableAccounts = computed<BankAccountDto[]>(() =>
    (accounts.data.value ?? []).filter(a => a.isActive && a.opening.status === 'verified'))

  /** Accounts a posting can use, with the balance as a hint so the user picks the right one. */
  const accountOptions = computed<FinanceOption[]>(() => postableAccounts.value.map(a => ({
    value: a.id,
    label: `${a.bankName} · ${a.code}`,
    hint: a.balance.currentMinor ? formatMoneyMinor(a.balance.currentMinor, a.currency) : undefined
  })))

  const projects = computed<ProjectDto[]>(() => references.data.value?.projects ?? [])
  const parties = computed<PartyDto[]>(() => references.data.value?.parties ?? [])
  const vendors = computed<VendorDto[]>(() => references.data.value?.vendors ?? [])

  const projectOptions = computed<FinanceOption[]>(() => projects.value.map(p => ({
    value: p.id,
    label: p.name,
    hint: isInternalProject(p) ? p.partyName : undefined
  })))
  const partyOptions = computed<FinanceOption[]>(() => parties.value.map(p => ({ value: p.id, label: p.name })))
  const vendorOptions = computed<FinanceOption[]>(() => vendors.value.map(v => ({ value: v.id, label: v.name, disabled: v.status === 'inactive' })))

  function projectsOfParty (partyId: string | null): FinanceOption[] {
    return projects.value
      .filter(p => !partyId || (isInternalProject(p) && p.partyId === partyId))
      .map(p => ({ value: p.id, label: p.name }))
  }

  return {
    accounts,
    references,
    postableAccounts,
    accountOptions,
    projects,
    parties,
    vendors,
    projectOptions,
    partyOptions,
    vendorOptions,
    projectsOfParty
  }
}
