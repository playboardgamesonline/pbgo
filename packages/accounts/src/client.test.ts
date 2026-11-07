import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The browser's Supabase client is a stub: what is under test is what this module asks of it, and what it does with the answer
const { createBrowserClient } = vi.hoisted(() => ({ createBrowserClient: vi.fn() }))
vi.mock("@supabase/ssr", () => ({ createBrowserClient }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// Whether a change of language is on its way is the setter's to say: here it is a switch
const flags = vi.hoisted(() => ({ changing: false }))
vi.mock("./set-language", async (importOriginal) => ({ ...(await importOriginal<typeof import("./set-language")>()), isChangingLanguage: () => flags.changing }))

const session = { access_token: "token", user: { id: "u-1" } }

type Stub = {
  session?: unknown
  updateError?: unknown
  signIn?: { data: { user: unknown }; error: unknown }
  /** What the Auth server answers when it is asked for the user. */
  fresh?: unknown
  refreshError?: unknown
  /** The error the Auth server answers a sign-up, a code or a new code with. */
  signUpError?: unknown
  verifyError?: unknown
  resendError?: unknown
  /** What the sign-up calls throw instead of answering. */
  throws?: unknown
}

/** A client that answers like Supabase Auth would; `auth` records the calls. */
function stubClient({
  session: current = session,
  updateError = null,
  signIn = { data: { user: null }, error: null },
  fresh = null,
  refreshError = null,
  signUpError = null,
  verifyError = null,
  resendError = null,
  throws,
}: Stub = {}) {
  const answer = async <T>(value: T): Promise<T> => {
    if (throws !== undefined) throw throws
    return value
  }
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current } })),
    getUser: vi.fn(async () => ({ data: { user: fresh } })),
    refreshSession: vi.fn(async () => ({ data: {}, error: refreshError })),
    updateUser: vi.fn(async () => ({ data: {}, error: updateError })),
    signInWithPassword: vi.fn(async () => signIn),
    signUp: vi.fn((_credentials: unknown) => answer({ data: { user: { id: "u-new" }, session: null }, error: signUpError })),
    verifyOtp: vi.fn((_params: unknown) => answer({ data: { user: { id: "u-new" }, session: { access_token: "token" } }, error: verifyError })),
    resend: vi.fn((_params: unknown) => answer({ data: {}, error: resendError })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  createBrowserClient.mockReturnValue({ auth })
  return auth
}

/** A fresh copy of the module: it keeps the client it made in a variable of its own. */
async function client() {
  vi.resetModules()
  return import("./client")
}

const cookieWrites: string[] = []

