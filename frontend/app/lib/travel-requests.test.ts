import { describe, expect, it } from 'vitest'
import { travelRequestActions } from './travel-requests'

describe('staff travel request actions (S12c-3) mirror the server', () => {
  it('a new request can be reviewed, clarified, converted or closed', () => {
    expect(travelRequestActions('submitted')).toEqual({ review: true, clarify: true, convert: true, close: true })
  })
  it('under review: no second review', () => {
    expect(travelRequestActions('under-review')).toEqual({ review: false, clarify: true, convert: true, close: true })
  })
  it('waiting for the client: only close', () => {
    expect(travelRequestActions('need-clarification')).toEqual({ review: false, clarify: false, convert: false, close: true })
  })
  it('finished requests take nothing', () => {
    for (const status of ['converted-to-lead', 'cancelled', 'closed'] as const) {
      expect(travelRequestActions(status)).toEqual({ review: false, clarify: false, convert: false, close: false })
    }
  })
})
