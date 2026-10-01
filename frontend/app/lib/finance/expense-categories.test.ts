import { describe, expect, it } from 'vitest'
import { CATEGORY_LABEL, DRAFT_INVOICE_TYPES, INVOICE_TYPE_LABEL, PROJECT_EXPENSE_CATEGORIES } from './labels'

describe('expense categories', () => {
  it('project categories (Pengeluaran tab) have Indonesian labels', () => {
    expect(PROJECT_EXPENSE_CATEGORIES).toEqual(['transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other'])
    expect(PROJECT_EXPENSE_CATEGORIES.map(c => CATEGORY_LABEL[c])).toEqual(['Transportasi', 'Konsumsi', 'Perlengkapan', 'Akomodasi', 'Darurat', 'Lainnya'])
  })

  it('every invoice type the server sends has a label, debit notes included', () => {
    for (const type of ['dp', 'progress', 'final', 'other', 'debit_note']) {
      expect(INVOICE_TYPE_LABEL[type as keyof typeof INVOICE_TYPE_LABEL], type).toBeTruthy()
    }
    expect(INVOICE_TYPE_LABEL.debit_note).toBe('Debit note')
  })

  it('invoice and billing-plan forms never offer debit_note (the server refuses it as a draft type)', () => {
    expect(DRAFT_INVOICE_TYPES).toEqual(['dp', 'progress', 'final', 'other'])
  })

  it('every category the server accepts has a label', () => {
    const server = ['payroll', 'office', 'marketing', 'technology', 'travel', 'professional', 'bank_fee', 'tax', 'transportation', 'meals', 'supplies', 'accommodation', 'emergency', 'other']
    for (const c of server) { expect(CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL], c).toBeTruthy() }
  })
})
