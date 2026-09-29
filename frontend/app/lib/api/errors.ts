import type { ApiErrorPayload } from '~/types/api'

/**
 * Every failed API call surfaces as one ApiError, whatever went wrong (server error envelope, proxy
 * returning HTML, network down). UIs switch on `code`, show `message` (already plain Indonesian from the
 * server), put `fieldErrors` next to inputs, and show `requestId` in error states so support can trace it.
 */

export const CLIENT_ERROR_CODES = {
  network: 'NETWORK_ERROR',
  unexpected: 'UNEXPECTED_RESPONSE'
} as const

export class ApiError extends Error {
  override name = 'ApiError'

  constructor (
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }

  get isUnauthenticated () { return this.status === 401 }
  get isForbidden () { return this.status === 403 }
  get isNotFound () { return this.status === 404 }
  /** Stale version / duplicate / state changed underneath — the UI should refresh and let the user retry. */
  get isConflict () { return this.status === 409 }
  get isValidation () { return this.status === 400 && Object.keys(this.fieldErrors).length > 0 }
  get isRetryable () { return this.status === 0 || this.status === 429 || this.status >= 500 }

  /** First message for a form field, if any. */
  fieldError (field: string): string | undefined {
    return this.fieldErrors[field]?.[0]
  }
}

export function isApiError (value: unknown): value is ApiError {
  return value instanceof ApiError
}

function isErrorPayload (body: unknown): body is ApiErrorPayload {
  if (!body || typeof body !== 'object') { return false }
  const error = (body as { error?: unknown }).error
  return !!error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
}

export function toApiError (status: number, body: unknown, headerRequestId: string | null): ApiError {
  if (isErrorPayload(body)) {
    return new ApiError(
      status,
      body.error.code,
      body.error.message,
      body.meta?.requestId ?? headerRequestId,
      body.error.fieldErrors ?? {},
      body.error.details ?? {}
    )
  }
  return new ApiError(
    status,
    CLIENT_ERROR_CODES.unexpected,
    status >= 500 || status === 0
      ? 'Server sedang tidak dapat dihubungi. Coba lagi sebentar lagi.'
      : 'Respons server tidak dikenali.',
    headerRequestId
  )
}

export function networkError (cause: unknown): ApiError {
  const error = new ApiError(0, CLIENT_ERROR_CODES.network, 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.')
  ;(error as Error & { cause?: unknown }).cause = cause
  return error
}
