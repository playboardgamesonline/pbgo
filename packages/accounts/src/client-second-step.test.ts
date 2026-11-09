import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The browser's Supabase client is a stub: what is under test is what this module asks of it, and what it does with the answer. The second step is the code of an authenticator app (PLT-129, `./mfa`).
const { createBrowserClient } = vi.hoisted(() => ({ createBrowserClient: vi.fn() }))
vi.mock("@supabase/ssr", () => ({ createBrowserClient }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

/** An access token the way Supabase Auth shapes one: the middle part holds the claims, the rest is nothing here. */
const token = (aal: "aal1" | "aal2") => `eyJhbGciOiJFUzI1NiJ9.${btoa(JSON.stringify({ sub: "u-1", aal })).replace(/=+$/, "")}.c2ln`

type Factor = { id: string; factor_type: string; status: string; friendly_name?: string; created_at?: string }
const verified = (id: string): Factor => ({ id, factor_type: "totp", status: "verified", friendly_name: "Authenticator app", created_at: "2026-11-09T16:00:00.000Z" })

type Stub = {
  /** The session the browser holds: null for nobody. */
  session?: { access_token: string; user: { id: string } } | null
  /** The factors the Auth server lists for the user. */
  factors?: Factor[]
  listError?: unknown
  /** The error the Auth server answers a code with, by factor: a factor that is not here accepts it. */
  rejects?: Record<string, unknown>
  enrollError?: unknown
  unenrollError?: unknown
  /** What the calls throw instead of answering. */
  throws?: unknown
  refreshThrows?: boolean
}

/** A client that answers like Supabase Auth would; `auth` records the calls. */
function stubClient({ session = { access_token: token("aal1"), user: { id: "u-1" } }, factors = [], listError = null, rejects = {}, enrollError = null, unenrollError = null, throws, refreshThrows = false }: Stub = {}) {
  const answer = async <T>(value: T): Promise<T> => {
    if (throws !== undefined) throw throws
    return value
  }
  const auth = {
    getSession: vi.fn(() => answer({ data: { session } })),
    getUser: vi.fn(() => answer({ data: { user: session ? { id: "u-1", factors } : null } })),
    refreshSession: vi.fn(async () => {
      if (refreshThrows) throw new Error("offline")
      return { data: {}, error: null }
    }),
    mfa: {
      listFactors: vi.fn(() =>
        answer({ data: listError ? null : { all: factors, totp: factors.filter((factor) => factor.factor_type === "totp" && factor.status === "verified") }, error: listError }),
      ),
      enroll: vi.fn((_params: unknown) =>
        answer(
          enrollError
            ? { data: null, error: enrollError }
            : { data: { id: "f-new", type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'/>", secret: "ABCDEFGHIJKLMNOP", uri: "otpauth://totp/x" } }, error: null },
        ),
      ),
      unenroll: vi.fn((_params: { factorId: string }) => answer({ data: {}, error: unenrollError })),
      challengeAndVerify: vi.fn(({ factorId }: { factorId: string; code: string }) => answer({ data: {}, error: rejects[factorId] ?? null })),
    },
  }
  createBrowserClient.mockReturnValue({ auth })
  return auth
}

/** A fresh copy of the module: it keeps the client it made in a variable of its own. */
async function client() {
  vi.resetModules()
  return import("./client")
}

const wrong = new AuthApiError("MFA challenge could not be verified", 422, "mfa_verification_failed")
const limited = new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit")

beforeEach(() => {
  createBrowserClient.mockReset()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdef.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("secondStepNeeded", () => {
  it("is true for a session that holds the first factor alone, of a member who has an authenticator app", async () => {
    stubClient({ factors: [verified("f-1")] })
    expect(await (await client()).secondStepNeeded()).toBe(true)
  })

  it("is false once the session has proved the second step", async () => {
    stubClient({ session: { access_token: token("aal2"), user: { id: "u-1" } }, factors: [verified("f-1")] })
    expect(await (await client()).secondStepNeeded()).toBe(false)
  })

  it("is false for a member with none, or one whose set-up was never finished", async () => {
    stubClient({ factors: [] })
    expect(await (await client()).secondStepNeeded()).toBe(false)
    stubClient({ factors: [{ ...verified("f-1"), status: "unverified" }] })
    expect(await (await client()).secondStepNeeded()).toBe(false)
  })

  it("is false when nobody is signed in, when the project is not set, and when the question could not be asked", async () => {
    stubClient({ session: null })
    expect(await (await client()).secondStepNeeded()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).secondStepNeeded()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdef.supabase.co")
    stubClient({ throws: new AuthRetryableFetchError("Failed to fetch", 0) })
    expect(await (await client()).secondStepNeeded()).toBe(false)
  })
})

describe("verifySecondStep", () => {
  it("gives the code to the authenticator app of the member and is through when it is accepted", async () => {
    const auth = stubClient({ factors: [verified("f-1")] })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "done" })
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(1)
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-1", code: "123456" })
  })

  it("tells a wrong code in plain words, never in Supabase's", async () => {
    stubClient({ factors: [verified("f-1")], rejects: { "f-1": wrong } })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "failed", message: "That code is wrong or has expired. Check your app for the one it shows now." })
  })

  it("tells a sign-in that has ended, which is not a wrong code: the card offers to sign in again instead of asking for another try", async () => {
    // The session was ended elsewhere (the member signed out their other devices, or another device passed its second step): the Auth server knows none, or the browser holds none
    stubClient({ factors: [verified("f-1")], listError: new AuthSessionMissingError() })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "session-ended", message: "Your sign-in has ended. Sign in again." })
    stubClient({ factors: [verified("f-1")], rejects: { "f-1": new AuthApiError("Session from session_id claim in JWT does not exist", 403, "session_not_found") } })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "session-ended", message: "Your sign-in has ended. Sign in again." })
  })

  it("tries the next app while the code is wrong, since the member does not say which one it comes from", async () => {
    const auth = stubClient({ factors: [verified("f-1"), verified("f-2")], rejects: { "f-1": wrong } })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "done" })
    expect(auth.mfa.challengeAndVerify.mock.calls.map(([params]) => params.factorId)).toEqual(["f-1", "f-2"])
  })

  it("stops at an answer that is not a wrong code: a limit would be the same for the next app, and each try counts against it", async () => {
    const auth = stubClient({ factors: [verified("f-1"), verified("f-2")], rejects: { "f-1": limited } })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "failed", message: "Too many attempts. Wait a minute and try again." })
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledTimes(1)
  })

  it("does not ask the Auth server about a text that is not six digits", async () => {
    const auth = stubClient({ factors: [verified("f-1")] })
    const { verifySecondStep } = await client()
    for (const code of ["", "12345", "1234567", "12345a", "123 456", " 123456"]) {
      expect(await verifySecondStep(code)).toEqual({ status: "failed", message: "That code is wrong or has expired. Check your app for the one it shows now." })
    }
    expect(auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
    expect(auth.mfa.listFactors).not.toHaveBeenCalled()
  })

  it("tells what went wrong when the factors cannot be listed, or the network is down", async () => {
    stubClient({ listError: limited })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "failed", message: "Too many attempts. Wait a minute and try again." })
    stubClient({ throws: new AuthRetryableFetchError("Failed to fetch", 0) })
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "failed", message: "We could not reach the server. Check your connection and try again." })
  })

  it("says it is not available when the hub has no Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).verifySecondStep("123456")).toEqual({ status: "failed", message: "Sign-in is not available here." })
    expect(createBrowserClient).not.toHaveBeenCalled()
  })
})

