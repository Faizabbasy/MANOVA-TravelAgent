/** Option for `FinanceSelect` (accounts, projects, vendors, …). */
export interface FinanceOption { value: string; label: string; hint?: string; disabled?: boolean }

/** Period presets of `FinancePeriodPicker`. */
export type PeriodPreset = 'this-month' | 'last-month' | '30d' | '90d' | 'custom'

/** An open invoice a payment can settle (`FinanceAllocationList`). */
export interface AllocationTarget {
  id: string
  title: string
  subtitle: string
  dueDate: string | null
  outstandingMinor: string
}
