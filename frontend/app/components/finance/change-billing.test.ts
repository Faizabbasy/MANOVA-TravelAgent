// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Form from './FinanceChangeBillingForm.vue'
import type { ChangeBillingDto } from '~/types/api'
const source: ChangeBillingDto = { changeRequestId: 'CR-1', projectId: 'PRJ-1', changeStatus: 'approved', commercialMinor: '123456789012345', feeMinor: '2', needsDecision: true, plans: [], targets: [{ salesOrderId: null, partyName: 'Organiser', contractMinor: '100000000000000' }, { salesOrderId: 'SLO-1', partyName: 'Peserta', contractMinor: '100000000000000' }] }
describe('commercial change billing decision', () => {
  it('requires explicit basis, matching exact allocation and confirmation; no money is implied', async () => {
    const v = mount(Form, { props: { source, pending: false } })
    await v.get('[name="mode"]').setValue('charge')
    expect((v.get('[name="basis"]').element as HTMLSelectElement).value).toBe('')
    for (const [name, value] of Object.entries({ basis: 'commercial', 'target-0': 'SLO-1', 'amount-0': '123456789012344', 'due-0': '2026-11-01', reason: 'Persetujuan tambahan peserta' })) { await v.get(`[name="${name}"]`).setValue(value) }
    await v.get('[name="confirmed"]').setValue(true)
    await v.get('form').trigger('submit')
    expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="amount-0"]').setValue('123456789012345')
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toEqual({ mode: 'charge', basis: 'commercial', reason: 'Persetujuan tambahan peserta', allocations: [{ salesOrderId: 'SLO-1', amountMinor: '123456789012345', dueDate: '2026-11-01' }] })
    expect(v.text()).toContain('belum menerima uang')
  })
  it('no-charge requires its reason and confirmation, while pending prevents duplicate submission', async () => {
    const v = mount(Form, { props: { source, pending: false } })
    await v.get('[name="mode"]').setValue('no-charge')
    await v.get('[name="reason"]').setValue('Goodwill disetujui owner')
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="confirmed"]').setValue(true)
    await v.setProps({ pending: true, error: 'Periksa sumber persetujuan' })
    expect(v.get('[role="alert"]').text()).toBe('Periksa sumber persetujuan')
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.setProps({ pending: false })
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toEqual({ mode: 'no-charge', basis: 'none', reason: 'Goodwill disetujui owner', allocations: [] })
  })
})