describe("beginSecondStepSetup", () => {
  it("makes a factor under the site's name and gives the window its QR code, encoded, and its key", async () => {
    const auth = stubClient()
    const outcome = await (await client()).beginSecondStepSetup("Play Board Games Online")
    expect(auth.mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", issuer: "Play Board Games Online", friendlyName: "Authenticator app" })
    expect(outcome).toEqual({
      status: "ready",
      setup: { factorId: "f-new", qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'/>")}`, secret: "ABCDEFGHIJKLMNOP" },
    })
  })

  it("takes away a set-up that was abandoned before making another: the Auth server keeps it, with the name this one needs", async () => {
    const auth = stubClient({ factors: [{ ...verified("f-old"), status: "unverified" }] })
    await (await client()).beginSecondStepSetup("Play Board Games Online")
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "f-old" })
    expect(auth.mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(auth.mfa.enroll.mock.invocationCallOrder[0])
  })

  it("makes nothing when the member has the second step already", async () => {
    const auth = stubClient({ factors: [verified("f-1")] })
    expect(await (await client()).beginSecondStepSetup("Play Board Games Online")).toEqual({ status: "failed", message: "Multi-factor authentication is already on." })
    expect(auth.mfa.enroll).not.toHaveBeenCalled()
    expect(auth.mfa.unenroll).not.toHaveBeenCalled()
  })

  it("asks nothing of the account when nobody is signed in (a guest, the demo account)", async () => {
    const auth = stubClient({ session: null })
    expect(await (await client()).beginSecondStepSetup("Play Board Games Online")).toEqual({ status: "no-session" })
    expect(auth.mfa.enroll).not.toHaveBeenCalled()
  })

  it("tells a project that has app authenticators off, in its own words", async () => {
    stubClient({ enrollError: new AuthApiError("Enrollment of MFA TOTP factors is disabled", 422, "mfa_totp_enroll_not_enabled") })
    expect(await (await client()).beginSecondStepSetup("Play Board Games Online")).toEqual({ status: "failed", message: "Multi-factor authentication is not available right now." })
  })

  it("tells a network that is down as an outcome and not as an exception, and a project that is not set", async () => {
    stubClient({ throws: new AuthRetryableFetchError("Failed to fetch", 0) })
    expect(await (await client()).beginSecondStepSetup("x")).toEqual({ status: "failed", message: "We could not reach the server. Check your connection and try again." })
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).beginSecondStepSetup("x")).toEqual({ status: "failed", message: "This is not available here." })
  })

  it("draws no QR code when the Auth server gives none that can be drawn: the key is still there", async () => {
    const auth = stubClient()
    auth.mfa.enroll.mockResolvedValueOnce({ data: { id: "f-new", type: "totp", totp: { qr_code: "https://elsewhere.example/qr.png", secret: "ABCDEFGH", uri: "" } }, error: null })
    expect(await (await client()).beginSecondStepSetup("x")).toEqual({ status: "ready", setup: { factorId: "f-new", qr: null, secret: "ABCDEFGH" } })
  })
})

