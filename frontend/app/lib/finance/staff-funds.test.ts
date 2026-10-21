import { describe, expect, it } from 'vitest'
import { exceedsStaffLimit, staffActionAvailable, staffActionLimit, STAFF_ACTION } from './staff-funds'

const holds = { employeeId: 'EMP-1', name: 'A', status: 'active', heldMinor: '1000000', owedToEmployeeMinor: '0' }
const owed = { employeeId: 'EMP-2', name: 'B', status: 'active', heldMinor: '0', owedToEmployeeMinor: '9007199254740993' }

describe('kasbon actions', () => {
  it('limits a return to what is held and a reimbursement to what is owed, exactly', () => {
    expect(staffActionLimit('employee_advance_return', holds)).toBe('1000000')
    expect(exceedsStaffLimit('employee_advance_return', holds, '1000001')).toBe(true)
    expect(exceedsStaffLimit('employee_reimbursement', owed, '9007199254740993')).toBe(false)
    expect(exceedsStaffLimit('employee_reimbursement', owed, '9007199254740994')).toBe(true)
    expect(staffActionLimit('employee_advance', holds)).toBeNull()
    expect(staffActionLimit('employee_advance_return', undefined)).toBe('0')
  })
  it('offers only the actions that make sense for the position', () => {
    expect(staffActionAvailable('employee_reimbursement', holds)).toBe(false)
    expect(staffActionAvailable('employee_advance_return', owed)).toBe(false)
    expect(staffActionAvailable('expense_claim', owed)).toBe(true)
  })
  it('states that kasbon is not a cost and evidence is', () => {
    expect(STAFF_ACTION.employee_advance.consequence).toContain('Belum menjadi biaya')
    expect(STAFF_ACTION.expense_claim.consequence).toContain('menjadi biaya')
  })
})
