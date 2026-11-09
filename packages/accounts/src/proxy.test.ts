import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The server client is a stub: what is under test is what the proxy asks of it, and what it does with the cookies on the way out
const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn() }))
vi.mock("@supabase/ssr", () => ({ createServerClient }))

import { hasSessionCookie, updateSession } from "./proxy"

describe("hasSessionCookie", () => {
  it("sees the session of a project, whole or cut in pieces", () => {
    expect(hasSessionCookie(["sb-igxsfcezbhidnlknuudf-auth-token"])).toBe(true)
    expect(hasSessionCookie(["theme", "sb-ckpbuuxcdsayonyahlkk-auth-token.0", "sb-ckpbuuxcdsayonyahlkk-auth-token.1"])).toBe(true)
  })

  it("does not take the secret of a sign-in that started for a session", () => {
    expect(hasSessionCookie(["sb-igxsfcezbhidnlknuudf-auth-token-code-verifier"])).toBe(false)
  })

  it("finds nothing in the cookies of a visitor who is not signed in", () => {
    expect(hasSessionCookie([])).toBe(false)
    expect(hasSessionCookie(["pbgo-locale", "pbgo_consent", "courtisans_player", "pbgo_demo_account"])).toBe(false)
    expect(hasSessionCookie(new Set(["sb-auth-token", "sb--auth-token.x", "xsb-ref-auth-token"]))).toBe(false)
  })
})

describe("updateSession", () => {
  const cookies = "sb-abc-auth-token.0=aaa; sb-abc-auth-token.1=bbb; sb-abc-auth-token-code-verifier=ccc; pbgo-locale=fr"
  const request = () => new NextRequest("https://playboardgamesonline.app/", { headers: { cookie: cookies } })

  type Stub = { claims?: unknown; user?: unknown; error?: unknown }
  /** A client that answers like Supabase Auth would; `auth` records the calls. */
  function stubClient({ claims = { sub: "u-1" }, user = { id: "u-1" }, error = null }: Stub = {}) {
    const auth = {
      getClaims: vi.fn(async () => ({ data: claims ? { claims } : null })),
      getUser: vi.fn(async () => ({ data: { user }, error })),
    }
    createServerClient.mockReturnValue({ auth })
    return auth
  }

  /** The cookies a response takes off the device. */
  const taken = (response: Awaited<ReturnType<typeof updateSession>>["response"]) =>
    response.cookies
      .getAll()
      .filter((cookie) => cookie.value === "")
      .map((cookie) => cookie.name)
      .sort()

  beforeEach(() => {
    createServerClient.mockReset()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdef.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("trusts the claims of the token and asks the Auth server nothing, unless it is asked to confirm", async () => {
    const auth = stubClient()
    const { signedIn, response } = await updateSession(request())
    expect(signedIn).toBe(true)
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(taken(response)).toEqual([])
  })

  it("is not signed in when the token has no claims, and does not ask the Auth server then either", async () => {
    const auth = stubClient({ claims: null })
    expect((await updateSession(request(), { confirm: true })).signedIn).toBe(false)
    expect(auth.getUser).not.toHaveBeenCalled()
  })

  it("is not signed in without a project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect((await updateSession(request(), { confirm: true })).signedIn).toBe(false)
    expect(createServerClient).not.toHaveBeenCalled()
  })

  describe("when it confirms the session with the Auth server", () => {
    it("is signed in when the Auth server knows the session, and leaves the cookies alone", async () => {
      const auth = stubClient()
      const { signedIn, response } = await updateSession(request(), { confirm: true })
      expect(signedIn).toBe(true)
      expect(auth.getUser).toHaveBeenCalledTimes(1)
      expect(taken(response)).toEqual([])
    })

    it("is not signed in when the session was ended on the server, and takes its cookies off the device, the pieces of the session and nothing else", async () => {
      // The token is good for up to an hour, but the session it names is gone (the member signed out their other devices, or turned the second step on): the client library makes an AuthSessionMissingError of the answer
      stubClient({ user: null, error: new AuthSessionMissingError() })
      const { signedIn, response } = await updateSession(request(), { confirm: true })
      expect(signedIn).toBe(false)
      expect(taken(response)).toEqual(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])
    })

    it("does the same for a session, a user or a token that the Auth server answers it does not know", async () => {
      for (const [status, code] of [
        [403, "session_not_found"],
        [404, "user_not_found"],
        [401, "bad_jwt"],
      ] as const) {
        stubClient({ user: null, error: new AuthApiError("gone", status, code) })
        const { signedIn, response } = await updateSession(request(), { confirm: true })
        expect(signedIn).toBe(false)
        expect(taken(response)).toEqual(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])
      }
    })

    it("is not signed in when the Auth server cannot answer, but keeps the cookies: a server that is down says nothing about the session", async () => {
      for (const error of [new AuthRetryableFetchError("Failed to fetch", 0), new AuthApiError("Service unavailable", 503, "unexpected_failure"), new AuthApiError("Slow", 504, "request_timeout")]) {
        stubClient({ user: null, error })
        const { signedIn, response } = await updateSession(request(), { confirm: true })
        expect(signedIn).toBe(false)
        expect(taken(response)).toEqual([])
      }
    })
  })
})
