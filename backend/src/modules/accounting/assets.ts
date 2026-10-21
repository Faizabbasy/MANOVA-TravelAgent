import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import { AppError, errors } from '../../http/errors'
import { postBusinessEvent } from './posting'
import { roleCodes } from './recognition'
import { getBook } from './setup'

/** One month of straight-line depreciation: expense vs accumulated depreciation, identity asset:period (never twice). */
export async function postDepreciationSource(tx: Queryable, actor: Actor, assetId: string, period: string, requestId: string) {
  const [d] = await tx.query<{ amount_minor: string; end: string }>(`select amount_minor,
    (date_trunc('month', (period || '-01')::date) + interval '1 month - 1 day')::date::text as end from asset_depreciations where asset_id=$1 and period=$2`, [assetId, period])
  if (!d) throw errors.notFound('Penyusutan aset')
  const book = await getBook(tx, true)
  if (!book || book.mode === 'off') return
  if (d.end < book.cutover_date) {
    if (book.mode === 'active') throw new AppError(422, 'ACCOUNTING_REVIEW_REQUIRED', 'Penyusutan sebelum cutover termasuk saldo awal aset, bukan jurnal baru.')
    return
  }
  const code = await roleCodes(tx, book)
  return postBusinessEvent(tx, actor, { sourceType: 'asset_depreciation', sourceId: `${assetId}:${period}`, sourceVersion: '1', kind: 'source_recorded', effectiveDate: d.end,
    snapshot: { assetId, period, amountMinor: d.amount_minor }, policyKind: 'asset', description: `Penyusutan ${assetId} ${period}`,
    lines: [{ accountCode: code('depreciation'), debitMinor: d.amount_minor, creditMinor: '0' }, { accountCode: code('accumulated-depreciation'), debitMinor: '0', creditMinor: d.amount_minor }] }, requestId)
}
