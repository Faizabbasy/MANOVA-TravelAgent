import { describe, expect, it } from 'vitest'
import { suggestAllocation } from './allocation'

const t = (id: string, outstandingMinor: string) => ({ id, title: id, subtitle: '', dueDate: null, outstandingMinor })

describe('suggestAllocation', () => {
  const targets = [t('A', '100'), t('B', '250'), t('C', '50')]

  it('fills oldest first and never exceeds what an invoice owes', () => {
    expect(suggestAllocation(targets, '300')).toEqual({ A: '100', B: '200' })
  })

  it('keeps the remainder unallocated when the payment is larger than everything owed', () => {
    expect(suggestAllocation(targets, '1000')).toEqual({ A: '100', B: '250', C: '50' })
  })

  it('settles the focused invoice first', () => {
    expect(suggestAllocation(targets, '120', 'C')).toEqual({ C: '50', A: '70' })
  })

  it('empty or zero amount allocates nothing; exact beyond Number precision', () => {
    expect(suggestAllocation(targets, '')).toEqual({})
    expect(suggestAllocation(targets, '0')).toEqual({})
    expect(suggestAllocation([t('X', '900719925474099312')], '900719925474099311')).toEqual({ X: '900719925474099311' })
  })
})
