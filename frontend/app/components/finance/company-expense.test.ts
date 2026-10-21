// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FinanceCompanyExpenseForm from './FinanceCompanyExpenseForm.vue'

const props = {
  mode: 'schedule' as const,
  today: '2026-10-21',
  pending: false,
  vendors: [{ value: 'VND-1', label: 'Pemilik gedung' }],
  schedules: [{ id: 'CES-1', vendorId: 'VND-1', vendorName: 'Pemilik gedung', description: 'Sewa kantor', amountMinor: '10000000', startMonth: '2026-09', months: 12, dueDay: 28, stopsOn: null }]
}
describe('owner recurring expense action', () => {
  it('requires confirmation and sends contract plans without choosing a money or recognition policy', async () => {
    const view = mount(FinanceCompanyExpenseForm, { props })
    expect(view.text()).toContain('Belum menjadi biaya, invoice, atau pembayaran')
    for (const [name, value] of Object.entries({ vendorId: 'VND-1', description: 'Sewa kantor', category: 'office', amountMinor: '123456789012345', reference: 'KONTRAK-1', period: '2026-11', months: '12', dueDay: '28' })) {
      await view.get(`[name="${name}"]`).setValue(value)
    }
    await view.get('form').trigger('submit')
    expect(view.emitted('schedule')).toBeUndefined()
    await view.get('[name="confirmed"]').setValue(true)
    await view.get('form').trigger('submit')
    expect(view.emitted('schedule')?.[0]?.[0]).toEqual({ vendorId: 'VND-1', description: 'Sewa kantor', category: 'office', amountMinor: '123456789012345', contractRef: 'KONTRAK-1', startMonth: '2026-11', months: 12, dueDay: 28 })
  })
  it('reuses schedule facts and allows an evidenced actual amount without sending duplicate vendor facts', async () => {
    const view = mount(FinanceCompanyExpenseForm, { props: { ...props, mode: 'expense' } })
    await view.get('[name="scheduleId"]').setValue('CES-1')
    expect(view.find('[name="vendorId"]').exists()).toBe(false)
    expect((view.get('[name="amountMinor"]').element as HTMLInputElement).value).toBe('10000000')
    expect((view.get('[name="basis"]').element as HTMLSelectElement).value).toBe('')
    for (const [name, value] of Object.entries({ amountMinor: '12000000', reference: 'BUKTI-OKTOBER', incurredOn: '2026-10-20', basis: 'actual' })) {
      await view.get(`[name="${name}"]`).setValue(value)
    }
    await view.get('[name="confirmed"]').setValue(true)
    await view.get('form').trigger('submit')
    expect(view.emitted('expense')?.[0]?.[0]).toEqual({ scheduleId: 'CES-1', period: '2026-10', amountMinor: '12000000', incurredOn: '2026-10-20', evidenceRef: 'BUKTI-OKTOBER', basis: 'actual' })
  })
  it('preserves facts after a server error and prevents another submission while saving', async () => {
    const view = mount(FinanceCompanyExpenseForm, { props: { ...props, mode: 'expense' } })
    await view.get('[name="amountMinor"]').setValue('987654321012345')
    await view.get('[name="confirmed"]').setValue(true)
    await view.setProps({ pending: true, error: 'Klasifikasi belum tervalidasi.', fieldErrors: { category: ['Periksa kebijakan sumber.'] } })
    expect(view.get('[role="alert"]').text()).toContain('Periksa kebijakan sumber')
    expect((view.get('[name="amountMinor"]').element as HTMLInputElement).value).toBe('987654321012345')
    await view.get('form').trigger('submit')
    expect(view.emitted('expense')).toBeUndefined()
    expect(view.get('fieldset').attributes('disabled')).toBeDefined()
    await view.setProps({ pending: false })
    await view.get('form').trigger('submit')
    expect(view.emitted('expense')).toHaveLength(1)
  })
})
