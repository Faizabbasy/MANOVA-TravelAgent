import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12a-2: the client portal's commercial reads — sent quotations, reservations without money, and the client's own
 * invoices — through /client/* with whitelist DTOs. Client USR-021, party PTY-005.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const get = (path: string, who: string) => t.call('GET', `/api/v1${path}`, { cookie: c[who] })
/** Every key of an object, nested objects and arrays included. */
const keysOf = (v: unknown, into = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach(x => keysOf(x, into))
  else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) { into.add(k); keysOf(child, into) }
  return into
}

describe('GET /client/invoices', () => {
  test('issued/void invoices billed to the client party (Group Trip participant invoices too), never drafts or other parties', async () => {
    const own = (await t.db.query<{ id: string }>("select id from projects where party_id = 'PTY-005' order by id limit 1"))[0]!.id
    const other = (await t.db.query<{ id: string }>("select id from projects where party_id <> 'PTY-005' order by id limit 1"))[0]!.id
    const invoice = async (projectId: string, amount: string, issue = true) => {
      const res = await t.call('POST', '/api/v1/finance/customer-invoices', {
        cookie: c.finance, body: { projectId, invoiceType: 'dp', lines: [{ description: 'DP perjalanan', amountMinor: amount }], dueDate: '2026-12-01' }
      })
      expect(res.status, JSON.stringify(res.json)).toBe(201)
      const id = res.json.data.id as string
      if (issue) expect((await t.call('POST', `/api/v1/finance/customer-invoices/${id}/issue`, { cookie: c.finance, body: {} })).status).toBe(200)
      return id
    }
    const issued = await invoice(own, '10000000', false)
    const draft = await invoice(own, '5000000', false)
    const otherParty = await invoice(other, '7000000')
    const participant = await invoice(other, '3000000', false)
    // A Group Trip participant invoice: the project belongs to another party, the bill to the client. Internal fields
    // are planted while still drafts (issued invoices are frozen), then both are issued.
    await t.db.query("update customer_invoices set party_id = 'PTY-005', expected_date = '2026-11-20', expected_reason = 'janji bayar', notes = 'internal' where id = any($1::text[])", [[issued, participant]])
    for (const id of [issued, participant]) {
      expect((await t.call('POST', `/api/v1/finance/customer-invoices/${id}/issue`, { cookie: c.finance, body: {} })).status).toBe(200)
    }

    const res = await get('/client/invoices', 'client')
    expect(res.status).toBe(200)
    const data = res.json.data as { invoices: { id: string; totalMinor: string; outstandingMinor: string; lines: unknown[] }[]; summary: Record<string, string | null> }
    const ids = data.invoices.map(i => i.id)
    expect(ids).toContain(issued)
    expect(ids).toContain(participant)
    expect(ids).not.toContain(draft)
    expect(ids).not.toContain(otherParty)
    expect(data.invoices.find(i => i.id === issued)).toMatchObject({ totalMinor: '10000000', outstandingMinor: '10000000' })
    expect(data.invoices.find(i => i.id === issued)!.lines).toEqual([{ position: 1, description: 'DP perjalanan', amountMinor: '10000000' }])
    expect(data.summary).toMatchObject({ invoicedMinor: '13000000', outstandingMinor: '13000000', paidMinor: '0' })
    const keys = keysOf(data)
    for (const k of ['expectedDate', 'expectedReason', 'notes', 'account', 'transactionId', 'effect', 'refundId', 'billingScheduleItemId', 'createdAt', 'issuedBy', 'createdBy']) {
      expect(keys.has(k), k).toBe(false)
    }
    expect((await get(`/client/invoices/${issued}`, 'client')).status).toBe(200)
    expect((await get(`/client/invoices/${otherParty}`, 'client')).status).toBe(404)
    expect((await get(`/client/invoices/${draft}`, 'client')).status).toBe(404)
    expect((await get('/client/invoices', 'finance')).status).toBe(403)

    // A refund-liability credit note does not reduce the bill (the server's outstanding ignores it), so the client
    // list carries only the credit notes that do.
    // (The refund case a real refund-liability note links to is irrelevant here; the test database drops that link check.)
    await t.db.query('alter table credit_notes drop constraint credit_notes_refund_liability_linked')
    const staff = (await t.db.query<{ id: string }>("select id from users where role = 'finance' order by id limit 1"))[0]!.id
    await t.db.query("insert into credit_notes (customer_invoice_id, effect, amount_minor, reason, created_by) values ($1, 'refund_liability', 1000000, 'Refund kelebihan bayar', $2)", [issued, staff])
    const detail = (await get(`/client/invoices/${issued}`, 'client')).json.data as { creditNotes: unknown[]; outstandingMinor: string }
    expect(detail.creditNotes).toEqual([])
    expect(detail.outstandingMinor).toBe('10000000')
  })
})

