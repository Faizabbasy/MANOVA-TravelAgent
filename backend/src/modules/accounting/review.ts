import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { recordAudit } from '../../shared/audit'
import { getBook } from './setup'
import { missingPrepaidMonths } from './prepaid-completeness'
import { unmatchedSupplierEstimates } from './supplier-completeness'

/**
 * "Cek bulanan": one server-side checklist for a period, in business language, each item pointing at the source
 * screen that resolves it. Blockers stop closing; warnings are shown but do not force paying open AR/AP or
 * inventing invoices. Closing locks the period (posting refuses it) — correction later goes through reopen.
 */
export type CheckStatus = 'ok' | 'warning' | 'blocker'
export interface ReviewCheck { code: string; status: CheckStatus; title: string; detail: string; action: { label: string; to: string } | null }

export async function periodReview(tx: Queryable, periodId: string) {
  const book = await getBook(tx)
  if (!book) throw errors.notFound('Profil accounting')
  const [p] = await tx.query<{ id: string; starts_on: string; ends_on: string; status: string; version: number }>(
    'select id, starts_on, ends_on, status, version from accounting_periods where id = $1 and book_id = $2', [periodId, book.id])
  if (!p) throw errors.notFound('Periode accounting')
  const end = p.ends_on, start = p.starts_on
  const checks: ReviewCheck[] = []
  const add = (c: ReviewCheck) => checks.push(c)

  // 1. Cash per account: ledger = cash book (verified opening + movements) at period end.
  const cash = await tx.query<{ id: string; code: string; book_minor: string; gl_minor: string }>(`
    select a.id, a.code,
      (a.opening_balance_minor + coalesce((select sum(case when t.direction = 'in' then t.amount_minor else -t.amount_minor end) from financial_transactions t
        where t.bank_account_id = a.id and t.effective_date <= $2 and t.effective_date >= a.opening_date), 0))::text as book_minor,
      coalesce((select sum(l.debit_minor - l.credit_minor) from accounting_journal_lines l join accounting_journals j on j.id = l.journal_id and j.status = 'posted'
        where l.book_id = $1 and l.bank_account_id = a.id and j.effective_date <= $2), 0)::text as gl_minor
    from bank_accounts a where a.opening_status = 'verified' order by a.code`, [book.id, end])
  const cashOff = cash.filter(c => c.book_minor !== c.gl_minor)
  add({ code: 'CASH_MATCH', status: cashOff.length ? 'blocker' : 'ok', title: 'Saldo kas & bank cocok dengan buku',
    detail: cashOff.length ? `Selisih pada rekening ${cashOff.map(c => `${c.code} (buku kas ${c.book_minor}, accounting ${c.gl_minor})`).join(', ')}. Biasanya saldo awal belum dipetakan atau ada sumber pending.`
      : `${cash.length} rekening cocok per ${end}.`, action: cashOff.length ? { label: 'Buka rekening', to: '/finance/accounts' } : null })
  // Bank statements: every imported line of the period must be reconciled; accounts without an import stay a visible warning.
  const statements = await tx.query<{ code: string; lines: string; open: string }>(`select a.code, count(l.id) as lines,
      count(l.id) filter (where l.amount_minor > coalesce((select sum(m.amount_minor) from bank_reconciliation_matches m join financial_transactions t on t.id = m.transaction_id
        where m.statement_line_id = l.id and m.unmatched_at is null and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id)), 0)) as open
    from bank_accounts a left join bank_statement_lines l on l.bank_account_id = a.id and l.booked_on between $1 and $2
    where a.opening_status = 'verified' group by a.code order by a.code`, [start, end])
  const openLines = statements.filter(s => BigInt(s.open) > 0n)
  const missing = statements.filter(s => BigInt(s.lines) === 0n)
  add({ code: 'BANK_STATEMENT', status: openLines.length ? 'blocker' : missing.length ? 'warning' : 'ok', title: 'Rekening koran dicocokkan',
    detail: openLines.length ? `Baris rekening koran belum cocok: ${openLines.map(s => `${s.code} (${s.open})`).join(', ')}.`
      : missing.length ? `Belum ada rekening koran yang diimpor untuk ${missing.map(s => s.code).join(', ')}; cocokkan saldo akhir secara manual atau impor CSV.`
        : 'Semua baris rekening koran periode ini sudah cocok.',
    action: openLines.length || missing.length ? { label: 'Cocokkan rekening koran', to: '/finance/reconciliation' } : null })

  // 2. Every source event of the period is booked.
  const [pending] = await tx.query<{ n: string }>(`select count(*) as n from accounting_posting_registry r join accounting_events e on e.id = r.event_id
    where r.book_id = $1 and r.status = 'pending' and e.effective_date between $2 and $3`, [book.id, start, end])
  add({ code: 'SOURCES_POSTED', status: BigInt(pending!.n) > 0n ? 'blocker' : 'ok', title: 'Semua transaksi sumber sudah dibukukan',
    detail: BigInt(pending!.n) > 0n ? `${pending!.n} transaksi menunggu kebijakan atau fakta tambahan.` : 'Tidak ada transaksi tertunda pada periode ini.',
    action: BigInt(pending!.n) > 0n ? { label: 'Lihat pekerjaan tertunda', to: '/finance/accounting#pekerjaan' } : null })

  // 3. Supplier costs still on estimate (allowed, but must be visible).
  const estimates = await unmatchedSupplierEstimates(tx,book,end)
  add({ code: 'ACCRUALS', status: BigInt(estimates!.n) > 0n ? 'warning' : 'ok', title: 'Biaya supplier yang masih estimasi',
    detail: BigInt(estimates!.n) > 0n ? `${estimates!.n} penerimaan jasa (sisa estimasi ${estimates!.total}) belum dicocokkan penuh. Laba masih memakai estimasi; setujui dan tautkan invoice aktual ke sumber yang tepat.` : 'Tidak ada estimasi terbuka.',
    action: BigInt(estimates!.n)>0n ? {label:'Buka invoice supplier',to:'/finance/payables'} : null })

  // 4. Depreciation for every asset in service through this month.
  const month = end.slice(0, 7)
  const [dep] = await tx.query<{ n: string }>(`select count(*) as n from asset_capitalizations c where to_char(c.in_service_on, 'YYYY-MM') <= $1
    and exists (select 1 from financial_transactions t where t.asset_id = c.asset_id and t.kind = 'asset_purchase' and t.reversal_of_id is null
      and not exists (select 1 from financial_transactions r where r.reversal_of_id = t.id))
    and (select count(*) from asset_depreciations d where d.asset_id = c.asset_id and d.period <= $1) <
        least(c.useful_life_months, ((extract(year from to_date($1, 'YYYY-MM')) - extract(year from c.in_service_on)) * 12 + extract(month from to_date($1, 'YYYY-MM')) - extract(month from c.in_service_on) + 1)::int)`, [month])
  add({ code: 'DEPRECIATION', status: BigInt(dep!.n) > 0n ? 'blocker' : 'ok', title: 'Penyusutan aset bulan ini',
    detail: BigInt(dep!.n) > 0n ? `${dep!.n} aset belum disusutkan sampai ${month}.` : 'Penyusutan lengkap.', action: BigInt(dep!.n) > 0n ? { label: 'Hitung penyusutan', to: '/finance/funding' } : null })

  // Office prepayments must be recognised through every completed service month; paying rent is not the expense itself.
  const prepaid = await missingPrepaidMonths(tx, end)
  add({ code: 'PREPAID_OPEX', status: prepaid.length ? 'blocker' : 'ok', title: 'Beban biaya kantor dibayar di muka',
    detail: prepaid.length ? `${prepaid.length} jadwal belum dibebankan sampai bulan manfaat yang telah berakhir.` : 'Tidak ada pembebanan bulanan yang tertinggal.',
    action: prepaid.length ? { label: 'Buka biaya dibayar di muka', to: '/finance/funding#biaya-dibayar-di-muka' } : null })

  // 5. Payroll of the month.
  const [recurring] = await tx.query<{n:string}>('select count(*) as n from v_company_expense_forecast where planned and service_date<=$1',[end])
  add({code:'RECURRING_REVIEW',status:BigInt(recurring!.n)>0n ? 'blocker' : 'ok',title:'Review biaya rutin',
    detail:BigInt(recurring!.n)>0n ? `${recurring!.n} bulan kontrak rutin belum dikonfirmasi terjadi atau dihentikan dengan alasan. Jangan membuat invoice palsu untuk menutup bulan.` : 'Rencana biaya rutin sampai periode ini sudah direview.',
    action:BigInt(recurring!.n)>0n ? {label:'Buka biaya rutin',to:'/finance/funding#biaya-rutin'} : null})
  const [run] = await tx.query<{ status: string }>('select status from payroll_runs where period = $1', [month])
  add({ code: 'PAYROLL', status: run?.status === 'draft' ? 'blocker' : run ? 'ok' : 'warning', title: 'Gaji bulan ini',
    detail: !run ? 'Belum ada payroll untuk bulan ini. Abaikan bila memang tidak ada gaji.' : run.status === 'draft' ? 'Payroll masih draft; setujui agar beban gaji masuk bulan ini.'
      : run.status === 'approved' ? 'Disetujui; utang gaji tercatat (pembayaran boleh menyusul).' : 'Disetujui dan dibayar.', action: run?.status === 'draft' ? { label: 'Buka payroll', to: '/hr' } : null })

  // 6. Staff still holding kasbon (information: evidence or return outstanding).
  const [held] = await tx.query<{ n: string }>('select count(*) as n from v_employee_fund_balances where net_minor <> 0')
  add({ code: 'STAFF_FUNDS', status: BigInt(held!.n) > 0n ? 'warning' : 'ok', title: 'Kasbon & reimbursement staf',
    detail: BigInt(held!.n) > 0n ? `${held!.n} karyawan masih memegang uang jalan atau menunggu reimbursement.` : 'Tidak ada kasbon terbuka.',
    action: BigInt(held!.n) > 0n ? { label: 'Buka kasbon', to: '/finance/staff-funds' } : null })

  // 7. Ledger arithmetic.
  const [tb] = await tx.query<{ d: string; c: string }>(`select coalesce(sum(l.debit_minor), 0) as d, coalesce(sum(l.credit_minor), 0) as c from accounting_journal_lines l
    join accounting_journals j on j.id = l.journal_id and j.status = 'posted' where l.book_id = $1 and j.effective_date <= $2`, [book.id, end])
  add({ code: 'TRIAL_BALANCE', status: tb!.d === tb!.c ? 'ok' : 'blocker', title: 'Debit = kredit', detail: tb!.d === tb!.c ? 'Neraca saldo seimbang.' : 'Neraca saldo tidak seimbang.', action: null })

  // 8. Profiles the owner still has to validate (do not block the month; they block "final"/after-tax claims).
  if (!book.opening_validated) add({ code: 'OPENING', status: 'blocker', title: 'Saldo awal', detail: 'Saldo awal belum direkonsiliasi; periode tidak dapat ditutup final.', action: null })
  if (book.tax_status !== 'validated') add({ code: 'TAX_PROFILE', status: 'warning', title: 'Profil pajak', detail: 'Belum tervalidasi; laporan hanya sampai laba sebelum pajak.', action: null })

  const blockers = checks.filter(c => c.status === 'blocker').length
  return { period: { id: p.id, startsOn: start, endsOn: end, status: p.status, version: p.version }, bookPurpose: book.purpose,
    readyToClose: blockers === 0 && p.status !== 'closed', blockers, checks }
}

