import { beforeEach, describe, expect, it, vi } from "vitest"

// The server's Supabase client is a stub: what is under test is who the hub takes for signed in, which is decided in one place (`getSessionState`), and what a page that needs a member does with the rest
const { createServerClient, flags } = vi.hoisted(() => ({ createServerClient: vi.fn(), flags: { demo: false } }))
vi.mock("server-only", () => ({}))
vi.mock("@supabase/ssr", () => ({ createServerClient }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], get: (name: string) => (name === "pbgo_demo_account" && flags.demo ? { value: "1" } : undefined), set: () => {} }),
}))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`)
  },
}))

import { DEMO_ACCOUNT } from "./demo"
import { getAccount, getSessionState, requireAccount, secondStepPendingAfterSignIn } from "./server"

/** An access token the way Supabase Auth shapes one: the middle part holds the claims, the rest is nothing here. */
const token = (aal: "aal1" | "aal2") => `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ sub: "u-1", aal })).replace(/=+$/, "")}.c2ln`

const totp = { id: "f-1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app", created_at: "2026-11-09T16:00:00.000Z" }

type Stub = { user?: Record<string, unknown> | null; aal?: "aal1" | "aal2"; session?: boolean }

/** A client that answers like Supabase Auth would: the Auth server's user, and the session the cookies hold. */
function stubClient({ user = { id: "u-1", email: "ore@example.com" }, aal = "aal1", session = true }: Stub = {}) {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user } })),
    getSession: vi.fn(async () => ({ data: { session: session ? { access_token: token(aal) } : null } })),
  }
  createServerClient.mockReturnValue({ auth })
  return auth
}

beforeEach(() => {
  createServerClient.mockReset()
  flags.demo = false
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdef.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
})

describe("getSessionState", () => {
  it("makes the account of a member who has no second step, whatever the level of their session", async () => {
    stubClient({ aal: "aal1" })
    const state = await getSessionState()
    expect(state.account?.id).toBe("u-1")
    expect(state.secondStep).toBe(false)
  })

  it("makes the account of a member who has set one up once their session has passed it", async () => {
    stubClient({ user: { id: "u-1", factors: [totp] }, aal: "aal2" })
    const state = await getSessionState()
    expect(state.account?.id).toBe("u-1")
    expect(state.account?.secondStep).toEqual([{ id: "f-1", name: "Authenticator app", createdAt: "2026-11-09T16:00:00.000Z" }])
    expect(state.secondStep).toBe(false)
  })

  it("makes no account of a session that holds the first factor alone, of a member who has set the second one up, and says what is left", async () => {
    stubClient({ user: { id: "u-1", factors: [totp] }, aal: "aal1" })
    expect(await getSessionState()).toEqual({ account: null, secondStep: true })
  })

  it("lets in a member whose set-up was never finished: a factor that nobody proved is no second step", async () => {
    stubClient({ user: { id: "u-1", factors: [{ ...totp, status: "unverified" }] }, aal: "aal1" })
    const state = await getSessionState()
    expect(state.account?.id).toBe("u-1")
    expect(state.secondStep).toBe(false)
  })

  it("lets nobody in on a token it cannot read: the level of a token that is not understood is not aal2", async () => {
    const auth = stubClient({ user: { id: "u-1", factors: [totp] } })
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "not-a-jwt" } } })
    expect(await getSessionState()).toEqual({ account: null, secondStep: true })
    auth.getSession.mockResolvedValue({ data: { session: null } })
    expect(await getSessionState()).toEqual({ account: null, secondStep: true })
  })

  it("reads the level only for a user the Auth server has confirmed, and the factors from the user it answered with", async () => {
    const auth = stubClient({ user: null })
    expect(await getSessionState()).toEqual({ account: null, secondStep: false })
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it("is nobody without a project, and the demo account of development when its cookie is there", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await getSessionState()).toEqual({ account: null, secondStep: false })
    flags.demo = true
    expect(await getSessionState()).toEqual({ account: DEMO_ACCOUNT, secondStep: false })
    expect(createServerClient).not.toHaveBeenCalled()
  })
})

describe("getAccount and requireAccount", () => {
  it("are the member's account once the second step is passed, and for a member who has none", async () => {
    stubClient({ user: { id: "u-1", factors: [totp] }, aal: "aal2" })
    expect((await getAccount())?.id).toBe("u-1")
    expect((await requireAccount("/me")).id).toBe("u-1")
  })

  it("make nobody of a session that has not passed the second step: every page and every route that reads the account treats it as a guest", async () => {
    stubClient({ user: { id: "u-1", factors: [totp] }, aal: "aal1" })
    expect(await getAccount()).toBeNull()
  })

  it("send a session that has not passed the second step to the sign-in, which asks for the code and brings it back", async () => {
    stubClient({ user: { id: "u-1", factors: [totp] }, aal: "aal1" })
    await expect(requireAccount("/me/settings/account")).rejects.toThrow("redirect /login?next=%2Fme%2Fsettings%2Faccount")
  })
})

describe("secondStepPendingAfterSignIn", () => {
  /** A client that answers `getUser(token)` like the Auth server: the user of that token, with the factors it lists. */
  const clientOf = (user: Record<string, unknown> | null, fails = false) => {
    const getUser = vi.fn(async (_token: string) => {
      if (fails) throw new Error("fetch failed")
      return { data: { user } }
    })
    return { client: { auth: { getUser } } as never, getUser }
  }

  it("is true for a session that was just made with the first factor alone, of a member who has set up the second one", async () => {
    const { client, getUser } = clientOf({ id: "u-1", factors: [totp] })
    expect(await secondStepPendingAfterSignIn(client, token("aal1"))).toBe(true)
    // The user is asked for with the token of the session that was just made: nothing is read back from cookies that are being written
    expect(getUser).toHaveBeenCalledWith(token("aal1"))
  })

  it("is false once the session has passed it, and for a member who has none or whose set-up was never finished", async () => {
    expect(await secondStepPendingAfterSignIn(clientOf({ id: "u-1", factors: [totp] }).client, token("aal2"))).toBe(false)
    expect(await secondStepPendingAfterSignIn(clientOf({ id: "u-1", factors: [] }).client, token("aal1"))).toBe(false)
    expect(await secondStepPendingAfterSignIn(clientOf({ id: "u-1", factors: [{ ...totp, status: "unverified" }] }).client, token("aal1"))).toBe(false)
  })

  it("is false, and asks nothing, when there is no token; and false when the Auth server cannot say: the page that comes next decides", async () => {
    const { client, getUser } = clientOf({ id: "u-1", factors: [totp] })
    expect(await secondStepPendingAfterSignIn(client, undefined)).toBe(false)
    expect(await secondStepPendingAfterSignIn(client, null)).toBe(false)
    expect(getUser).not.toHaveBeenCalled()
    expect(await secondStepPendingAfterSignIn(clientOf(null).client, token("aal1"))).toBe(false)
    expect(await secondStepPendingAfterSignIn(clientOf({ id: "u-1", factors: [totp] }, true).client, token("aal1"))).toBe(false)
  })
})
