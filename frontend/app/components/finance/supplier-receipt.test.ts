// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Form from './FinanceSupplierReceiptForm.vue'
import type { SupplierReceiptWorkspaceDto } from '~/types/api'
const source:SupplierReceiptWorkspaceDto = { invoiceId: 'VI-1', status: 'approved', invoiceDate: '2026-09-30', totalMinor: '123456789012345', remainingMinor: '123456789012345', mode: 'receipt-links', truncated: false, matches: [], receipts: [{ id: 'SFL-1', fulfilledOn: '2026-10-02', amountMinor: '123456789012344', remainingMinor: '123456789012344', basis: 'estimate', evidence: 'Actual service receipt' }] }
describe('owner matches an actual invoice to an existing service receipt', () => {
  it('prefills source facts and requires explicit final confirmation for a variance, preserving exact money', async () => {
    const v = mount(Form, { props: { source, today: '2026-10-21', pending: false } })
    await v.get('[name="fulfillmentId"]').setValue('SFL-1')
    expect((v.get('[name="actualMinor"]').element as HTMLInputElement).value).toBe('123456789012345')
    expect((v.get('[name="postingDate"]').element as HTMLInputElement).value).toBe('2026-10-02')
    expect((v.get('[name="closesReceipt"]').element as HTMLInputElement).checked).toBe(false)
    await v.get('[name="actualMinor"]').setValue('123456789012345')
    await v.get('[name="reason"]').setValue('Final supplier invoice checked')
    await v.get('[name="confirmed"]').setValue(true)
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="closesReceipt"]').setValue(true)
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toEqual({ fulfillmentId: 'SFL-1', actualMinor: '123456789012345', closesReceipt: true, postingDate: '2026-10-02', reason: 'Final supplier invoice checked' })
    expect(v.text()).toContain('tidak membayar uang')
  })
  it('partial invoice leaves estimate open; early date, unconfirmed and pending submissions are blocked', async () => {
    const v = mount(Form, { props: { source, today: '2026-10-21', pending: false } })
    await v.get('[name="fulfillmentId"]').setValue('SFL-1')
    await v.get('[name="actualMinor"]').setValue('30000000')
    await v.get('[name="reason"]').setValue('First partial invoice checked')
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="confirmed"]').setValue(true)
    await v.get('[name="postingDate"]').setValue('2026-09-30')
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="postingDate"]').setValue('2026-10-03')
    await v.setProps({ pending: true, error: 'Periode dikunci' })
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    expect(v.get('[role="alert"]').text()).toBe('Periode dikunci')
    await v.setProps({ pending: false })
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toMatchObject({ actualMinor: '30000000', closesReceipt: false, postingDate: '2026-10-03' })
  })
})