/**
 * Close a period only from a fresh checklist without blockers (the ledger then refuses postings into it). Review is the
 * read above; a separate 'reviewed' status is not used because the posting guard treats any non-open period as locked.
 * Reopen stays the separate controlled command.
 */
export async function closePeriod(tx: Queryable, actor: Actor, periodId: string, input: { version: number; reason: string; confirm: boolean }, requestId: string) {
  const target = 'closed' as const
  const book = await getBook(tx, true)
  if (!book) throw errors.notFound('Profil accounting')
  const [p] = await tx.query<{ status: string; version: number }>('select status, version from accounting_periods where id = $1 and book_id = $2 for update', [periodId, book.id])
  if (!p) throw errors.notFound('Periode accounting')
  if (p.version !== input.version) throw errors.conflict('Periode telah berubah. Muat ulang cek bulanan.')
  if (p.status === 'closed') throw errors.conflict('Periode sudah ditutup.')
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < 5) throw errors.validation({ reason: ['Tuliskan catatan review minimal 5 karakter.'] })
  if (input.confirm !== true) throw errors.validation({ confirm: ['Konfirmasi bahwa Anda sudah memeriksa daftar cek bulanan.'] })
  const review = await periodReview(tx, periodId)
  if (review.blockers > 0) {
    throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', `Masih ada ${review.blockers} hal yang harus diselesaikan sebelum menutup periode.`,
      { details: { blockers: review.checks.filter(c => c.status === 'blocker').map(c => c.code) } })
  }
  await tx.query('update accounting_periods set status = $2, version = version + 1, changed_by = $3, reason = $4 where id = $1', [periodId, target, actor.userId, reason])
  await recordAudit(tx, { action: `finance.accounting_period_${target}`, actorUserId: actor.userId, entityType: 'accounting_period', entityId: periodId, requestId, reason,
    before: { status: p.status, version: p.version }, after: { status: target, version: p.version + 1, warnings: review.checks.filter(c => c.status === 'warning').map(c => c.code) } })
  return { id: periodId, status: target, version: p.version + 1 }
}
