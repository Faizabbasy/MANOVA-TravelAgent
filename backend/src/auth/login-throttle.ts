/**
 * Brute-force brake for the login endpoint. Every attempt is counted *before* the password is verified,
 * so parallel requests cannot all slip through while a slow argon2 check is in flight.
 *
 *  - per (ip, email): `maxPerPair` attempts per window (stops one client hammering one account)
 *  - per email, any ip: `maxPerEmail` attempts per window (stops rotating/spoofed IPs)
 * A successful login clears both counters for that email.
 *
 * In-memory, so limits are per API instance and reset on restart. Enough for one instance; a shared
 * store is needed before running several instances (recorded as a risk in the Phase 1 report).
 */
export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly maxPerPair = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
    private readonly maxPerEmail = 20
  ) {}

  private pairKey(ip: string | null, email: string): string {
    return `pair|${ip ?? 'unknown'}|${email.toLowerCase()}`
  }

  private emailKey(email: string): string {
    return `email|${email.toLowerCase()}`
  }

  private live(key: string, t: number) {
    const entry = this.attempts.get(key)
    if (entry && entry.resetAt <= t) {
      this.attempts.delete(key)
      return undefined
    }
    return entry
  }

  /**
   * Registers one attempt. Returns 0 when the attempt may proceed, otherwise the seconds until the next
   * attempt is allowed (the blocked attempt itself is not counted).
   */
  consume(ip: string | null, email: string): number {
    const t = this.now()
    const limits: [string, number][] = [[this.pairKey(ip, email), this.maxPerPair], [this.emailKey(email), this.maxPerEmail]]
    for (const [key, max] of limits) {
      const entry = this.live(key, t)
      if (entry && entry.count >= max) return Math.ceil((entry.resetAt - t) / 1000)
    }
    for (const [key] of limits) {
      const entry = this.live(key, t)
      if (entry) entry.count += 1
      else this.attempts.set(key, { count: 1, resetAt: t + this.windowMs })
    }
    if (this.attempts.size > 10_000) this.prune(t)
    return 0
  }

  /** Clears the counters after a successful login. */
  reset(ip: string | null, email: string): void {
    this.attempts.delete(this.pairKey(ip, email))
    this.attempts.delete(this.emailKey(email))
  }

  private prune(t: number): void {
    for (const [key, entry] of this.attempts) if (entry.resetAt <= t) this.attempts.delete(key)
  }
}
