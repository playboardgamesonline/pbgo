import { createHash, createHmac, timingSafeEqual } from "node:crypto"

/**
 * The gamemaster session: one signed token for the whole back office (every game), pure functions only.
 * `admin.ts` wires them to the cookie; keeping them here lets the unit tests cover the rules without Next.
 *
 * Token: `v1.<expiry>.<signature>`, expiry in Unix seconds, signature = HMAC-SHA256 of `v1.<expiry>` in base64url.
 * The HMAC key is derived from `ADMIN_SESSION_SECRET` AND the login and password, so a password change (or a new
 * secret) invalidates every session already issued, and nothing about the credentials is stored in the cookie.
 */

const VERSION = "v1"
/** A session lasts 7 days, then the gamemaster signs in again. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
/** Clocks of two server instances may differ a little: an expiry slightly beyond the TTL is still ours. */
const CLOCK_SKEW_SECONDS = 60
/** Shorter secrets are guessable; `openssl rand -base64 48` gives 64 characters. */
export const MIN_SECRET_LENGTH = 32

export type AdminEnv = Readonly<Record<string, string | undefined>>
export type AdminCredentials = { login: string; password: string; secret: string }

/**
 * - `configured`: login, password and secret are set, a signed session is required
 * - `open`: local development (`NODE_ENV=development`) with nothing configured, everyone is the gamemaster
 * - `unconfigured`: access is denied in every other case; `problems` tells the login page what to fix
 */
export type AdminAccess =
  | { mode: "configured"; credentials: AdminCredentials }
  | { mode: "open" }
  | { mode: "unconfigured"; problems: string[] }

export function adminAccess(env: AdminEnv): AdminAccess {
  const login = env.ADMIN_LOGIN?.trim()
  const password = env.ADMIN_PASSWORD
  const secret = env.ADMIN_SESSION_SECRET
  const problems: string[] = []
  if (!login) problems.push("ADMIN_LOGIN is not set")
  if (!password) problems.push("ADMIN_PASSWORD is not set")
  if (!secret) problems.push("ADMIN_SESSION_SECRET is not set")
  else if (secret.length < MIN_SECRET_LENGTH) problems.push(`ADMIN_SESSION_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`)
  if (login && password && secret && secret.length >= MIN_SECRET_LENGTH) return { mode: "configured", credentials: { login, password, secret } }
  if (env.NODE_ENV === "development" && !login && !password && !secret) return { mode: "open" }
  return { mode: "unconfigured", problems }
}

/** Equal-length digests make `timingSafeEqual` usable on strings of any length without leaking the length. */
function same(a: string, b: string) {
  const x = createHash("sha256").update(a).digest()
  const y = createHash("sha256").update(b).digest()
  return timingSafeEqual(x, y)
}

/** Both fields are always compared (no early return), so the time does not tell which one was wrong. */
export function checkCredentials(credentials: AdminCredentials, login: string, password: string) {
  const loginOk = same(login, credentials.login)
  const passwordOk = same(password, credentials.password)
  return loginOk && passwordOk
}

function signature(credentials: AdminCredentials, payload: string) {
  const key = createHmac("sha256", credentials.secret).update(`${credentials.login}\0${credentials.password}`).digest()
  return createHmac("sha256", key).update(payload).digest("base64url")
}

export function signSession(credentials: AdminCredentials, now: number = Date.now()) {
  const payload = `${VERSION}.${Math.floor(now / 1000) + SESSION_TTL_SECONDS}`
  return `${payload}.${signature(credentials, payload)}`
}

export function verifySession(token: string | undefined, credentials: AdminCredentials, now: number = Date.now()) {
  if (!token) return false
  const [version, expiry, given, ...rest] = token.split(".")
  if (version !== VERSION || !expiry || !given || rest.length > 0 || !/^\d{1,12}$/.test(expiry)) return false
  const seconds = Math.floor(now / 1000)
  if (Number(expiry) <= seconds || Number(expiry) > seconds + SESSION_TTL_SECONDS + CLOCK_SKEW_SECONDS) return false
  return same(given, signature(credentials, `${version}.${expiry}`))
}
