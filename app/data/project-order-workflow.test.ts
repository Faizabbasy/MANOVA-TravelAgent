import { describe, it, expect } from 'vitest'
import {
  PROJECT_ORDER_STEPS,
  getProjectOrderStep,
  getProjectOrderStepViews,
  evaluateProjectOrderStepGate,
  advanceProjectOrder,
  getProjectOrderLateralTransitions,
  getProjectMilestones,
  getMilestoneDelayDays,
  getProjectMilestoneSummary,
  setMilestoneActualDate,
  getProjectNotes,
  createProjectNote,
  toggleProjectNotePin
} from './project-order-workflow'
import { getProjectById, getProjectStatusTransitions } from './index'
import type { Project } from '~/types/project'

function project (id: string): Project {
  const found = getProjectById(id)
  if (!found) { throw new Error(`Fixture ${id} tidak ada`) }
  return found
}

describe('Alur 6 step Project Order', () => {
  it('mendefinisikan tepat 6 step dengan urutan yang benar', () => {
    expect(PROJECT_ORDER_STEPS.map(step => step.key)).toEqual([
      'drafting', 'confirmed', 'start', 'departure', 'on-progress', 'done'
    ])
    expect(PROJECT_ORDER_STEPS.map(step => step.index)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('setiap step punya minimal satu gerbang', () => {
    const withoutGate = PROJECT_ORDER_STEPS.filter(step => step.gates.length === 0).map(step => step.key)
    expect(withoutGate).toEqual([])
  })

  /**
   * Regresi utama yang ditemukan saat audit: `in-progress` tidak punya transisi ke `ongoing-trip`,
   * sehingga step 4 (Departure) → 5 (On Progress) mustahil dijalankan.
   */
  it('transisi in-progress → ongoing-trip tersedia (step Departure → On Progress)', () => {
    expect(getProjectStatusTransitions('in-progress')).toContain('ongoing-trip')
    expect(getProjectStatusTransitions('ongoing-trip')).toContain('completed')
  })

  it('transisi lama tidak ada yang hilang', () => {
    expect(getProjectStatusTransitions('in-progress')).toEqual(
      expect.arrayContaining(['completed', 'on-hold', 'cancelled'])
    )
  })

  describe('derivasi step dari ProjectStatus', () => {
    const cases: { status: Project['status']; readyAt?: string; expected: string }[] = [
      { status: 'draft', expected: 'drafting' },
      { status: 'planning', expected: 'drafting' },
      { status: 'confirmed', expected: 'confirmed' },
      { status: 'confirmed', readyAt: '2026-07-01', expected: 'start' },
      { status: 'in-progress', expected: 'departure' },
      { status: 'ongoing-trip', expected: 'on-progress' },
      { status: 'completed', expected: 'done' }
    ]

    for (const testCase of cases) {
      it(`status "${testCase.status}"${testCase.readyAt ? ' + readyAt' : ''} → step "${testCase.expected}"`, () => {
        const stub = { id: 'X', status: testCase.status, readyAt: testCase.readyAt } as Project
        expect(getProjectOrderStep(stub)).toBe(testCase.expected)
      })
    }
  })

  describe('gerbang per step', () => {
    it('mengembalikan bentuk { ready, blockers } yang seragam', () => {
      const gate = evaluateProjectOrderStepGate('PRJ-102', 'drafting')
      expect(gate).toHaveProperty('ready')
      expect(Array.isArray(gate.blockers)).toBe(true)
      expect(gate.ready).toBe(gate.blockers.length === 0)
    })

    it('gerbang Departure menahan project yang tanggal berangkatnya belum tiba', () => {
      const gate = evaluateProjectOrderStepGate('PRJ-102', 'departure')
      expect(gate.ready).toBe(false)
      expect(gate.blockers.join(' ')).toMatch(/[Kk]eberangkatan/)
    })

    it('gerbang Done memakai closure gate yang sudah ada, bukan perhitungan baru', () => {
      const gate = evaluateProjectOrderStepGate('PRJ-102', 'done')
      expect(gate.ready).toBe(false)
      expect(gate.blockers.length).toBeGreaterThan(0)
    })

    it('project tidak dikenal ditolak dengan blocker, bukan melempar error', () => {
      const gate = evaluateProjectOrderStepGate('PRJ-TIDAK-ADA', 'drafting')
      expect(gate.ready).toBe(false)
    })
  })

  describe('getProjectOrderStepViews', () => {
    it('menandai step sebelum step aktif sebagai completed dan sisanya future', () => {
      const views = getProjectOrderStepViews('PRJ-101')
      const currentIndex = views.findIndex(view => view.state === 'current' || view.state === 'blocked')

      expect(currentIndex).toBeGreaterThanOrEqual(0)
      expect(views.slice(0, currentIndex).every(view => view.state === 'completed')).toBe(true)
      expect(views.slice(currentIndex + 1).every(view => view.state === 'future')).toBe(true)
    })

    it('step aktif berstatus blocked bila gerbangnya belum terpenuhi', () => {
      const active = getProjectOrderStepViews('PRJ-102').find(view => view.state === 'current' || view.state === 'blocked')
      expect(active).toBeDefined()
      expect(active!.state).toBe(active!.gate.ready ? 'current' : 'blocked')
    })

    it('mengembalikan array kosong untuk project yang tidak ada', () => {
      expect(getProjectOrderStepViews('PRJ-TIDAK-ADA')).toEqual([])
    })
  })

  describe('advanceProjectOrder', () => {
    it('menolak maju dan mengembalikan blocker saat gerbang belum terpenuhi', () => {
      const before = project('PRJ-102').status
      const result = advanceProjectOrder('PRJ-102', 'USR-010')

      expect(result.success).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
      expect(project('PRJ-102').status).toBe(before)
    })

    it('menolak menutup Project Order tanpa final note', () => {
      const result = advanceProjectOrder('PRJ-101', 'USR-010', { finalNote: '   ' })
      expect(result.success).toBe(false)
    })

    it('tidak melempar error untuk project yang tidak ada', () => {
      expect(advanceProjectOrder('PRJ-TIDAK-ADA', 'USR-010').success).toBe(false)
    })
  })

  it('transisi lateral hanya berisi on-hold / cancelled', () => {
    const lateral = getProjectOrderLateralTransitions('PRJ-102')
    expect(lateral.every(status => status === 'on-hold' || status === 'cancelled')).toBe(true)
  })
})

describe('Milestone Project Order', () => {
  it('terurut menurut planned date', () => {
    const dates = getProjectMilestones('PRJ-102').map(milestone => milestone.plannedDate)
    expect([...dates].sort()).toEqual(dates)
  })

  it('delay positif berarti terlambat, negatif berarti lebih cepat', () => {
    const early = getProjectMilestones('PRJ-101').find(milestone => milestone.id === 'PMS-101-2')
    const late = getProjectMilestones('PRJ-102').find(milestone => milestone.id === 'PMS-102-1')

    expect(getMilestoneDelayDays(early!)).toBeLessThan(0)
    expect(getMilestoneDelayDays(late!)).toBeGreaterThan(0)
  })

  it('milestone yang belum selesai dan sudah lewat tanggal tetap terhitung terlambat', () => {
    const overdue = getProjectMilestones('PRJ-102').find(milestone => milestone.id === 'PMS-102-3')
    expect(getMilestoneDelayDays(overdue!)).toBeGreaterThan(0)
  })

  it('milestone yang belum jatuh tempo tidak dihitung terlambat', () => {
    const future = getProjectMilestones('PRJ-102').find(milestone => milestone.id === 'PMS-102-7')
    expect(getMilestoneDelayDays(future!)).toBeUndefined()
  })

  it('ringkasan menghitung keterlambatan kumulatif', () => {
    const summary = getProjectMilestoneSummary('PRJ-102')
    expect(summary.total).toBeGreaterThan(0)
    expect(summary.delayed).toBeGreaterThan(0)
    expect(summary.totalDelayDays).toBeGreaterThan(0)
  })

  it('mencatat actual date menandai milestone selesai', () => {
    const updated = setMilestoneActualDate('PMS-101-5', '2026-07-26')
    expect(updated?.status).toBe('completed')
    expect(getMilestoneDelayDays(updated!)).toBe(1)
  })
})

describe('Catatan Project Order', () => {
  it('catatan yang di-pin muncul lebih dulu', () => {
    const notes = getProjectNotes('PRJ-101')
    expect(notes[0].pinned).toBe(true)
  })

  it('menolak catatan kosong', () => {
    expect(createProjectNote('PRJ-101', 'USR-010', '   ')).toBeUndefined()
  })

  it('catatan baru langsung muncul di daftar project tersebut', () => {
    const before = getProjectNotes('PRJ-103').length
    createProjectNote('PRJ-103', 'USR-010', 'Catatan uji.')
    expect(getProjectNotes('PRJ-103')).toHaveLength(before + 1)
  })

  it('pin dapat dinyalakan dan dimatikan', () => {
    const note = getProjectNotes('PRJ-103').find(item => !item.pinned)
    const toggled = toggleProjectNotePin(note!.id)
    expect(toggled?.pinned).toBe(true)
    expect(toggleProjectNotePin(note!.id)?.pinned).toBe(false)
  })
})