describe('GET /client/reservations', () => {
  test('bookings of the client party’s projects, without any money, vendor or internal note', async () => {
    // Give the client party a project with a booking of each type, and plant internal fields in the details.
    for (const type of ['flight', 'hotel', 'transport', 'mice']) {
      await t.db.query(`update projects set party_id = 'PTY-005' where id = (select project_id from booking_refs where booking_type = $1 order by booking_id limit 1)`, [type])
    }
    await t.db.query(`update booking_refs set details = details || $1::text::jsonb where booking_type = 'flight'`, [JSON.stringify({
      options: [{ airline: 'Garuda Indonesia', cabinClass: 'economy', isSelected: true, fareIdr: 5000000 }],
      segments: [{ origin: 'CGK', destination: 'DPS', departureAt: '2026-11-01T08:00', arrivalAt: '2026-11-01T11:00', flightNumber: 'GA402' }],
      scheduleChangeNote: 'internal', ticketingDeadline: '2026-10-25'
    })])
    await t.db.query(`update booking_refs set details = details || $1::text::jsonb where booking_type = 'mice'`, [JSON.stringify({
      venueName: 'Bali Convention', boqItems: [{ vendorId: 'VND-001', netCostIdr: 1000000, sellPriceIdr: 1500000 }],
      sessions: [{ roomName: 'Ballroom', sessionTitle: 'Opening', startAt: '2026-11-02T09:00', endAt: '2026-11-02T10:00', capacity: 200, picUserId: 'USR-002' }],
      staffAssignments: [{ userId: 'USR-002' }], checklist: [{ label: 'x' }]
    })])

    const res = await get('/client/reservations', 'client')
    expect(res.status).toBe(200)
    const rows = res.json.data as { type: string; id: string; projectId: string; clientStatus: string; details: Record<string, unknown> }[]
    const expected = await t.db.query<{ n: string }>("select count(*)::text as n from booking_refs b join projects p on p.id = b.project_id where p.party_id = 'PTY-005'")
    expect(rows.length).toBe(Number(expected[0]!.n))
    expect(new Set(rows.map(r => r.type))).toEqual(new Set(['flight', 'hotel', 'transport', 'mice']))
    expect(rows.every(r => ['Diproses', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'].includes(r.clientStatus))).toBe(true)
    const flight = rows.find(r => r.type === 'flight' && (r.details.segments as unknown[]).length)!
    expect(flight.details).toMatchObject({ airline: 'Garuda Indonesia', cabinClass: 'economy', ticketingDeadline: '2026-10-25' })
    const keys = keysOf(rows)
    for (const k of ['sellAmountMinor', 'netCostMinor', 'vendorId', 'serviceId', 'options', 'fareIdr', 'ratePerNightIdr', 'ratePerUnitIdr', 'boqItems',
      'netCostIdr', 'sellPriceIdr', 'statusReason', 'paymentGate', 'attempts', 'flaggedDuplicate', 'duplicateOf', 'duplicateNote', 'picUserId',
      'staffAssignments', 'checklist', 'scheduleChangeNote', 'amendmentNote', 'changeNote', 'incidentNote', 'changeOrderNote', 'tollFeeIdr']) {
      expect(keys.has(k), k).toBe(false)
    }
    expect((await get('/client/reservations', 'admin')).status).toBe(403)
  })
})

describe('GET /client/quotations', () => {
  test('only sent quotations of the client party, without cost, margin, markup or approval internals', async () => {
    // Make the client party own one sent and one unsent quotation, whatever the seed has.
    const leads = await t.db.query<{ id: string }>("select l.id from leads l join quotations q on q.lead_id = l.id order by l.id limit 2")
    await t.db.query("update leads set party_id = 'PTY-005' where id = any($1::text[])", [leads.map(l => l.id)])
    await t.db.query("update quotations set sent_to_client_on = '2026-07-01' where lead_id = $1", [leads[0]!.id])
    await t.db.query("update quotation_versions v set status = 'approved' from quotations q where q.id = v.quotation_id and q.lead_id = $1 and v.version = q.current_version", [leads[0]!.id])
    await t.db.query('update quotations set sent_to_client_on = null where lead_id = $1', [leads[1]!.id])

    const res = await get('/client/quotations', 'client')
    expect(res.status).toBe(200)
    const rows = res.json.data as { id: string; lead: { id: string }; amountMinor: string; sentToClientOn: string }[]
    const expected = await t.db.query<{ id: string }>(
      "select q.id from quotations q join leads l on l.id = q.lead_id where l.party_id = 'PTY-005' and q.sent_to_client_on is not null order by q.id")
    expect(rows.map(r => r.id).sort()).toEqual(expected.map(r => r.id))
    expect(rows.some(r => r.lead.id === leads[0]!.id)).toBe(true)
    expect(rows.some(r => r.lead.id === leads[1]!.id)).toBe(false) // not sent
    expect(rows.every(r => r.sentToClientOn && /^\d+$/.test(r.amountMinor))).toBe(true)
    const keys = keysOf(rows)
    for (const k of ['markupMinor', 'estimatedCostMinor', 'estimatedMarginMinor', 'costSheetId', 'decisionNote', 'decidedBy', 'submittedBy',
      'ownerUserId', 'qualificationNotes', 'budgetRange', 'decisionMaker', 'urgency', 'source', 'stage', 'createdBy']) {
      expect(keys.has(k), k).toBe(false)
    }
  })

  test('the previous amount is the last version actually sent, never an unsent internal version', async () => {
    const q = (await t.db.query<{ id: string; v: number; amount: string }>(
      `select q.id, q.current_version as v, cv.amount_minor::text as amount from quotations q join leads l on l.id = q.lead_id
         join quotation_versions cv on cv.quotation_id = q.id and cv.version = q.current_version
        where l.party_id = 'PTY-005' and q.sent_to_client_on is not null order by q.id limit 1`))[0]!
    // v was sent; v+1 (160M) was rejected internally and never sent; v+2 (150M) is current and sent.
    await t.db.query("insert into audit_events (action, entity_type, entity_id, after) values ('quotation.sent', 'quotation', $1, $2::text::jsonb)", [q.id, JSON.stringify({ version: q.v })])
    for (const [version, amount, status] of [[q.v + 1, 160000000, 'rejected'], [q.v + 2, 150000000, 'approved']] as const) {
      await t.db.query(
        `insert into quotation_versions (quotation_id, version, amount_minor, currency, service_breakdown, status, created_by)
         select quotation_id, $2, $3, currency, service_breakdown, $4, created_by from quotation_versions where quotation_id = $1 and version = $5`,
        [q.id, version, amount, status, q.v])
    }
    await t.db.query('update quotations set current_version = $2 where id = $1', [q.id, q.v + 2])
    await t.db.query("insert into audit_events (action, entity_type, entity_id, after) values ('quotation.sent', 'quotation', $1, $2::text::jsonb)", [q.id, JSON.stringify({ version: q.v + 2 })])

    const row = ((await get('/client/quotations', 'client')).json.data as { id: string; amountMinor: string; previousAmountMinor: string | null }[]).find(r => r.id === q.id)!
    expect(row.amountMinor).toBe('150000000')
    expect(row.previousAmountMinor).toBe(q.amount)
  })

  test('other roles are refused', async () => {
    for (const who of ['admin', 'finance', 'vendor']) expect((await get('/client/quotations', who)).status, who).toBe(403)
    expect((await t.call('GET', '/api/v1/client/quotations')).status).toBe(401)
  })
})
