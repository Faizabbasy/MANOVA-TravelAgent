import { describe, expect, it } from 'vitest'
import { profileChangeRows } from './profile-changes'

describe('profile change rows (S12c-1)', () => {
  it('lists each proposed field with its label, the current value and the proposed one', () => {
    const rows = profileChangeRows({ npwp: '01.234.567.8-901.234', name: 'PT Baru' }, { npwp: undefined, name: 'PT Lama' })
    expect(rows).toEqual([
      { field: 'npwp', label: 'NPWP', current: '—', proposed: '01.234.567.8-901.234' },
      { field: 'name', label: 'Nama perusahaan', current: 'PT Lama', proposed: 'PT Baru' }
    ])
  })
  it('a cleared value shows as removed', () => {
    expect(profileChangeRows({ paymentTerm: null }, { paymentTerm: 'Net 30' })[0]).toMatchObject({ current: 'Net 30', proposed: '(dikosongkan)' })
  })
})
