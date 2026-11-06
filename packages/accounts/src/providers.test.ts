import { afterEach, describe, expect, it, vi } from "vitest"
import { enabledProviders, providersOn } from "./providers"

const config = { url: "https://abc.supabase.co", key: "sb_publishable_key" }

/** A fetch that answers with `body`, and remembers how it was asked. */
function answering(body: unknown, init: ResponseInit = { status: 200 }) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), init))
}

afterEach(() => vi.unstubAllEnvs())

describe("providersOn", () => {
  it("lists the providers the settings switch on, in the order of the buttons", () => {
    const settings = { external: { discord: true, email: true, google: true, twitch: true } }
    expect(providersOn(settings)).toEqual(["google", "twitch", "discord"])
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
