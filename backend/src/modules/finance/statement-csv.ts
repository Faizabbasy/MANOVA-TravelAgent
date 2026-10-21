/**
 * Bank statement CSV parsing (owner accounting F7). Pure: no I/O, no guessing — the caller states which columns hold
 * what, the date format and the number style. IDR has no minor unit: a non-zero fraction is an error, never rounded.
 */
export interface StatementMapping {
  delimiter: ',' | ';' | '\t'
  skipRows: number
  dateColumn: number
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'DD-MM-YYYY'
  descriptionColumn: number
  /** Either one signed amount column, or separate debit (out) and credit (in) columns. */
  amountColumn?: number
  debitColumn?: number
  creditColumn?: number
  referenceColumn?: number
  numberStyle: 'id' | 'en'
}
export interface StatementRow { lineNo: number; bookedOn: string; description: string; direction: 'in' | 'out'; amountMinor: string; externalRef: string | null; raw: string[] }
export interface StatementParse { rows: StatementRow[]; errors: { lineNo: number; message: string }[] }

export const MAX_STATEMENT_BYTES = 2_000_000
export const MAX_STATEMENT_ROWS = 5000

/** RFC 4180-style split with quotes; tolerant of CRLF and a UTF-8 BOM. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(c => c.trim() !== '')) rows.push(row)
  return rows
}

/** "1.234.567,00" (id) or "1,234,567.00" (en) → whole rupiah as bigint; null when not a valid IDR amount. */
export function parseIdrAmount(value: string, style: 'id' | 'en'): bigint | null {
  let v = value.trim().replace(/\s/g, '').replace(/^Rp\.?/i, '')
  if (!v) return null
  let negative = false
  if (/^\(.*\)$/.test(v)) { negative = true; v = v.slice(1, -1) }
  if (v.startsWith('-')) { negative = !negative; v = v.slice(1) }
  // Indonesian statements often suffix the side: DB = money out, CR = money in.
  if (/DB$/i.test(v)) { negative = !negative; v = v.slice(0, -2) } else if (/CR$/i.test(v)) v = v.slice(0, -2)
  const [thousands, decimal] = style === 'id' ? ['.', ','] : [',', '.']
  const parts = v.split(decimal)
  if (parts.length > 2) return null
  const whole = parts[0]!.split(thousands).join('')
  if (!/^\d+$/.test(whole)) return null
  if (parts.length === 2 && !/^0*$/.test(parts[1]!)) return null
  if (parts.length === 2 && !/^\d+$/.test(parts[1]!)) return null
  const n = BigInt(whole)
  return negative ? -n : n
}

function parseDate(value: string, format: StatementMapping['dateFormat']): string | null {
  const v = value.trim()
  const m = format === 'YYYY-MM-DD' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : (format === 'DD/MM/YYYY' ? /^(\d{2})\/(\d{2})\/(\d{4})$/ : /^(\d{2})-(\d{2})-(\d{4})$/).exec(v)
  if (!m) return null
  const [y, mo, d] = format === 'YYYY-MM-DD' ? [m[1]!, m[2]!, m[3]!] : [m[3]!, m[2]!, m[1]!]
  const iso = `${y}-${mo}-${d}`
  const dt = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso ? null : iso
}

export function parseStatementCsv(text: string, mapping: StatementMapping): StatementParse {
  const errors: StatementParse['errors'] = []
  if (new TextEncoder().encode(text).length > MAX_STATEMENT_BYTES) return { rows: [], errors: [{ lineNo: 0, message: 'File melebihi 2 MB.' }] }
  const table = splitCsv(text, mapping.delimiter).slice(mapping.skipRows)
  if (table.length > MAX_STATEMENT_ROWS) return { rows: [], errors: [{ lineNo: 0, message: `Maksimal ${MAX_STATEMENT_ROWS} baris per impor.` }] }
  const rows: StatementRow[] = []
  table.forEach((cells, index) => {
    const lineNo = index + 1 + mapping.skipRows
    const cell = (i: number | undefined) => (i === undefined ? '' : (cells[i] ?? '').trim())
    const bookedOn = parseDate(cell(mapping.dateColumn), mapping.dateFormat)
    if (!bookedOn) { errors.push({ lineNo, message: `Tanggal tidak sesuai format ${mapping.dateFormat}.` }); return }
    let signed: bigint | null
    if (mapping.amountColumn !== undefined) signed = parseIdrAmount(cell(mapping.amountColumn), mapping.numberStyle)
    else {
      const debit = cell(mapping.debitColumn) ? parseIdrAmount(cell(mapping.debitColumn), mapping.numberStyle) : 0n
      const credit = cell(mapping.creditColumn) ? parseIdrAmount(cell(mapping.creditColumn), mapping.numberStyle) : 0n
      signed = debit === null || credit === null || (debit !== 0n && credit !== 0n) ? null : credit !== 0n ? credit : -(debit ?? 0n)
    }
    if (signed === null || signed === 0n) { errors.push({ lineNo, message: 'Nominal tidak valid (rupiah tanpa sen, satu sisi debit/kredit).' }); return }
    const abs = signed < 0n ? -signed : signed
    if (abs > 1_000_000_000_000_000n) { errors.push({ lineNo, message: 'Nominal melebihi batas.' }); return }
    rows.push({ lineNo, bookedOn, description: cell(mapping.descriptionColumn).slice(0, 500), direction: signed > 0n ? 'in' : 'out',
      amountMinor: abs.toString(), externalRef: cell(mapping.referenceColumn).slice(0, 120) || null, raw: cells.slice(0, 20).map(c => c.slice(0, 200)) })
  })
  return { rows, errors }
}
