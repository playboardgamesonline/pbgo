import { afterEach, describe, expect, it, vi } from "vitest"
import { enabledProviders, externalProvidersOn, providersOn, signInProviders } from "./providers"

const config = { url: "https://abc.supabase.co", key: "sb_publishable_key" }

/** A fetch that answers with `body`, and remembers how it was asked. */
function answering(body: unknown, init: ResponseInit = { status: 200 }) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), init))
}

afterEach(() => vi.unstubAllEnvs())

describe("providersOn", () => {
  it("lists the providers the settings switch on, in the order of the buttons", () => {
    const settings = { external: { discord: true, email: true, google: true, twitch: true } }
    expect(providersOn(settings)).toEqual(["google", "discord", "twitch"])
  })

  it("leaves out the providers that are not ours, and every value that is not true", () => {
    expect(providersOn({ external: { apple: true, facebook: true, github: true, google: "true", twitch: 1, discord: true } })).toEqual(["discord"])
  })

  it("gives none for anything that is not the settings of a project", () => {
    for (const settings of [null, undefined, "settings", 3, [], {}, { external: null }, { external: "all" }, { external: [] }]) {
      expect(providersOn(settings)).toEqual([])
    }
  })
})

describe("enabledProviders", () => {
  it("asks the Auth of the project for its settings, with its publishable key", async () => {
    const fetcher = answering({ external: { discord: true } })
    await expect(enabledProviders(config, fetcher)).resolves.toEqual(["discord"])
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe("https://abc.supabase.co/auth/v1/settings")
    expect(init?.headers).toEqual({ apikey: "sb_publishable_key" })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it("does not keep the answer in development, where a provider has just been switched on", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const fetcher = answering({ external: {} })
    await enabledProviders(config, fetcher)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" })
  })

  it("keeps the answer five minutes in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const fetcher = answering({ external: {} })
    await enabledProviders(config, fetcher)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ next: { revalidate: 300 } })
  })

  it("gives none when the project is not set, without asking anyone", async () => {
    const fetcher = answering({ external: { discord: true } })
    await expect(enabledProviders(null, fetcher)).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("gives none when the project refuses, does not answer or answers nonsense", async () => {
    await expect(enabledProviders(config, answering({ msg: "no" }, { status: 401 }))).resolves.toEqual([])
    await expect(
      enabledProviders(
        config,
        vi.fn(async () => {
          throw new Error("down")
        }),
      ),
    ).resolves.toEqual([])
    await expect(enabledProviders(config, vi.fn(async () => new Response("<html>", { status: 200 })))).resolves.toEqual([])
  })
})

const steamEnv = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_key", SUPABASE_SECRET_KEY: "sb_secret_key", STEAM_WEB_API_KEY: "KEY" }

describe("externalProvidersOn", () => {
  it("offers Steam when the project, its two keys and Steam's own key are all set", () => {
    expect(externalProvidersOn(steamEnv)).toEqual(["steam"])
    expect(externalProvidersOn({ ...steamEnv, SUPABASE_SECRET_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: "legacy" })).toEqual(["steam"])
  })

  it("offers nothing as soon as one is missing or blank: a button that cannot sign anyone in is worse than none", () => {
    for (const missing of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "STEAM_WEB_API_KEY"] as const) {
      expect(externalProvidersOn({ ...steamEnv, [missing]: undefined }), missing).toEqual([])
      expect(externalProvidersOn({ ...steamEnv, [missing]: "  " }), missing).toEqual([])
    }
    expect(externalProvidersOn({})).toEqual([])
  })
})

describe("signInProviders", () => {
  const settings = { external: { google: true, discord: true, twitch: true, email: true } }

  it("is the providers of the sign-in that are on, in the order of the buttons, with Twitch left out and Steam after them", async () => {
    await expect(signInProviders(config, steamEnv, answering(settings))).resolves.toEqual(["google", "discord", "steam"])
  })

  it("leaves Steam out until the server is set up for it, and a provider out until the project has it on", async () => {
    await expect(signInProviders(config, {}, answering(settings))).resolves.toEqual(["google", "discord"])
    await expect(signInProviders(config, steamEnv, answering({ external: { discord: true, twitch: true } }))).resolves.toEqual(["discord", "steam"])
  })

  it("is empty when Twitch is the only one on, since it is only linked", async () => {
    await expect(signInProviders(config, {}, answering({ external: { twitch: true } }))).resolves.toEqual([])
  })

  it("is empty when the project is not set, Steam included, since nobody could be made a member", async () => {
    const fetcher = answering(settings)
    await expect(signInProviders(null, steamEnv, fetcher)).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })
})
