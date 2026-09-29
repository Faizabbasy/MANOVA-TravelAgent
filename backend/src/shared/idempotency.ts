import { createHash } from 'node:crypto'
import type { Db, Queryable } from '../db/client'
import { AppError } from '../http/errors'

/**
 * Replay protection for money-moving commands (docs/.../05: "Mutasi finansial menerima Idempotency-Key").
 *
 * The key row is claimed INSIDE the same database transaction as the posting. Consequences:
 *  - posting fails → the claim rolls back too, so the client can retry with the same key;
 *  - two concurrent requests with one key → the second waits on the primary key until the first commits,
 *    then sees the stored response and returns it instead of posting again;
 *  - the same key with a different body → 409, never a silent second posting.
 */

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key')
  if (!key) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Header Idempotency-Key wajib untuk pencatatan uang, agar pengiriman ulang tidak mencatat dua kali.')
  }
  if (!KEY_PATTERN.test(key)) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key harus 8–128 karakter huruf, angka, "-" atau "_".')
  }
  return key
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export interface IdempotentResult<T> {
  data: T
  replayed: boolean
}

/**
 * Runs `fn` once per (actor, route, key) inside one transaction and stores its result.
 * `route` should identify the command including its path target (e.g. `POST /finance/transactions/TRX-1/reverse`).
 */
export async function withIdempotency<T>(
  db: Db,
  input: { actorUserId: string; route: string; key: string; body: unknown },
  fn: (tx: Queryable) => Promise<T>
): Promise<IdempotentResult<T>> {
  const requestHash = createHash('sha256').update(`${input.route}\n${stableStringify(input.body)}`).digest('hex')

  return db.transaction(async tx => {
    const claimed = await tx.query(
      `insert into idempotency_keys (actor_user_id, route, key, request_hash) values ($1, $2, $3, $4)
       on conflict do nothing returning key`,
      [input.actorUserId, input.route, input.key, requestHash]
    )
    if (!claimed.length) {
      const [existing] = await tx.query<{ request_hash: string; response: T | null }>(
        'select request_hash, response from idempotency_keys where actor_user_id = $1 and route = $2 and key = $3',
        [input.actorUserId, input.route, input.key]
      )
      if (!existing || existing.request_hash !== requestHash || existing.response === null) {
        throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key ini sudah dipakai untuk permintaan lain. Buat key baru untuk pencatatan baru.')
      }
      return { data: existing.response, replayed: true }
    }

    const data = await fn(tx)
    await tx.query(
      'update idempotency_keys set response = $4::text::jsonb where actor_user_id = $1 and route = $2 and key = $3',
      [input.actorUserId, input.route, input.key, JSON.stringify(data)]
    )
    return { data, replayed: false }
  })
}