beforeEach(() => {
  createBrowserClient.mockReset()
  flags.changing = false
  cookieWrites.length = 0
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdef.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  vi.stubGlobal("document", {
    get cookie() {
      return ""
    },
    set cookie(line: string) {
      cookieWrites.push(line)
    },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("saveLanguage", () => {
  it("merges the language into the account's metadata under the key that is ours, and nothing else", async () => {
    const auth = stubClient()
    const { saveLanguage } = await client()
    expect(await saveLanguage("fr")).toBe("saved")
    expect(auth.updateUser).toHaveBeenCalledTimes(1)
    // `data` is what Supabase Auth merges, key by key, into `user_metadata`: the name and the picture of the provider are not in it, so they are not touched
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { pbgo_locale: "fr" } })
  })

  it("keeps nothing when nobody is signed in, and does not ask the account", async () => {
    const auth = stubClient({ session: null })
    const { saveLanguage } = await client()
    expect(await saveLanguage("fr")).toBe("no-session")
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("keeps nothing when the hub has no Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    const { saveLanguage } = await client()
    expect(await saveLanguage("fr")).toBe("no-session")
    expect(createBrowserClient).not.toHaveBeenCalled()
  })

  it("says so when the account could not be written", async () => {
    stubClient({ updateError: { message: "boom" } })
    const { saveLanguage } = await client()
    expect(await saveLanguage("fr")).toBe("failed")
  })
})

describe("signInWithPassword", () => {
  const signedIn = (metadata: Record<string, unknown>) => ({ data: { user: { id: "u-1", user_metadata: metadata } }, error: null })

  it("puts the language of the account in the cookie of this device, so that the first page it opens is drawn in it", async () => {
    stubClient({ signIn: signedIn({ full_name: "Oré", pbgo_locale: "ja" }) })
    const { signInWithPassword } = await client()
    expect(await signInWithPassword("ore@example.com", "secret")).toBeNull()
    expect(cookieWrites).toEqual(["pbgo-locale=ja; path=/; max-age=31536000; samesite=lax"])
  })

  it("leaves the cookie as it is when the account keeps no language yet (the sync claims one once the page is there)", async () => {
    stubClient({ signIn: signedIn({ full_name: "Oré", locale: "fr" }) })
    const { signInWithPassword } = await client()
    expect(await signInWithPassword("ore@example.com", "secret")).toBeNull()
    expect(cookieWrites).toEqual([])
  })

  it("writes no cookie when the sign-in fails", async () => {
    stubClient({ signIn: { data: { user: null }, error: { code: "invalid_credentials" } } })
    const { signInWithPassword } = await client()
    expect(await signInWithPassword("ore@example.com", "wrong")).toBe("That e-mail and that password do not go together.")
    expect(cookieWrites).toEqual([])
  })

  it("does not ask Supabase for a username it cannot look up", async () => {
    const auth = stubClient()
    const { signInWithPassword } = await client()
    expect(await signInWithPassword("ore", "secret")).toBe("Use your e-mail address for now: usernames are coming.")
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("tells an account that was made and never confirmed to use its code, which only someone who knows its password hears", async () => {
    stubClient({ signIn: { data: { user: null }, error: { code: "email_not_confirmed" } } })
    const { signInWithPassword } = await client()
    expect(await signInWithPassword("ore@example.com", "right password")).toBe("Your e-mail address is not confirmed yet. Use the code we sent you, or create the account again to get a new one.")
    expect(cookieWrites).toEqual([])
  })
})

describe("signUpWithPassword", () => {
  const entry = { email: "ana@example.com", password: "correct horse", name: "Ana", next: "/game/courtisans" }

  beforeEach(() => {
    // The address the e-mail's link leads back to is this site's
    vi.stubGlobal("window", { location: { origin: "https://pbgo.test" } })
  })

  it("asks Supabase Auth to create the account, with the display name under the key the nickname is read from and the page to come back to", async () => {
    const auth = stubClient()
    const { signUpWithPassword } = await client()
    expect(await signUpWithPassword(entry)).toEqual({ sent: true })
    expect(auth.signUp).toHaveBeenCalledTimes(1)
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "correct horse",
      options: { data: { full_name: "Ana" }, emailRedirectTo: "https://pbgo.test/game/courtisans", captchaToken: undefined },
    })
  })

  it("sends no metadata when no display name was given", async () => {
    const auth = stubClient()
    const { signUpWithPassword } = await client()
    await signUpWithPassword({ ...entry, name: null })
    expect(auth.signUp.mock.calls[0]?.[0]).toMatchObject({ options: { data: undefined } })
  })

  it("passes on the answer to a CAPTCHA when there is one, which is how a project that asks for one is served", async () => {
    const auth = stubClient()
    const { signUpWithPassword } = await client()
    await signUpWithPassword({ ...entry, captchaToken: "captcha-answer" })
    expect(auth.signUp.mock.calls[0]?.[0]).toMatchObject({ options: { captchaToken: "captcha-answer" } })
  })

  it("only gives Supabase Auth a page of this site to lead back to", async () => {
    const auth = stubClient()
    const { signUpWithPassword } = await client()
    await signUpWithPassword({ ...entry, next: "https://evil.example/phish" })
    expect(auth.signUp.mock.calls[0]?.[0]).toMatchObject({ options: { emailRedirectTo: "https://pbgo.test/me" } })
    await signUpWithPassword({ ...entry, next: "/signup" })
    expect(auth.signUp.mock.calls[1]?.[0]).toMatchObject({ options: { emailRedirectTo: "https://pbgo.test/me" } })
  })

  it("signs nobody in and writes no cookie: the account waits for its code", async () => {
    stubClient()
    const { signUpWithPassword } = await client()
    await signUpWithPassword(entry)
    expect(cookieWrites).toEqual([])
  })

  it("answers an address that already has an account like a new one, so that nothing tells which addresses are taken", async () => {
    // Supabase Auth answers a repeated sign-up with an obfuscated user and no error (and sends nothing); a project that auto-confirms answers this error
    stubClient({ signUpError: null })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: true })
    stubClient({ signUpError: new AuthApiError("User already registered", 422, "user_already_exists") })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: true })
  })

  it("says calmly, and not what Supabase says, when the e-mail cannot go out", async () => {
    stubClient({ signUpError: new AuthApiError("Email sending is not allowed for this address as your project is using the default SMTP service", 400, "email_address_not_authorized") })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: false, message: "We could not send the e-mail. Try again in a few minutes." })
    stubClient({ signUpError: new AuthApiError("email rate limit exceeded", 429, "over_email_send_rate_limit") })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: false, message: "Too many attempts. Wait a few minutes and try again." })
  })

  it("puts a password the project refuses on the password", async () => {
    stubClient({ signUpError: new AuthWeakPasswordError("Password is known to be weak", 422, ["pwned"]) })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: false, message: "That password is known from data breaches. Choose another one.", field: "password" })
  })

  it("does not throw when the call does", async () => {
    stubClient({ throws: new TypeError("Failed to fetch") })
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: false, message: "Sign-up did not work. Try again." })
  })

  it("does nothing without a Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).signUpWithPassword(entry)).toEqual({ sent: false, message: "Sign-up is not available here." })
    expect(createBrowserClient).not.toHaveBeenCalled()
  })
})

