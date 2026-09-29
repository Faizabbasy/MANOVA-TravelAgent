/**
 * API error contract (docs/manova-finance-implementation/05-API-CONTRACTS.md):
 *   { error: { code, message, fieldErrors?, details? }, meta: { requestId } }
 * Handlers throw AppError; the app-level error hook renders it. Anything else becomes a 500 whose
 * message never includes internals.
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'INVALID_JSON'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'ROLE_DISABLED'
  | 'MAKER_CHECKER_VIOLATION'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'ALREADY_REVERSED'
  | 'INSUFFICIENT_BALANCE'
  | 'OPENING_BALANCE_UNVERIFIED'
  | 'CSRF_ORIGIN_REJECTED'
  | 'NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  | 'CONFLICT'
  | 'RULE_VIOLATION'
  | 'TOO_MANY_ATTEMPTS'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL'

export type FieldErrors = Record<string, string[]>

export class AppError extends Error {
  override name = 'AppError'
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly extra: { fieldErrors?: FieldErrors; details?: Record<string, unknown>; headers?: Record<string, string> } = {}
  ) {
    super(message)
  }
}

export const errors = {
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Sesi tidak ditemukan atau sudah berakhir. Silakan masuk lagi.'),
  forbidden: (message = 'Anda tidak memiliki akses untuk tindakan ini.') => new AppError(403, 'FORBIDDEN', message),
  /** Out-of-scope records use this too, so existence is never leaked. */
  notFound: (what = 'Data') => new AppError(404, 'NOT_FOUND', `${what} tidak ditemukan.`),
  validation: (fieldErrors: FieldErrors, message = 'Beberapa isian belum valid.') =>
    new AppError(400, 'VALIDATION_FAILED', message, { fieldErrors }),
  badRequest: (message: string) => new AppError(400, 'BAD_REQUEST', message)
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors; details?: Record<string, unknown> }
  meta: { requestId: string }
}

export function errorBody(err: AppError, requestId: string): ErrorBody {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.extra.fieldErrors ? { fieldErrors: err.extra.fieldErrors } : {}),
      ...(err.extra.details ? { details: err.extra.details } : {})
    },
    meta: { requestId }
  }
}
