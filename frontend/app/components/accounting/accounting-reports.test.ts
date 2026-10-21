// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountingReports from './AccountingReports.vue'
import type { AccountingBalanceSheetDto, AccountingProfitLossDto, AccountingProjectContributionDto } from '~/types/api'

const header = {
  currency: 'IDR',
  timezone: 'Asia/Jakarta',
  basis: 'rehearsal' as const,
  available: true,
  completeness: 'provisional' as const,
  policyVersion: 1,
  reasons: [{ code: 'TAX_PROFILE_INCOMPLETE', message: 'Profil pajak belum tervalidasi; yang tersedia laba sebelum pajak.' }]
}
const section = (amount: string) => ({ lines: [{ code: '4100', name: 'Pendapatan jasa', amountMinor: amount }], totalMinor: amount })
const pl: AccountingProfitLossDto = {
  ...header,
  from: '2026-10-01',
  to: '2026-10-31',
  revenue: section('9007199254740993'),
  directCost: section('80000000'),
  grossProfitMinor: '9007199174740993',
  operatingExpense: section('5000000'),
  profitBeforeTaxMinor: '9007199169740993',
  taxExpense: section('0'),
  netProfitMinor: null
}
const bs: AccountingBalanceSheetDto = { ...header, asOf: '2026-10-31', assets: section('220000000'), liabilities: section('0'), equity: section('200000000'), currentResultMinor: '20000000', balanced: true }
const pc: AccountingProjectContributionDto = {
  ...header,
  from: '2026-10-01',
  to: '2026-10-31',
  companyMinor: '-5000000',
  totalMinor: '15000000',
  items: [{ projectId: 'PRJ-101', salesOrderId: null, name: 'Trip A', revenueMinor: '100000000', directCostMinor: '80000000', contributionMinor: '20000000', otherExpenseMinor: '0' }]
}
const stubs = { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } }

describe('owner accounting reports', () => {
  it('labels profit before tax, keeps after-tax unavailable and shows exact large amounts', () => {
    const view = mount(AccountingReports, { props: { profitLoss: pl, balanceSheet: bs, contribution: pc }, ...stubs })
    expect(view.text()).toContain('Laba sebelum pajak')
    expect(view.text()).toContain('9.007.199.169.740.993')
    expect(view.text()).toMatch(/Laba setelah pajak\s*Belum tersedia/)
    expect(view.text()).toContain('Rehearsal · sementara')
    expect(view.text()).toContain('Aset = kewajiban + modal + hasil usaha')
    expect(view.text()).toContain('Trip A')
  })
  it('never renders unavailable figures as Rp 0 and flags an unbalanced position', () => {
    const off = { ...header, available: false, completeness: 'unavailable' as const, reasons: [{ code: 'BOOK_OFF', message: 'Buku accounting belum aktif.' }] }
    const view = mount(AccountingReports, {
      props: {
        profitLoss: { ...pl, ...off, revenue: null, directCost: null, grossProfitMinor: null, operatingExpense: null, profitBeforeTaxMinor: null, taxExpense: null },
        balanceSheet: { ...bs, ...off, assets: null, liabilities: null, equity: null, currentResultMinor: null, balanced: null },
        contribution: { ...pc, ...off, items: [], companyMinor: null, totalMinor: null }
      },
      ...stubs
    })
    expect(view.text()).toContain('Laba belum tersedia')
    expect(view.text()).toContain('Buku accounting belum aktif')
    expect(view.text()).not.toContain('Rp')
    const unbalanced = mount(AccountingReports, { props: { profitLoss: pl, balanceSheet: { ...bs, balanced: false }, contribution: null }, ...stubs })
    expect(unbalanced.get('[role="status"]').text()).toContain('tidak seimbang')
  })
})