describe("verifySignupCode", () => {
  it("spends the code of the e-mail, with the address it was sent to and the type the documentation gives for a sign-up's code, and signs the visitor in", async () => {
    const auth = stubClient()
    const { verifySignupCode } = await client()
    expect(await verifySignupCode("ana@example.com", "123456")).toBeNull()
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "ana@example.com", token: "123456", type: "email" })
  })

  it("says a code is wrong or expired, which is all Supabase Auth knows of it", async () => {
    stubClient({ verifyError: new AuthApiError("Token has expired or is invalid", 403, "otp_expired") })
    expect(await (await client()).verifySignupCode("ana@example.com", "000000")).toBe("That code is wrong or has expired. Check it, or ask for a new one.")
  })

  it("says when there were too many tries, and does not throw when the call does", async () => {
    stubClient({ verifyError: new AuthApiError("rate limit", 429, "over_request_rate_limit") })
    expect(await (await client()).verifySignupCode("ana@example.com", "000000")).toBe("Too many attempts. Wait a few minutes and try again.")
    stubClient({ throws: new TypeError("Failed to fetch") })
    expect(await (await client()).verifySignupCode("ana@example.com", "000000")).toBe("That code did not work. Try again.")
  })

  it("does nothing without a Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).verifySignupCode("ana@example.com", "123456")).toBe("Sign-up is not available here.")
    expect(createBrowserClient).not.toHaveBeenCalled()
  })
})

