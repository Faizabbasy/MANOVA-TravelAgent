import type { AppConfig } from './config/env'
import type { Db } from './db/client'
import type { LoginThrottle } from './auth/login-throttle'

/** Everything a route module may depend on. Built once in index.ts; tests build their own. */
export interface AppDeps {
  db: Db
  config: AppConfig
  throttle?: LoginThrottle
  /** Request log sink; defaults to stdout JSON lines outside tests. */
  log?: (line: Record<string, unknown>) => void
}
