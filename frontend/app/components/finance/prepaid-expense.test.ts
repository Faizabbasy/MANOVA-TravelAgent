// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FinancePrepaidExpenseForm from './FinancePrepaidExpenseForm.vue'

const props = { today: '2026-10-21', accounts: [{ value: 'BA-1', label: 'Rekening operasional' }], pending: false }
async function fill (view: ReturnType<typeof mount>) {
  for (const [field, value] of Object.entries({
    description: 'Sewa kantor setahun',
    evidenceRef: 'KONTRAK-2026-001',
    bankAccountId: 'BA-1',
    amountMinor: '123456789012345',
    effectiveDate: '2026-10-01',
    startMonth: '2026-10',
    months: '12'
  })) {
    await view.get(`[name="${field}"]`).setValue(value)
  }
}
describe('owner prepayment action', () => {
  it('requires an explicit method and sends one payment plus service facts, without journal input or money rounding', async () => {
    const view = mount(FinancePrepaidExpenseForm, { props })
    expect(view.text()).toContain('Kas keluar sekali')
    expect(view.text()).toContain('bukan unggahan file')
    await fill(view)
    expect(view.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await view.get('[name="method"]').setValue('equal-months')
    await view.get('form').trigger('submit')
    expect(view.emitted('submit')?.[0]?.[0]).toEqual({
      bankAccountId: 'BA-1',
      amountMinor: '123456789012345',
      effectiveDate: '2026-10-01',
      description: 'Sewa kantor setahun',
      evidenceRef: 'KONTRAK-2026-001',
      startMonth: '2026-10',
      months: 12,
      method: 'equal-months'
    })
  })
  it('retains input through a server error and blocks duplicate submissions while pending', async () => {
    const view = mount(FinancePrepaidExpenseForm, { props })
    await fill(view); await view.get('[name="method"]').setValue('equal-months')
    await view.setProps({ error: 'Kebijakan belum tervalidasi.', fieldErrors: { startMonth: 'Periksa awal manfaat.' } })
    expect(view.get('[role="alert"]').text()).toContain('Kebijakan')
    expect(view.text()).toContain('Periksa awal manfaat')
    expect((view.get('[name="amountMinor"]').element as HTMLInputElement).value).toBe('123456789012345')
    await view.setProps({ pending: true })
    await view.get('form').trigger('submit')
    expect(view.emitted('submit')).toBeUndefined()
    expect(view.get('fieldset').attributes('disabled')).toBeDefined()
    await view.setProps({ pending: false })
    await view.get('form').trigger('submit')
    expect(view.emitted('submit')).toHaveLength(1)
  })
})
