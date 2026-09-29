import "server-only"
import { createHash, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { ApiError } from "./api"

const COOKIE = "admin_session"

function credentials() {
  const login = process.env.ADMIN_LOGIN
  const password = process.env.ADMIN_PASSWORD
  return login && password ? { login, password } : null
}

function sessionToken(login: string, password: string) {
  return createHash("sha256").update(`admin:${login}:${password}`).digest("hex")
}

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function adminConfigured() {
  return !!credentials()
}

export async function isAdmin() {
  const c = credentials()
  if (!c) return process.env.NODE_ENV !== "production"
  const value = (await cookies()).get(COOKIE)?.value
  return !!value && same(value, sessionToken(c.login, c.password))
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new ApiError("ACCESS_DENIED", 401)
}

export async function loginAdmin(login: string, password: string) {
  const c = credentials()
  if (!c || !same(login, c.login) || !same(password, c.password)) throw new ApiError("INVALID_CREDENTIALS", 401)
  ;(await cookies()).set(COOKIE, sessionToken(c.login, c.password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function logoutAdmin() {
  ;(await cookies()).delete(COOKIE)
}
