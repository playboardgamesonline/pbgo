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
}

/** A client that answers like Supabase Auth would; `auth` records the calls. */
function stubClient({ session: current = session, updateError = null, signIn = { data: { user: null }, error: null }, fresh = null, refreshError = null }: Stub = {}) {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current } })),
    getUser: vi.fn(async () => ({ data: { user: fresh } })),
    refreshSession: vi.fn(async () => ({ data: {}, error: refreshError })),
    updateUser: vi.fn(async () => ({ data: {}, error: updateError })),
    signInWithPassword: vi.fn(async () => signIn),
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
