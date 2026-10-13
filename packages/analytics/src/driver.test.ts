import type { PostHog } from "posthog-js"
import { describe, expect, it, vi } from "vitest"
import { resolveConfig } from "./config"
import { makeConsent } from "./consent"
import { createDriver, type DriverEnv } from "./driver"

const config = resolveConfig({ key: "phc_abc123", host: "https://eu.i.posthog.com", appEnv: "preview" })!
const accepted = makeConsent("accepted")
const refused = makeConsent("refused")

const ACCEPT = `set_config {"persistence":"localStorage+cookie","disable_session_recording":false}`
const WITHDRAW = [`set_config {"disable_session_recording":true}`, `set_config {"persistence":"memory"}`, "reset true", "forget"]

/** Lets every promise the driver is waiting on settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** A page, a deferred SDK and the order in which the SDK and the page were asked to do things. */
function setup(overrides: Partial<DriverEnv> = {}) {
  const calls: string[] = []
  const sdk = {
    init: vi.fn((_key: string, options: { persistence?: string; disable_session_recording?: boolean }) => {
      calls.push(`init ${options.persistence} recording=${!options.disable_session_recording}`)
    }),
    capture: vi.fn<(event: string, properties?: object | null, options?: object) => void>((event) => {
      calls.push(`capture ${event}`)
    }),
    identify: vi.fn((id: string) => {
      calls.push(`identify ${id}`)
    }),
    set_config: vi.fn((patch: object) => {
      calls.push(`set_config ${JSON.stringify(patch)}`)
    }),
    reset: vi.fn((hard?: boolean) => {
      calls.push(`reset ${hard}`)
    }),
  }
  let release!: () => void
  let fail!: (error: unknown) => void
  const loaded = new Promise<PostHog>((resolve, reject) => {
    release = () => resolve(sdk as unknown as PostHog)
    fail = reject
  })
  const load = vi.fn(() => loaded)
  const warn = vi.fn()
  const env: DriverEnv = {
    config,
    pathname: () => "/hanabi/game/ABC123",
    load,
    forget: () => void calls.push("forget"),
    warn,
    ...overrides,
  }
  /** The SDK is ready, and what it did to get there is forgotten. */
  const ready = async () => {
    release()
    await flush()
    calls.length = 0
    sdk.init.mockClear()
  }
  return { driver: createDriver(env), sdk, calls, load, warn, release, fail, ready }
}

