import { describe, expect, it } from 'vitest'
import { feedbackActions, inboxSummary, ticketActions } from './support'

describe('staff support helpers (S12c-2)', () => {
  it('an open ticket can be assigned, moved, answered and resolved — not closed', () => {
    expect(ticketActions('in-progress')).toEqual({ assign: true, moveTo: ['waiting-for-client'], resolve: true, close: false, reply: true, internalNote: true })
    expect(ticketActions('open').moveTo).toEqual(['in-progress', 'waiting-for-client'])
    expect(ticketActions('reopened').resolve).toBe(true)
  })

  it('a resolved ticket can only be closed or answered', () => {
    expect(ticketActions('resolved')).toEqual({ assign: false, moveTo: [], resolve: false, close: true, reply: true, internalNote: true })
  })

  it('a closed ticket takes internal notes only', () => {
    expect(ticketActions('closed')).toEqual({ assign: false, moveTo: [], resolve: false, close: false, reply: false, internalNote: true })
  })

  it('feedback actions follow the server transitions', () => {
    expect(feedbackActions('submitted')).toEqual({ acknowledge: true, followUp: true, close: true })
    expect(feedbackActions('acknowledged')).toEqual({ acknowledge: false, followUp: true, close: true })
    expect(feedbackActions('follow-up-required')).toEqual({ acknowledge: false, followUp: false, close: true })
    expect(feedbackActions('draft')).toEqual({ acknowledge: false, followUp: false, close: false })
    expect(feedbackActions('closed')).toEqual({ acknowledge: false, followUp: false, close: false })
  })

  it('the inbox summary counts open, unassigned and the user’s own tickets', () => {
    const tickets = [
      { status: 'open', assignedTo: undefined },
      { status: 'in-progress', assignedTo: 'USR-002' },
      { status: 'reopened', assignedTo: 'USR-003' },
      { status: 'resolved', assignedTo: 'USR-002' },
      { status: 'closed', assignedTo: undefined }
    ] as const
    expect(inboxSummary([...tickets], 'USR-002')).toEqual({ open: 3, unassigned: 1, mine: 1, resolved: 1 })
  })
})
