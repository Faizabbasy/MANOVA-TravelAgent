import { errors } from './errors'

/** Success envelope: `{ data, meta: { requestId, pagination? } }`. */

const requestIds = new WeakMap<Request, string>()
const SAFE_INCOMING_ID = /^[A-Za-z0-9._:-]{8,128}$/

/**
 * Honour an upstream `X-Request-Id` (proxy, frontend) when it is well-formed, so one ID follows a request
 * across services; otherwise mint one.
 */
export function assignRequestId(request: Request): string {
  const incoming = request.headers.get('x-request-id')
  const id = incoming && SAFE_INCOMING_ID.test(incoming) ? incoming : `req_${crypto.randomUUID()}`
  requestIds.set(request, id)
  return id
}

export function requestIdOf(request: Request): string {
  return requestIds.get(request) ?? assignRequestId(request)
}

export interface Pagination {
  limit: number
  nextCursor: string | null
}

export function ok<T>(request: Request, data: T) {
  return { data, meta: { requestId: requestIdOf(request) } }
}

export function okList<T>(request: Request, data: T[], pagination: Pagination) {
  return { data, meta: { requestId: requestIdOf(request), pagination } }
}

/** Shape of every text ID we issue or import (PRJ-101, USR-021, MICE-1035, SO-002 …). */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/**
 * Path IDs that cannot exist are answered as "not found" before touching the database (a NUL byte, for
 * example, would otherwise surface as a Postgres error and a 500).
 */
export function assertIdParam(value: string, what: string): string {
  if (!ID_PATTERN.test(value)) throw errors.notFound(what)
  return value
}

export const DEFAULT_PAGE_LIMIT = 25
export const MAX_PAGE_LIMIT = 100

/** Cursor = last seen id, base64url-encoded so clients treat it as opaque. */
export function parsePageQuery(query: { limit?: string; cursor?: string }): { limit: number; after: string | null } {
  let limit = DEFAULT_PAGE_LIMIT
  if (query.limit !== undefined) {
    const n = Number(query.limit)
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_LIMIT) {
      throw errors.validation({ limit: [`Harus bilangan bulat 1–${MAX_PAGE_LIMIT}.`] })
    }
    limit = n
  }
  let after: string | null = null
  if (query.cursor) {
    try {
      after = Buffer.from(query.cursor, 'base64url').toString('utf8')
    } catch {
      after = null
    }
    if (!after || !ID_PATTERN.test(after)) throw errors.validation({ cursor: ['Cursor tidak valid.'] })
  }
  return { limit, after }
}

/** Given `limit + 1` rows ordered by id, returns the page and the cursor for the next one. */
export function paginate<T extends { id: string }>(rows: T[], limit: number): { items: T[]; pagination: Pagination } {
  const items = rows.slice(0, limit)
  const last = items[items.length - 1]
  const nextCursor = rows.length > limit && last ? Buffer.from(last.id, 'utf8').toString('base64url') : null
  return { items, pagination: { limit, nextCursor } }
}