describe("createDriver", () => {
  describe("where it does nothing", () => {
    it("without a configuration", async () => {
      const { driver, load, sdk } = setup({ config: null })
      driver.sync(accepted)
      driver.track("rules_opened", { game: "hanabi" })
      driver.identify("p1")
      await flush()
      expect(load).not.toHaveBeenCalled()
      expect(sdk.init).not.toHaveBeenCalled()
    })

    it.each(["/gamemaster", "/gamemaster/hanabi/setup/identity", "/hanabi/preview/game", "/gamemaster/hanabi/preview/home"])(
      "on %s, the gamemaster and its previews",
      async (path) => {
        const { driver, load } = setup({ pathname: () => path })
        driver.sync(accepted)
        driver.track("rules_opened", { game: "hanabi" })
        await flush()
        expect(load).not.toHaveBeenCalled()
      },
    )

    it("on the server", async () => {
      const { driver, load } = setup({ pathname: () => null })
      driver.sync(accepted)
      await flush()
      expect(load).not.toHaveBeenCalled()
    })
  })

  describe("the first answer", () => {
    it("starts the SDK in memory, without recording, for a visitor who has not answered", async () => {
      const { driver, calls, release } = setup()
      driver.sync(null)
      release()
      await flush()
      expect(calls).toEqual(["init memory recording=false", "forget"])
    })

    it("starts it in memory too for a visitor who refused", async () => {
      const { driver, calls, release } = setup()
      driver.sync(refused)
      release()
      await flush()
      expect(calls).toEqual(["init memory recording=false", "forget"])
    })

    it("starts it on its persistent storage, recording, for a visitor who accepted, and sweeps nothing", async () => {
      const { driver, calls, release } = setup()
      driver.sync(accepted)
      release()
      await flush()
      expect(calls).toEqual(["init localStorage+cookie recording=true"])
    })

    it("hands it the key of the project", async () => {
      const { driver, sdk, release } = setup()
      driver.sync(null)
      release()
      await flush()
      expect(sdk.init).toHaveBeenCalledWith("phc_abc123", expect.objectContaining({ api_host: "/ingest" }))
    })

    it("lets the answer given while the SDK loads decide how it starts", async () => {
      const toAccepted = setup()
      toAccepted.driver.sync(null)
      toAccepted.driver.sync(accepted)
      toAccepted.release()
      await flush()
      expect(toAccepted.calls).toEqual(["init localStorage+cookie recording=true"])

      const toRefused = setup()
      toRefused.driver.sync(accepted)
      toRefused.driver.sync(refused)
      toRefused.release()
      await flush()
      expect(toRefused.calls).toEqual(["init memory recording=false", "forget"])
    })

    it("loads the SDK once, however many times it is told", async () => {
      const { driver, load, sdk, release } = setup()
      driver.sync(null)
      driver.sync(null)
      driver.sync(refused)
      release()
      await flush()
      driver.sync(refused)
      expect(load).toHaveBeenCalledTimes(1)
      expect(sdk.init).toHaveBeenCalledTimes(1)
    })
  })

  describe("a later answer", () => {
    it("switches to the persistent storage and starts recording when the visitor accepts", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(null)
      await ready()
      driver.sync(accepted)
      expect(calls).toEqual([ACCEPT])
    })

    it("does not repeat itself when told the same answer again", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(null)
      await ready()
      driver.sync(accepted)
      driver.sync(accepted)
      driver.sync(makeConsent("accepted", new Date(Date.now() + 1000)))
      expect(calls).toEqual([ACCEPT])
    })

    it("stops recording, goes back to memory, starts over and sweeps, in that order, when the visitor withdraws", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.sync(refused)
      expect(calls).toEqual(WITHDRAW)
    })

    it("treats an answer that expired like a withdrawal", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.sync(null)
      expect(calls).toEqual(WITHDRAW)
    })

    it("has nothing to undo when a visitor who never accepted refuses", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(null)
      await ready()
      driver.sync(refused)
      expect(calls).toEqual([])
    })

    it("accepts again after a withdrawal", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.sync(refused)
      calls.length = 0
      driver.sync(accepted)
      expect(calls).toEqual([ACCEPT])
    })
  })

  describe("track", () => {
    it("keeps what is asked for while the SDK loads and sends it, in order, once it is ready", async () => {
      const { driver, calls, release } = setup()
      driver.sync(null)
      driver.track("rules_opened", { game: "hanabi" })
      driver.track("invite_link_copied", { game: "hanabi" })
      expect(calls).toEqual([])
      release()
      await flush()
      expect(calls).toEqual(["init memory recording=false", "forget", "capture rules_opened", "capture invite_link_copied"])
    })

    it("sends at once when the SDK is ready", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(null)
      await ready()
      driver.track("language_changed", { from: "fr", to: "en" })
      expect(sdk.capture).toHaveBeenCalledWith("language_changed", { from: "fr", to: "en" }, undefined)
    })

    it("skips the batch when the page is about to go away", async () => {
      const { driver, sdk, ready } = setup({ pathname: () => "/" })
      driver.sync(null)
      await ready()
      driver.track("game_opened_from_hub", { game: "hanabi" }, { instant: true })
      expect(sdk.capture).toHaveBeenCalledWith("game_opened_from_hub", { game: "hanabi" }, { send_instantly: true })
    })

    it("keeps at most twenty waiting events", async () => {
      const { driver, sdk, release } = setup()
      driver.sync(null)
      for (let i = 0; i < 30; i++) driver.track("rules_opened", { game: "hanabi" })
      release()
      await flush()
      expect(sdk.capture).toHaveBeenCalledTimes(20)
    })

    it("sends what was asked for before the visitor answered, whatever the answer", async () => {
      const { driver, sdk, release } = setup()
      driver.track("rules_opened", { game: "hanabi" })
      driver.sync(refused)
      release()
      await flush()
      expect(sdk.capture).toHaveBeenCalledTimes(1)
    })
  })

  describe("identify", () => {
    it("waits for the visitor to accept", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(null)
      await ready()
      driver.identify("p1")
      expect(sdk.identify).not.toHaveBeenCalled()
      driver.sync(accepted)
      expect(sdk.identify).toHaveBeenCalledWith("p1")
    })

    it("identifies at once when the visitor already accepted", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.identify("p1")
      expect(sdk.identify).toHaveBeenCalledTimes(1)
      expect(sdk.identify).toHaveBeenCalledWith("p1")
    })

    it("holds the player until the SDK is ready", async () => {
      const { driver, calls, release } = setup()
      driver.identify("p1")
      driver.sync(accepted)
      expect(calls).toEqual([])
      release()
      await flush()
      expect(calls).toEqual(["init localStorage+cookie recording=true", "identify p1"])
    })

    it("identifies after the switch to the persistent storage, not before", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(null)
      driver.identify("p1")
      await ready()
      driver.sync(accepted)
      expect(calls).toEqual([ACCEPT, "identify p1"])
    })

    it("does not identify the same player twice", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.identify("p1")
      driver.identify("p1")
      driver.sync(accepted)
      expect(sdk.identify).toHaveBeenCalledTimes(1)
    })

    it("identifies the player of the next table", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.identify("p1")
      driver.identify("p2")
      expect(sdk.identify.mock.calls).toEqual([["p1"], ["p2"]])
    })

    it("never identifies a visitor who refused", async () => {
      const { driver, sdk, ready } = setup()
      driver.sync(refused)
      await ready()
      driver.identify("p1")
      expect(sdk.identify).not.toHaveBeenCalled()
    })

    it("identifies again after a withdrawal and a new acceptance", async () => {
      const { driver, calls, ready } = setup()
      driver.sync(accepted)
      await ready()
      driver.identify("p1")
      driver.sync(refused)
      calls.length = 0
      driver.sync(accepted)
      expect(calls).toEqual([ACCEPT, "identify p1"])
    })
  })

  describe("when the SDK misbehaves", () => {
    it("warns once and stays quiet when it cannot load", async () => {
      const { driver, calls, warn, fail } = setup()
      driver.sync(accepted)
      driver.sync(accepted)
      driver.track("rules_opened", { game: "hanabi" })
      fail(new Error("blocked"))
      await flush()
      driver.track("rules_opened", { game: "hanabi" })
      driver.identify("p1")
      driver.sync(refused)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(calls).toEqual([])
    })

    it("warns and stays quiet when it cannot start", async () => {
      const { driver, sdk, warn, release } = setup()
      sdk.init.mockImplementation(() => {
        throw new Error("bad options")
      })
      driver.sync(accepted)
      driver.track("rules_opened", { game: "hanabi" })
      release()
      await flush()
      driver.track("rules_opened", { game: "hanabi" })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(sdk.capture).not.toHaveBeenCalled()
    })

    it("warns and goes on when an event cannot be captured", async () => {
      const { driver, sdk, warn, ready } = setup()
      driver.sync(null)
      await ready()
      sdk.capture.mockImplementationOnce(() => {
        throw new Error("storage full")
      })
      expect(() => driver.track("rules_opened", { game: "hanabi" })).not.toThrow()
      driver.track("invite_link_copied", { game: "hanabi" })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(sdk.capture).toHaveBeenCalledTimes(2)
    })

    it("warns and goes on when switching to the persistent storage fails", async () => {
      const { driver, sdk, warn, ready } = setup()
      driver.sync(null)
      await ready()
      sdk.set_config.mockImplementationOnce(() => {
        throw new Error("storage refused")
      })
      expect(() => driver.sync(accepted)).not.toThrow()
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it("sweeps the device even when the SDK fails during a withdrawal", async () => {
      const { driver, sdk, calls, warn, ready } = setup()
      driver.sync(accepted)
      await ready()
      sdk.reset.mockImplementationOnce(() => {
        throw new Error("bug in the SDK")
      })
      expect(() => driver.sync(refused)).not.toThrow()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(calls.at(-1)).toBe("forget")
    })
  })
})
