import type { Actor } from '../../auth/rbac'
import type { Queryable } from '../../db/client'
import type { AppEnv } from '../../config/env'
import { AppError, errors } from '../../http/errors'
import { isIsoDate } from '../../shared/dates'
import { nextId } from '../../shared/ids'
import { recordAudit } from '../../shared/audit'
import { ACCOUNT_TEMPLATE, POLICY_SOURCE_KINDS } from './template'
import {validatePolicySettings,type PolicySettingsInput} from './policy-settings'

export interface BookRow extends Record<string, unknown> {
  id: string; name: string; purpose: 'rehearsal' | 'production'; mode: 'off' | 'shadow' | 'active'; currency: string
  timezone: string; entity_type: string; accounting_standard: string; owner_mode: string; tax_status: string
  cutover_date: string; opening_validated: boolean; version: number
}

export function dateInput(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isIsoDate(value)) throw errors.validation({ [field]: ['Tanggal harus berformat YYYY-MM-DD.'] })
  return value
}

export async function getBook(q: Queryable, lock = false) {
  const [book] = await q.query<BookRow>(`select * from accounting_books where singleton${lock ? ' for update' : ''}`)
  return book ?? null
}

export function bookDto(b: BookRow) {
  return { id: b.id, name: b.name, purpose: b.purpose, mode: b.mode, currency: b.currency, timezone: b.timezone,
    entityType: b.entity_type, accountingStandard: b.accounting_standard, ownerMode: b.owner_mode, taxStatus: b.tax_status,
    cutoverDate: b.cutover_date, openingValidated: b.opening_validated, version: b.version }
}

export interface SetupInput {
  name: string; purpose: string; cutoverDate: string; timezone: string; entityType?: string; accountingStandard?: string
}

