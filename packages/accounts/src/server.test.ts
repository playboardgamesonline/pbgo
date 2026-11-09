import { beforeEach, describe, expect, it, vi } from "vitest"

// The cookies of the request are a list of names here: what is under test is which of them `clearSessionCookies` takes off
const store = vi.hoisted(() => ({ names: [] as string[], deleted: [] as string[] }))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => store.names.map((name) => ({ name, value: "x" })),
    delete: (name: string) => {
      store.deleted.push(name)
    },
  }),
}))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }))

import { clearSessionCookies } from "./server"

beforeEach(() => {
  store.names = []
  store.deleted = []
})

describe("clearSessionCookies", () => {
  it("takes off the cookies of the Supabase session, in pieces too (a long session is cut), and nothing else", async () => {
    store.names = ["sb-abc-auth-token", "sb-abc-auth-token.0", "sb-abc-auth-token.1", "sb-abc-auth-token-code-verifier", "sb-abc-auth-tokens", "pbgo-locale", "pbgo_demo_account", "pbgo-consent"]
    await clearSessionCookies()
    expect(store.deleted).toEqual(["sb-abc-auth-token", "sb-abc-auth-token.0", "sb-abc-auth-token.1"])
  })

  it("does nothing when the request holds no session", async () => {
    store.names = ["pbgo-locale", "sb-abc-auth-token-code-verifier"]
    await clearSessionCookies()
    expect(store.deleted).toEqual([])
  })
})
