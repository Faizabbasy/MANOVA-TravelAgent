import { describe, expect, it } from 'vitest'
import { createSaveGate, showStoredValue } from './save-gate'
import { isMilestonePlanLocked } from '~/data/project-order-workflow'

describe('save gate (S7c review)', () => {
  it('a second save while one is running is refused with a notice, not dropped silently', async () => {
    const toasts: string[] = []
    const gate = createSaveGate((title, _message, tone) => toasts.push(`${tone}:${title}`))
    let release!: () => void
    const first = gate.run('Gagal A', () => new Promise<string>((resolve) => { release = () => resolve('ok') }))
    expect(gate.saving.value).toBe(true)
    expect(await gate.run('Gagal B', () => Promise.resolve('x'))).toBeUndefined()
    expect(toasts).toEqual(['info:Tunggu Sebentar'])
    release()
    expect(await first).toBe('ok')
    expect(gate.saving.value).toBe(false)
  })

  it('a failed save shows the reason and returns undefined', async () => {
    const toasts: string[] = []
    const gate = createSaveGate((title, message, tone) => toasts.push(`${tone}:${title}:${message}`))
    expect(await gate.run('Task Gagal Disimpan', () => Promise.reject(new Error('boom')))).toBeUndefined()
    expect(toasts).toEqual(['error:Task Gagal Disimpan:Server belum bisa dihubungi. Coba lagi.'])
  })

  it('an input shows the stored value until the server answers', () => {
    const box = { type: 'checkbox', checked: true, value: 'on' }
    showStoredValue(box, false)
    expect(box.checked).toBe(false)
    const date = { type: 'date', checked: false, value: '2026-11-05' }
    showStoredValue(date, '2026-11-01')
    expect(date.value).toBe('2026-11-01')
  })
})

describe('milestone planned-date lock matches the server', () => {
  it('only Drafting statuses (draft, planning) are editable', () => {
    expect(isMilestonePlanLocked({ status: 'draft' })).toBe(false)
    expect(isMilestonePlanLocked({ status: 'planning' })).toBe(false)
    for (const status of ['confirmed', 'in-progress', 'ongoing-trip', 'completed', 'on-hold', 'cancelled'] as const) {
      expect(isMilestonePlanLocked({ status })).toBe(true)
    }
  })
})
