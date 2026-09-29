/** Password hashing via Bun's built-in argon2id. Hashes are self-describing (algorithm + params + salt). */

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' })
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

let dummyHash: Promise<string> | undefined

/**
 * Burns the same verification time as a real check, so "no such email" and "wrong password" cannot be
 * told apart by response time.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('manova-timing-equaliser')
  await Bun.password.verify(password, await dummyHash)
  return false
}
