import { describe, it, expect } from 'vitest'
import { createTravelRequest, submitTravelRequest } from './index'

describe('Travel Request portal → Lead (S1)', () => {
  it('request lengkap dari customer yang ada diqualify ke customer itu, bukan berhenti di Proposal Preparation', () => {
    const request = createTravelRequest('PTY-005', {
      requestName: 'Uji Gathering Akhir Tahun',
      destination: 'Bali, Indonesia',
      travelStartDate: '2027-12-01',
      travelEndDate: '2027-12-04',
      estimatedParticipants: 20,
      estimatedBudgetIdr: 300_000_000,
      serviceScope: ['additional']
    }, 'USR-021')
    const submitted = submitTravelRequest(request.id, 'USR-021')
    expect(submitted?.status).toBe('converted-to-lead')
    expect(submitted?.leadId).toBeTruthy()
  })
})
