// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountingProjectSummary from './AccountingProjectSummary.vue'
import type { ProjectAccountingSummaryDto } from '~/types/api'

const base: ProjectAccountingSummaryDto = {
  projectId: 'PRJ-1',
  contractValueMinor: '100000000',
  budgetMinor: '80000000',
  remainingCommitmentMinor: '0',
  status: { operational: 'completed', cashSettled: false, closed: false },
  available: true,
  basis: 'rehearsal',
  reasons: [{ code: 'REHEARSAL_ONLY', message: 'Hasil rehearsal.' }],
  accountingReview: { pendingCount: 0, estimateCount: 0, complete: true },
  figures: {
    recognizedRevenueMinor: '100000000',
    recognizedDirectCostMinor: '80000000',
    contributionMinor: '20000000',
    otherProjectCostMinor: '0',
    deferredRevenueMinor: '0',
    unbilledRevenueMinor: '0',
    receivableMinor: '70000000',
    payableMinor: '60000000',
    accruedCostMinor: '0',
    prepaidCostMinor: '0',
    supplierAdvanceMinor: '0',
    estimatedFinalCostMinor: '80000000'
  }
}

describe('hasil accounting project', () => {
  it('keeps operational, accounting review and cash settlement apart: completed with open AR/AP still shows profit', () => {
    const view = mount(AccountingProjectSummary, { props: { summary: base } })
    expect(view.text()).toContain('Selesai operasional')
    expect(view.text()).toContain('Lengkap')
    expect(view.text()).toContain('Masih ada tagihan/utang')
    expect(view.text()).toContain('Rp 20.000.000')
    expect(view.text()).not.toContain('Lunas')
  })
  it('never shows zero for an unavailable book', () => {
    const view = mount(AccountingProjectSummary, { props: { summary: { ...base, available: false, basis: null, figures: null, accountingReview: null, reasons: [] } } })
    expect(view.text()).toContain('belum tersedia')
    expect(view.text()).not.toContain('Rp 0')
  })
})
