import { describe, expect, it } from 'vitest'
import { CATEGORY_LABEL, PROJECT_EXPENSE_CATEGORIES } from './labels'

describe('expense categories', () => {
  it('project categories (Pengeluaran tab) have Indonesian labels', () => {
    expect(PROJECT_EXPENSE_CATEGORIES).toEqual(['transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other'])
    expect(PROJECT_EXPENSE_CATEGORIES.map(c => CATEGORY_LABEL[c])).toEqual(['Transportasi', 'Konsumsi', 'Perlengkapan', 'Akomodasi', 'Darurat', 'Lainnya'])
  })

  it('every category the server accepts has a label', () => {
    const server = ['payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other']
    for (const c of server) { expect(CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL], c).toBeTruthy() }
  })
})
