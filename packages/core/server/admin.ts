import "server-only"
import { cookies } from "next/headers"
import { SESSION_TTL_SECONDS, adminAccess, checkCredentials, signSession, verifySession } from "./admin-session"
import { ApiError } from "./api"

/** One signed session for the whole gamemaster, sent by the browser to `/gamemaster/**` only (pages, admin API, previews). */
export const ADMIN_COOKIE = "gamemaster_session"
const ADMIN_COOKIE_PATH = "/gamemaster"
/** Session cookie of the former per-game admin (sha256 of the credentials, path `/`, no expiry): cleared on sign-in and sign-out. */
const LEGACY_COOKIE = "admin_session"

const access = () => adminAccess(process.env)

/** ADMIN_LOGIN, ADMIN_PASSWORD and ADMIN_SESSION_SECRET are all set (local development with none of them is open instead). */
export const adminConfigured = () => access().mode === "configured"

/** What keeps the gamemaster closed for everyone, for the login page; empty when it can be used. */
export function adminProblems() {
  const state = access()
  return state.mode === "unconfigured" ? state.problems : []
}

export async function isAdmin() {
  const state = access()
  if (state.mode === "open") return true
  if (state.mode !== "configured") return false
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value, state.credentials)
}

export async function requireAdmin() {
  if (access().mode === "unconfigured") throw new ApiError("ADMIN_NOT_CONFIGURED", 403)
  if (!(await isAdmin())) throw new ApiError("ACCESS_DENIED", 401)
}

export async function loginAdmin(login: string, password: string) {
  const state = access()
  if (state.mode === "unconfigured") throw new ApiError("ADMIN_NOT_CONFIGURED", 403)
  if (state.mode === "open") return
  if (!checkCredentials(state.credentials, login, password)) throw new ApiError("INVALID_CREDENTIALS", 401)
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, signSession(state.credentials), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    path: ADMIN_COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS,
  })
  jar.delete({ name: LEGACY_COOKIE, path: "/" })
}

export async function logoutAdmin() {
  const jar = await cookies()
  jar.delete({ name: ADMIN_COOKIE, path: ADMIN_COOKIE_PATH })
  jar.delete({ name: LEGACY_COOKIE, path: "/" })
}
