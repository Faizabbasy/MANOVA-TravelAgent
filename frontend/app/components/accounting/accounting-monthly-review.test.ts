// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccountingMonthlyReview from './AccountingMonthlyReview.vue'
import type { AccountingPeriodReviewDto } from '~/types/api'

const review = (blockers: number): AccountingPeriodReviewDto => ({
  period: { id: 'ACP-1', startsOn: '2026-09-01', endsOn: '2026-09-30', status: 'open', version: 3 },
  bookPurpose: 'rehearsal',
  readyToClose: blockers === 0,
  blockers,
  checks: [
    { code: 'SOURCES_POSTED', status: blockers ? 'blocker' : 'ok', title: 'Semua transaksi sumber sudah dibukukan', detail: blockers ? '1 transaksi menunggu kebijakan.' : 'Tidak ada.', action: blockers ? { label: 'Lihat pekerjaan tertunda', to: '/finance/accounting#pekerjaan' } : null },
    { code: 'TAX_PROFILE', status: 'warning', title: 'Profil pajak', detail: 'Belum tervalidasi.', action: null }
  ]
})
const stubs = { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } }

describe('cek bulanan', () => {
  it('cannot close with a blocker and points to where it is fixed', async () => {
    const view = mount(AccountingMonthlyReview, { props: { review: review(1), canClose: true, pending: false }, ...stubs })
    expect(view.text()).toContain('1 hal harus diselesaikan')
    expect(view.get('a').attributes('href')).toBe('/finance/accounting#pekerjaan')
    await view.get('textarea').setValue('TEST_ONLY catatan')
    await view.get('input[name="confirm"]').setValue(true)
    expect(view.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
  it('closes only with a note and explicit confirmation, sending the version it was reviewed at', async () => {
    const view = mount(AccountingMonthlyReview, { props: { review: review(0), canClose: true, pending: false }, ...stubs })
    expect(view.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await view.get('textarea').setValue('September diperiksa')
    await view.get('input[name="confirm"]').setValue(true)
    await view.get('form').trigger('submit')
    expect(view.emitted('close')?.[0]?.[0]).toEqual({ version: 3, reason: 'September diperiksa', confirm: true })
    const readonly = mount(AccountingMonthlyReview, { props: { review: review(0), canClose: false, pending: false }, ...stubs })
    expect(readonly.find('form').exists()).toBe(false)
  })
})
