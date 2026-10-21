import type { StaffCashKind, StaffFundsDto } from '~/types/api'

/**
 * Kasbon decisions shown to the owner. The server enforces every limit; these mirror them so the form explains
 * the consequence before sending: kasbon is not a cost, evidence is, leftovers come back, overspending is owed.
 */
export type StaffAction = StaffCashKind | 'expense_claim'
type Row = StaffFundsDto['employees'][number]

export const STAFF_ACTION: Record<StaffAction, { title: string; submit: string; consequence: string }> = {
  employee_advance: { title: 'Beri uang jalan', submit: 'Catat uang jalan', consequence: 'Uang keluar dari rekening dan dipegang karyawan. Belum menjadi biaya.' },
  expense_claim: { title: 'Pertanggungjawabkan uang jalan', submit: 'Catat bukti', consequence: 'Bukti sah menjadi biaya. Bila melebihi uang yang dipegang, selisihnya menjadi reimbursement yang terutang.' },
  employee_advance_return: { title: 'Terima sisa uang jalan', submit: 'Catat pengembalian', consequence: 'Sisa uang kembali ke rekening. Bukan pemasukan.' },
  employee_reimbursement: { title: 'Bayar reimbursement', submit: 'Bayar', consequence: 'Melunasi biaya yang ditalangi karyawan. Tidak menambah biaya lagi.' }
}

/** Upper bound for an action (null = no bound beyond the bank balance). */
export function staffActionLimit (action: StaffAction, row: Row | undefined): string | null {
  if (action === 'employee_advance_return') { return row?.heldMinor ?? '0' }
  if (action === 'employee_reimbursement') { return row?.owedToEmployeeMinor ?? '0' }
  return null
}

export function staffActionAvailable (action: StaffAction, row: Row | undefined): boolean {
  const limit = staffActionLimit(action, row)
  return limit === null || BigInt(limit) > 0n
}

export function exceedsStaffLimit (action: StaffAction, row: Row | undefined, amountMinor: string): boolean {
  const limit = staffActionLimit(action, row)
  return limit !== null && !!amountMinor && BigInt(amountMinor) > BigInt(limit)
}

export const MOVEMENT_LABEL: Record<StaffAction, string> = {
  employee_advance: 'Uang jalan diberikan',
  employee_advance_return: 'Sisa dikembalikan',
  employee_reimbursement: 'Reimbursement dibayar',
  expense_claim: 'Bukti pengeluaran'
}