/** Only OFF production configuration or a clearly labelled SHADOW rehearsal. Activation is a separate cutover command. */
export async function createBook(tx: Queryable, actor: Actor, input: SetupInput, requestId: string, appEnv: AppEnv) {
  await tx.query('select pg_advisory_xact_lock(4783201)')
  if (await getBook(tx, true)) throw errors.conflict('Profil accounting sudah ada. Muat ulang halaman pengaturan.')
  const name = input.name.trim()
  if (name.length < 2 || name.length > 120) throw errors.validation({ name: ['Nama harus 2–120 karakter.'] })
  if (!['rehearsal', 'production'].includes(input.purpose)) throw errors.validation({ purpose: ['Pilih rehearsal atau konfigurasi produksi nonaktif.'] })
  if (input.purpose === 'rehearsal' && appEnv === 'production') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Rehearsal harus dijalankan di lingkungan terisolasi. Profil produksi hanya dapat dibuat dalam mode nonaktif.')
  if (!['Asia/Jakarta', 'Asia/Bangkok'].includes(input.timezone)) throw errors.validation({ timezone: ['Pilih zona waktu bisnis.'] })
  const cutover = dateInput(input.cutoverDate, 'cutoverDate')
  const id = await nextId(tx, 'ABK-')
  await tx.query(`insert into accounting_books (id,name,purpose,mode,timezone,entity_type,accounting_standard,cutover_date,created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, name, input.purpose, input.purpose === 'rehearsal' ? 'shadow' : 'off', input.timezone,
    input.entityType?.trim() || 'unknown', input.accountingStandard?.trim() || 'unknown', cutover, actor.userId])
  for (const [code, label, type, role, dimension] of ACCOUNT_TEMPLATE) {
    await tx.query(`insert into accounting_accounts (book_id,code,name,account_type,control_role,required_dimension) values ($1,$2,$3,$4,$5,$6)`,
      [id,code,label,type,role,dimension])
  }
  await recordAudit(tx, { action: 'finance.accounting_setup_created', actorUserId: actor.userId, entityType: 'accounting_book', entityId: id, requestId,
    after: { purpose: input.purpose, mode: input.purpose === 'rehearsal' ? 'shadow' : 'off', cutoverDate: cutover, ownerMode: 'team', taxStatus: 'unknown' } })
  return bookDto((await getBook(tx))!)
}

export async function createPeriod(tx: Queryable, actor: Actor, input: { startsOn: string; endsOn: string; reason: string }, requestId: string) {
  const book = await getBook(tx, true)
  if (!book) throw errors.notFound('Profil accounting')
  const starts = dateInput(input.startsOn, 'startsOn'), ends = dateInput(input.endsOn, 'endsOn')
  if (ends < starts || starts < book.cutover_date) throw errors.validation({ endsOn: ['Rentang periode harus berurutan dan tidak sebelum cutover.'] })
  const reason = input.reason.trim()
  if (reason.length < 5) throw errors.validation({ reason: ['Tuliskan alasan minimal 5 karakter.'] })
  const overlap = await tx.query('select id from accounting_periods where book_id=$1 and starts_on <= $3 and ends_on >= $2', [book.id,starts,ends])
  if (overlap.length) throw errors.conflict('Periode bertumpang tindih dengan periode yang sudah ada.')
  const id = await nextId(tx, 'ACP-')
  await tx.query(`insert into accounting_periods (id,book_id,starts_on,ends_on,changed_by,reason) values ($1,$2,$3,$4,$5,$6)`, [id,book.id,starts,ends,actor.userId,reason])
  await recordAudit(tx, { action: 'finance.accounting_period_created', actorUserId: actor.userId, entityType: 'accounting_period', entityId: id, requestId, reason })
  return { id, startsOn: starts, endsOn: ends, status: 'open' as const, version: 1 }
}

export async function createDraftPolicy(tx: Queryable, actor: Actor, input: { sourceKind: string; effectiveFrom: string; principalAgent: string; recognition: string; taxTreatment: string; rationale: string;settings?:PolicySettingsInput }, requestId: string) {
  const book = await getBook(tx, true)
  if (!book) throw errors.notFound('Profil accounting')
  if (!(POLICY_SOURCE_KINDS as readonly string[]).includes(input.sourceKind)) throw errors.validation({ sourceKind: ['Jenis sumber belum didukung.'] })
  if (!['unknown','principal','agent','mixed','not-applicable'].includes(input.principalAgent)) throw errors.validation({ principalAgent: ['Pilih peran kontrak yang valid.'] })
  if (input.rationale.trim().length < 5) throw errors.validation({ rationale: ['Jelaskan dasar kebijakan minimal 5 karakter.'] })
  const from = dateInput(input.effectiveFrom, 'effectiveFrom')
  const settings=input.settings ?? {}
  await validatePolicySettings(tx,book.id,input.sourceKind,settings)
  const [last] = await tx.query<{ version: number }>('select coalesce(max(version),0)::integer as version from accounting_policies where book_id=$1 and source_kind=$2', [book.id,input.sourceKind])
  const id = await nextId(tx,'APL-'), version = last!.version + 1
  await tx.query(`insert into accounting_policies (id,book_id,source_kind,version,effective_from,principal_agent,recognition,tax_treatment,rationale,created_by,settings)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text::jsonb)`, [id,book.id,input.sourceKind,version,from,input.principalAgent,input.recognition.trim() || 'unknown',input.taxTreatment.trim() || 'unknown',input.rationale.trim(),actor.userId,JSON.stringify(settings)])
  await recordAudit(tx,{ action:'finance.accounting_policy_drafted',actorUserId:actor.userId,entityType:'accounting_policy',entityId:id,requestId,after:{ sourceKind:input.sourceKind,version,status:'draft' } })
  return { id, version, validationStatus: 'draft' as const }
}

/** Internal lock operation; production monthly review/close is intentionally not exposed before its completeness gates exist. */
export async function lockRehearsalPeriod(tx: Queryable, actor: Actor, id: string, version: number, reason: string, requestId: string) {
  const book = await getBook(tx,true)
  if (!book || book.purpose !== 'rehearsal') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Penutupan buku produksi memerlukan review bulanan dan rekonsiliasi lengkap.')
  const [p] = await tx.query<{ version: number; status: string }>('select version,status from accounting_periods where id=$1 and book_id=$2 for update',[id,book.id])
  if (!p) throw errors.notFound('Periode accounting')
  if (p.version !== version) throw errors.conflict('Periode telah berubah. Muat ulang sebelum mengunci.')
  if (p.status === 'closed') throw errors.conflict('Periode sudah dikunci.')
  if (reason.trim().length < 5) throw errors.validation({ reason:['Tuliskan alasan minimal 5 karakter.'] })
  await tx.query("update accounting_periods set status='closed',version=version+1,changed_by=$2,reason=$3 where id=$1",[id,actor.userId,reason.trim()])
  await recordAudit(tx,{ action:'finance.accounting_rehearsal_period_locked',actorUserId:actor.userId,entityType:'accounting_period',entityId:id,reason,requestId,
    before:{ status:p.status,version:p.version },after:{ status:'closed',version:version+1 } })
  return { id, status:'closed' as const,version:version+1 }
}

export async function reopenRehearsalPeriod(tx:Queryable,actor:Actor,id:string,version:number,reason:string,requestId:string) {
  const book = await getBook(tx,true)
  if (!book || book.purpose !== 'rehearsal') throw new AppError(422,'ACCOUNTING_REVIEW_REQUIRED','Reopen buku produksi memerlukan prosedur review dan koreksi yang tervalidasi.')
  const [p] = await tx.query<{ version:number;status:string }>('select version,status from accounting_periods where id=$1 and book_id=$2 for update',[id,book.id])
  if (!p) throw errors.notFound('Periode accounting')
  if (p.version !== version || p.status !== 'closed') throw errors.conflict('Status atau versi periode berubah. Muat ulang sebelum membuka kembali.')
  if (reason.trim().length < 5) throw errors.validation({ reason:['Tuliskan alasan minimal 5 karakter.'] })
  await tx.query("update accounting_periods set status='open',version=version+1,changed_by=$2,reason=$3 where id=$1",[id,actor.userId,reason.trim()])
  await recordAudit(tx,{ action:'finance.accounting_rehearsal_period_reopened',actorUserId:actor.userId,entityType:'accounting_period',entityId:id,reason,requestId,
    before:{ status:p.status,version:p.version },after:{ status:'open',version:version+1 } })
  return { id,status:'open' as const,version:version+1 }
}