describe("finishSecondStepSetup", () => {
  it("proves the factor with the first code of the app", async () => {
    const auth = stubClient()
    expect(await (await client()).finishSecondStepSetup("f-new", "123456")).toEqual({ status: "done" })
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-new", code: "123456" })
  })

  it("tells a wrong code, and keeps the factor for another try", async () => {
    const auth = stubClient({ rejects: { "f-new": wrong } })
    expect(await (await client()).finishSecondStepSetup("f-new", "123456")).toEqual({ status: "failed", message: "That code is wrong or has expired. Check your app for the one it shows now." })
    expect(auth.mfa.unenroll).not.toHaveBeenCalled()
  })

  it("does not ask the Auth server about a text that is not six digits, nor when nobody is signed in", async () => {
    const auth = stubClient()
    const { finishSecondStepSetup } = await client()
    expect((await finishSecondStepSetup("f-new", "12345")).status).toBe("failed")
    expect(auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
    stubClient({ session: null })
    expect(await (await client()).finishSecondStepSetup("f-new", "123456")).toEqual({ status: "no-session" })
  })
})

describe("cancelSecondStepSetup", () => {
  it("takes the factor that was made away, and says nothing when it cannot: the Auth server drops it by itself", async () => {
    const auth = stubClient()
    await (await client()).cancelSecondStepSetup("f-new")
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "f-new" })
    stubClient({ throws: new AuthRetryableFetchError("Failed to fetch", 0) })
    await expect((await client()).cancelSecondStepSetup("f-new")).resolves.toBeUndefined()
  })
})

describe("removeSecondStep", () => {
  const through = { access_token: token("aal2"), user: { id: "u-1" } }

  it("checks the code first, then takes every authenticator app of the member away, and renews the session", async () => {
    const auth = stubClient({ session: through, factors: [verified("f-1"), verified("f-2")] })
    expect(await (await client()).removeSecondStep("123456")).toEqual({ status: "done" })
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-1", code: "123456" })
    expect(auth.mfa.unenroll.mock.calls.map(([params]) => params.factorId)).toEqual(["f-1", "f-2"])
    expect(auth.mfa.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(auth.mfa.unenroll.mock.invocationCallOrder[0])
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
  })

  it("takes nothing away on a wrong code", async () => {
    const auth = stubClient({ session: through, factors: [verified("f-1")], rejects: { "f-1": wrong } })
    expect(await (await client()).removeSecondStep("123456")).toEqual({ status: "failed", message: "That code is wrong or has expired. Check your app for the one it shows now." })
    expect(auth.mfa.unenroll).not.toHaveBeenCalled()
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it("stops at the first app the Auth server refuses to remove, and says so", async () => {
    const auth = stubClient({ session: through, factors: [verified("f-1"), verified("f-2")], unenrollError: new AuthApiError("AAL2 required to unenroll verified factor", 422, "insufficient_aal") })
    expect(await (await client()).removeSecondStep("123456")).toEqual({ status: "failed", message: "For your security, sign in again and enter your code, then try once more." })
    expect(auth.mfa.unenroll).toHaveBeenCalledTimes(1)
  })

  it("is done even when the renewal of the session fails: the session is good, and renews within the hour", async () => {
    stubClient({ session: through, factors: [verified("f-1")], refreshThrows: true })
    expect(await (await client()).removeSecondStep("123456")).toEqual({ status: "done" })
  })

  it("does not ask the Auth server about a text that is not six digits, nor when nobody is signed in", async () => {
    const auth = stubClient({ session: through, factors: [verified("f-1")] })
    expect((await (await client()).removeSecondStep("abcdef")).status).toBe("failed")
    expect(auth.mfa.listFactors).not.toHaveBeenCalled()
    stubClient({ session: null })
    expect(await (await client()).removeSecondStep("123456")).toEqual({ status: "no-session" })
  })
})