describe("resendSignupCode", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "https://pbgo.test" } })
  })

  it("asks for another confirmation e-mail for the address, with the same way back", async () => {
    const auth = stubClient()
    const { resendSignupCode } = await client()
    expect(await resendSignupCode("ana@example.com", "/games")).toEqual({ status: "sent" })
    expect(auth.resend).toHaveBeenCalledTimes(1)
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "ana@example.com", options: { emailRedirectTo: "https://pbgo.test/games", captchaToken: undefined } })
  })

  it("passes on the answer to a CAPTCHA when there is one", async () => {
    const auth = stubClient()
    await (await client()).resendSignupCode("ana@example.com", "/games", "captcha-answer")
    expect(auth.resend.mock.calls[0]?.[0]).toMatchObject({ options: { captchaToken: "captcha-answer" } })
  })

  it("makes the visitor wait when an e-mail went out a minute ago", async () => {
    stubClient({ resendError: new AuthApiError("For security purposes, you can only request this after 30 seconds.", 429, "over_email_send_rate_limit") })
    expect(await (await client()).resendSignupCode("ana@example.com", "/games")).toEqual({ status: "wait", message: "Wait a minute before asking for another code." })
  })

  it("lets the visitor try again at once when it failed for another reason, even if the call threw", async () => {
    stubClient({ resendError: new AuthRetryableFetchError("Failed to fetch", 0) })
    expect(await (await client()).resendSignupCode("ana@example.com", "/games")).toEqual({ status: "failed", message: "We could not reach the server. Check your connection and try again." })
    stubClient({ throws: new Error("boom") })
    expect(await (await client()).resendSignupCode("ana@example.com", "/games")).toEqual({ status: "failed", message: "We could not send a new code. Try again." })
  })

  it("does nothing without a Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).resendSignupCode("ana@example.com", "/games")).toEqual({ status: "failed", message: "Sign-up is not available here." })
    expect(createBrowserClient).not.toHaveBeenCalled()
  })
})

describe("renewIfLanguageChanged", () => {
  const user = (language?: string) => ({ id: "u-1", user_metadata: language ? { full_name: "Oré", pbgo_locale: language } : { full_name: "Oré" } })
  const held = (language?: string) => ({ access_token: "token", user: user(language) })

  it("renews the session when the account holds another language than the session does: a change made on another device", async () => {
    const auth = stubClient({ fresh: user("ja"), session: held("fr") })
    const { renewIfLanguageChanged } = await client()
    expect(await renewIfLanguageChanged()).toBe(true)
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
  })

  it("renews it when the account has lost its language, or got one, that the session does not hold", async () => {
    const lost = stubClient({ fresh: user(), session: held("fr") })
    expect(await (await client()).renewIfLanguageChanged()).toBe(true)
    expect(lost.refreshSession).toHaveBeenCalledTimes(1)
    const got = stubClient({ fresh: user("de"), session: held() })
    expect(await (await client()).renewIfLanguageChanged()).toBe(true)
    expect(got.refreshSession).toHaveBeenCalledTimes(1)
  })

  it("does nothing when the account and the session agree, which is nearly always: one request, no renewal", async () => {
    for (const language of ["ja", undefined]) {
      const auth = stubClient({ fresh: user(language), session: held(language) })
      expect(await (await client()).renewIfLanguageChanged()).toBe(false)
      expect(auth.getUser).toHaveBeenCalledTimes(1)
      expect(auth.refreshSession).not.toHaveBeenCalled()
    }
  })

  it("does nothing when the Auth server does not answer with a user, or nobody is signed in", async () => {
    const offline = stubClient({ fresh: null, session: held("fr") })
    expect(await (await client()).renewIfLanguageChanged()).toBe(false)
    expect(offline.refreshSession).not.toHaveBeenCalled()
    const nobody = stubClient({ fresh: user("ja"), session: null })
    expect(await (await client()).renewIfLanguageChanged()).toBe(false)
    expect(nobody.refreshSession).not.toHaveBeenCalled()
  })

  it("waits while a change of language is on its way: the account is being written, the session is not behind", async () => {
    const auth = stubClient({ fresh: user("ja"), session: held("fr") })
    flags.changing = true
    expect(await (await client()).renewIfLanguageChanged()).toBe(false)
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it("says so when the session could not be renewed", async () => {
    stubClient({ fresh: user("ja"), session: held("fr"), refreshError: { message: "boom" } })
    expect(await (await client()).renewIfLanguageChanged()).toBe(false)
  })

  it("does nothing without a Supabase project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    expect(await (await client()).renewIfLanguageChanged()).toBe(false)
    expect(createBrowserClient).not.toHaveBeenCalled()
  })
})
