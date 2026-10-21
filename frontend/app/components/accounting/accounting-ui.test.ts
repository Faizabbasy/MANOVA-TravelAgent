// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountingSetupForm from './AccountingSetupForm.vue'
import AccountingTrialBalance from './AccountingTrialBalance.vue'
import type { AccountingTrialBalanceDto } from '~/types/api'

const unavailable: AccountingTrialBalanceDto = {
  asOf: '2026-10-21',
  timezone: null,
  currency: 'IDR',
  period: null,
  basis: 'recognized',
  available: false,
  completeness: 'unavailable',
  reasons: [{ code: 'BOOK_OFF', message: 'Buku accounting belum aktif.' }],
  policyVersion: null,
  totalDebitMinor: null,
  totalCreditMinor: null,
  balanced: null,
  netProfitMinor: null,
  rows: []
}

describe('owner accounting UI', () => {
  it('renders unavailable amounts without turning unknown into zero/profit', () => {
    const view = mount(AccountingTrialBalance, { props: { result: unavailable } })
    expect(view.text()).toContain('Angka accounting belum tersedia')
    expect(view.text()).toContain('Buku accounting belum aktif')
    expect(view.text()).not.toContain('Rp')
    expect(view.find('table').exists()).toBe(false)
  })
  it('labels rehearsal/provisional and displays exact string amounts and completeness reasons', () => {
    const result: AccountingTrialBalanceDto = {
      ...unavailable,
      available: true,
      basis: 'rehearsal',
      timezone: 'Asia/Jakarta',
      completeness: 'provisional',
      balanced: true,
      reasons: [{ code: 'TAX_PROFILE_INCOMPLETE', message: 'Profil pajak belum tervalidasi.' }],
      totalDebitMinor: '9007199254740993',
      totalCreditMinor: '9007199254740993',
      rows: [{ code: '1100', name: 'Bank', type: 'asset', debitMinor: '9007199254740993', creditMinor: '0', balanceMinor: '9007199254740993' }]
    }
    const view = mount(AccountingTrialBalance, { props: { result } })
    expect(view.text()).toContain('Rehearsal · sementara')
    expect(view.text()).toContain('9.007.199.254.740.993')
    expect(view.text()).toContain('Laba setelah pajak belum tersedia')
    expect(view.text()).toContain('Profil pajak belum tervalidasi')
    expect(view.find('th[scope="row"]').text()).toContain('1100 · Bank')
  })
  it('submits only business configuration; production selection still offers no activation command', async () => {
    const view = mount(AccountingSetupForm, { props: { pending: false } })
    await view.get('input[name="name"]').setValue('MANOVA TEST_ONLY')
    await view.get('input[name="cutoverDate"]').setValue('2026-09-01')
    await view.get('select[name="purpose"]').setValue('production')
    await view.get('form').trigger('submit')
    expect(view.emitted('submit')?.[0]?.[0]).toEqual({ name: 'MANOVA TEST_ONLY', purpose: 'production', cutoverDate: '2026-09-01', timezone: 'Asia/Jakarta', entityType: '', accountingStandard: '' })
    expect(view.text()).toContain('tetap nonaktif')
    expect(view.find('input[name="debitMinor"]').exists()).toBe(false)
    await view.setProps({ pending: true, error: 'Koneksi terputus. Coba lagi dengan permintaan yang sama.' })
    expect(view.get('button').attributes('disabled')).toBeDefined()
    expect(view.get('[role="alert"]').text()).toContain('Koneksi terputus')
  })
})
