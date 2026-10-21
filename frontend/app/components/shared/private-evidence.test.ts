// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Form from './PrivateEvidenceForm.vue'
describe('private evidence form', () => {
  it('keeps sharing off and submits the actual File once; retry preserves the selected bytes', async () => {
    const v = mount(Form, { props: { pending: false, allowSharing: true }, global: { stubs: { Button: { template: '<button><slot /></button>' } } } })
    const file = new File(['%PDF-1.4\nTEST_ONLY'], 'asli.pdf', { type: 'application/pdf' })
    const input = v.get('[name="private-evidence"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await v.get('form').trigger('submit')
    expect(v.emitted('upload')?.[0]).toEqual([file, 'internal'])
    await v.setProps({ pending: true, error: 'File belum tersimpan. Coba lagi.' })
    await v.get('form').trigger('submit')
    expect(v.emitted('upload')).toHaveLength(1)
    expect(v.get('[role="alert"]').text()).toContain('Coba lagi')
    await v.setProps({ pending: false })
    await v.get('[name="share-with-source-party"]').setValue(true)
    await v.get('form').trigger('submit')
    expect(v.emitted('upload')?.[1]).toEqual([file, 'source-party'])
  })
  it('does not submit an oversized or empty file', async () => {
    const v = mount(Form, { props: { pending: false } })
    const input = v.get('[name="private-evidence"]')
    Object.defineProperty(input.element, 'files', { value: [new File([], 'empty.pdf')], configurable: true })
    await input.trigger('change'); await v.get('form').trigger('submit')
    expect(v.emitted('upload')).toBeUndefined(); expect(v.get('[role="alert"]').text()).toContain('berisi data')
    const large = new File(['x'], 'large.pdf'); Object.defineProperty(large, 'size', { value: 10485761 })
    Object.defineProperty(input.element, 'files', { value: [large], configurable: true })
    await input.trigger('change'); await v.get('form').trigger('submit')
    expect(v.emitted('upload')).toBeUndefined()
  })
})
