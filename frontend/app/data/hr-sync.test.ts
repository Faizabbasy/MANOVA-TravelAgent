import { describe, expect, it } from 'vitest'
import { COMMISSION_RECORDS, EMPLOYEES, PAYROLL_LINES, PAYROLL_RUNS, getPayrollBreakdown } from './hr'
import { approvePayrollRunOnServer, createIncentivesOnServer, createPayrollRunOnServer, mergeServerHr, updateEmployeeOnServer } from './hr-sync'
import type { CommissionDto, EmployeeDto, PayrollLineDto, PayrollRunDto } from '~/types/api'

const employee = (over: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id: 'EMP-001',
  userId: 'USR-001',
  name: 'Rani Kusuma',
  position: 'Sales Executive',
  department: 'Sales',
  employmentType: 'full-time',
  status: 'active',
  joinedOn: '2023-03-01',
  phone: null,
  email: null,
  baseSalaryMinor: '9500000',
  commissionRatePercent: 2,
  ...over
})
const run = (over: Partial<PayrollRunDto> = {}): PayrollRunDto => ({ id: 'PRN-2026-07', period: '2026-07', status: 'draft', approvedBy: null, approvedOn: null, paidOn: null, ...over })
const line = (over: Partial<PayrollLineDto> = {}): PayrollLineDto => ({
  id: 'PRL-PRN-2026-07-EMP-001', payrollRunId: 'PRN-2026-07', employeeId: 'EMP-001', baseSalaryMinor: '9500000', allowanceMinor: '1000000', deductionMinor: '500000', note: null, ...over
})
const commission = (over: Partial<CommissionDto> = {}): CommissionDto => ({
  id: 'COM-PRJ-101-EMP-001', employeeId: 'EMP-001', projectId: 'PRJ-101', period: '2026-07', baseAmountMinor: '100000000', ratePercent: 2, amountMinor: '2000000', status: 'approved', source: 'derived', note: null, ...over
})

describe('hr-sync', () => {
  it('Finance gets employees with pay, payroll and commissions; the payroll breakdown adds approved commissions', () => {
    mergeServerHr({ employees: [employee()], attendance: [], reviews: [], pay: { runs: [run()], lines: [line()], commissions: [commission()] } })
    expect(EMPLOYEES.map(e => [e.id, e.baseSalaryIdr, e.commissionRatePercent])).toEqual([['EMP-001', 9_500_000, 2]])
    expect(PAYROLL_RUNS.map(r => r.id)).toEqual(['PRN-2026-07'])
    expect(getPayrollBreakdown('PRN-2026-07')[0]).toMatchObject({ commissionIdr: 2_000_000, netIdr: 9_500_000 + 1_000_000 + 2_000_000 - 500_000 })
  })

  it('without pay (Admin) the payroll, lines and commissions are emptied and no salary is kept', () => {
    mergeServerHr({ employees: [employee({ baseSalaryMinor: null, commissionRatePercent: null })], attendance: [], reviews: [], pay: null })
    expect(PAYROLL_RUNS).toEqual([])
    expect(PAYROLL_LINES).toEqual([])
    expect(COMMISSION_RECORDS).toEqual([])
    expect(EMPLOYEES[0]!.baseSalaryIdr).toBe(0)
    expect(EMPLOYEES[0]).not.toHaveProperty('commissionRatePercent')
  })

  it('a refused change leaves the local data as it was', async () => {
    mergeServerHr({ employees: [employee()], attendance: [], reviews: [], pay: { runs: [run()], lines: [line()], commissions: [] } })
    const api = {
      core: {
        updateEmployee: () => Promise.reject(new Error('403')),
        approvePayrollRun: () => Promise.reject(new Error('422')),
        createPayrollRun: () => Promise.reject(new Error('422'))
      }
    } as never
    await expect(updateEmployeeOnServer(api, 'EMP-001', { position: 'X' })).rejects.toThrow()
    await expect(approvePayrollRunOnServer(api, 'PRN-2026-07')).rejects.toThrow()
    await expect(createPayrollRunOnServer(api, '2026-08')).rejects.toThrow()
    expect(EMPLOYEES[0]!.position).toBe('Sales Executive')
    expect(PAYROLL_RUNS.map(r => [r.id, r.status])).toEqual([['PRN-2026-07', 'draft']])
  })

  it('an incentive batch reports who was saved when it stops, so a retry never posts them twice', async () => {
    mergeServerHr({ employees: [employee()], attendance: [], reviews: [], pay: { runs: [], lines: [], commissions: [] } })
    let calls = 0
    const api = {
      core: {
        createIncentive: (input: { employeeId: string }) => {
          calls += 1
          return calls < 3
            ? Promise.resolve({ data: commission({ id: `INS-00${calls}`, employeeId: input.employeeId, source: 'manual' }) })
            : Promise.reject(new Error('422'))
        }
      }
    } as never
    const result = await createIncentivesOnServer(api, { projectId: 'PRJ-101', period: '2026-08', amountMinor: '1000000' }, ['EMP-001', 'EMP-002', 'EMP-003'])
    expect(result.savedEmployeeIds).toEqual(['EMP-001', 'EMP-002'])
    expect(result.error).toBeInstanceOf(Error)
    expect(COMMISSION_RECORDS.map(c => c.id)).toEqual(['INS-001', 'INS-002'])
  })

  it('a new payroll run reloads the runs and the lines the server made', async () => {
    mergeServerHr({ employees: [employee()], attendance: [], reviews: [], pay: { runs: [run({ status: 'paid', paidOn: '2026-07-25', approvedOn: '2026-07-24' })], lines: [line()], commissions: [] } })
    const api = {
      core: {
        createPayrollRun: () => Promise.resolve({ data: run({ id: 'PRN-2026-08', period: '2026-08' }) }),
        listPayrollRuns: () => Promise.resolve({ data: [run({ id: 'PRN-2026-08', period: '2026-08' }), run({ status: 'paid', paidOn: '2026-07-25', approvedOn: '2026-07-24' })] }),
        listPayrollLines: () => Promise.resolve({ data: [line(), line({ id: 'PRL-PRN-2026-08-EMP-001', payrollRunId: 'PRN-2026-08', allowanceMinor: '0', deductionMinor: '0' })] })
      }
    } as never
    const created = await createPayrollRunOnServer(api, '2026-08')
    expect(created.id).toBe('PRN-2026-08')
    expect(PAYROLL_LINES.map(l => l.id)).toContain('PRL-PRN-2026-08-EMP-001')
    expect(PAYROLL_RUNS.find(r => r.id === 'PRN-2026-07')).toMatchObject({ status: 'paid', paidAt: '2026-07-25', approvedAt: '2026-07-24' })
  })
})
