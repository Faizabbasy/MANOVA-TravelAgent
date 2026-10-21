// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Proposal from './AccountingPolicyProposalForm.vue'
import Rehearsal from './AccountingPolicyRehearsalForm.vue'
import type { AccountingPolicyDto } from '~/types/api'
describe('owner policy proposals and isolated rehearsal', () => {
  it('keeps unknown decisions and unmapped categories unknown until explicitly selected; pending retains the form', async () => {
    const v = mount(Proposal, { props: { purpose: 'production', pending: false } })
    await v.get('[name="effectiveFrom"]').setValue('2026-09-01'); await v.get('[name="rationale"]').setValue('Menunggu keputusan usaha')
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toMatchObject({ principalAgent: 'unknown', recognition: 'unknown', taxTreatment: 'unknown', settings: {} })
    expect(v.find('[name="debitMinor"]').exists()).toBe(false)
    expect(v.find('option[value="TEST_ONLY_EXCLUDED"]').exists()).toBe(false)
    await v.get('[name="sourceKind"]').setValue('manual_cash')
    expect((v.get('[name="classification-office"]').element as HTMLSelectElement).value).toBe('')
    await v.get('[name="classification-office"]').setValue('office-expense')
    await v.setProps({ pending: true, error: 'Koneksi terputus; kirim ulang' })
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toHaveLength(1)
    expect((v.get('[name="rationale"]').element as HTMLInputElement).value).toBe('Menunggu keputusan usaha')
    expect(v.get('[role="alert"]').text()).toContain('Koneksi terputus')
    await v.setProps({ pending: false }); await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[1]?.[0]).toMatchObject({ sourceKind: 'manual_cash', settings: { classifications: { office: 'office-expense' } } })
  })
  it('submits explicit supplier source methods and clears incompatible settings when the source changes', async () => {
    const v = mount(Proposal, { props: { purpose: 'rehearsal', pending: false } })
    await v.get('[name="sourceKind"]').setValue('vendor_billing')
    for (const [name, value] of Object.entries({ effectiveFrom: '2026-09-01', principalAgent: 'principal', recognition: 'supplier-fulfillment', taxTreatment: 'TEST_ONLY_EXCLUDED', costMatching: 'receipt-links', invoiceTreatment: 'prepaid', rationale: 'TEST_ONLY receipt links' })) { await v.get(`[name="${name}"]`).setValue(value) }
    await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toMatchObject({ recognition: 'supplier-fulfillment', settings: { costMatching: 'receipt-links', invoiceTreatment: 'prepaid' } })
    await v.get('[name="sourceKind"]').setValue('company_expense'); await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[1]?.[0]).toMatchObject({ principalAgent: 'unknown', recognition: 'unknown', settings: {} })
  })
  it('rehearsal needs a reason and explicit TEST_ONLY confirmation; errors retain the intent', async () => {
    const policy:AccountingPolicyDto = { id: 'APL-1', version: 1, validationStatus: 'draft', sourceKind: 'customer_billing', effectiveFrom: '2026-09-01', principalAgent: 'principal', recognition: 'fulfillment', taxTreatment: 'TEST_ONLY_EXCLUDED', rationale: 'TEST_ONLY draft', settings: { billingRight: 'unconditional' } }
    const v = mount(Rehearsal, { props: { policy, pending: false } })
    await v.get('[name="reason"]').setValue('TEST_ONLY isolated facts checked')
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    await v.get('[name="confirm"]').setValue(true)
    await v.setProps({ pending: true, error: 'Metode sumber belum lengkap' })
    await v.get('form').trigger('submit'); expect(v.emitted('save')).toBeUndefined()
    expect(v.get('[role="alert"]').text()).toBe('Metode sumber belum lengkap')
    await v.setProps({ pending: false }); await v.get('form').trigger('submit')
    expect(v.emitted('save')?.[0]?.[0]).toEqual({ reason: 'TEST_ONLY isolated facts checked', confirm: true })
    expect(v.text()).toContain('bukan kebijakan produksi')
  })
})
