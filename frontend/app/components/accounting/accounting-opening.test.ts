// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountingOpeningPlan from './AccountingOpeningPlan.vue'
import type { OpeningPlanDto } from '~/types/api'

const plan: OpeningPlanDto = {
  cutoverDate: '2026-09-01',
  bookPurpose: 'rehearsal',
  planHash: 'a'.repeat(64),
  netAssetsMinor: '158000000',
  equityDecided: false,
  undecided: ['customer_invoice:CINV-1'],
  canConfirm: true,
  items: [
    { key: 'b', group: 'Kas & bank', label: 'Rekening TESTBANK', sourceType: 'bank_account', sourceId: 'BA-1', role: 'cash', side: 'debit', amountMinor: '118000000' },
    { key: 'c', group: 'Belum direkonsiliasi', label: 'Saldo awal belum direkonsiliasi', sourceType: 'equity', sourceId: 'clearing', role: 'opening-clearing', side: 'credit', amountMinor: '158000000' }
  ],
  decisions: [{ key: 'customer_invoice:CINV-1', kind: 'customer-invoice', sourceId: 'CINV-1', label: 'Invoice INV-1', amountMinor: '100000000', suggestion: 'unearned', options: ['earned', 'unearned'] }],
  exceptions: [],
  confirmed: null
}

describe('saldo awal', () => {
  it('shows the clearing still open and preselects the suggestion, sending business decisions only', async () => {
    const view = mount(AccountingOpeningPlan, { props: { plan, canDecide: true, pending: false } })
    expect(view.text()).toContain('Belum direkonsiliasi Rp')
    expect((view.get('input[value="unearned"]').element as HTMLInputElement).checked).toBe(true)
    await view.get('input[name="capital"]').setValue('100000000')
    await view.get('button[type="button"]').trigger('click')
    expect(view.emitted('preview')?.[0]?.[0]).toEqual({ invoices: { 'CINV-1': 'unearned' }, vendorInvoices: {}, equity: { capitalMinor: '100000000' } })
    await view.get('input[value="earned"]').setValue(true)
    await view.get('input[name="reason"]').setValue('Rekening koran 31 Agustus')
    await view.get('form').trigger('submit')
    expect(view.emitted('confirm')?.[0]?.[0]).toMatchObject({ planHash: 'a'.repeat(64), decisions: { invoices: { 'CINV-1': 'earned' } }, reason: 'Rekening koran 31 Agustus' })
  })
  it('production plans are preview-only and confirmed plans show their state', () => {
    const prod = mount(AccountingOpeningPlan, { props: { plan: { ...plan, bookPurpose: 'production', canConfirm: false }, canDecide: true, pending: false } })
    expect(prod.text()).toContain('hanya pratinjau')
    expect(prod.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    const done = mount(AccountingOpeningPlan, { props: { plan: { ...plan, confirmed: { planHash: 'a'.repeat(64), validated: true, confirmedAt: '2026-10-21T00:00:00Z' } }, canDecide: true, pending: false } })
    expect(done.text()).toContain('Sudah disahkan'); expect(done.find('form').exists()).toBe(false)
  })
})
