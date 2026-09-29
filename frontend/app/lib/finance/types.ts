/** Option for `FinanceSelect` (accounts, projects, vendors, …). */
export interface FinanceOption { value: string; label: string; hint?: string; disabled?: boolean }

/** Period presets of `FinancePeriodPicker`. */
export type PeriodPreset = 'this-month' | 'last-month' | '30d' | '90d' | 'custom'
