import type { CaptureResult } from "posthog-js"
import { describe, expect, it } from "vitest"
import { resolveConfig } from "./config"
import { beforeSend, buildOptions } from "./options"

const config = resolveConfig({ key: "phc_abc123", host: "https://eu.i.posthog.com", appEnv: "preview" })!

function capture(event: string, properties: Record<string, unknown>): CaptureResult {
  return { uuid: "u", event, properties }
}

describe("buildOptions", () => {
  it("stores nothing and records nothing before the visitor accepted", () => {
    const options = buildOptions(config, false)
    expect(options.persistence).toBe("memory")
    expect(options.disable_session_recording).toBe(true)
  })

  it("stores the identifier and may record once the visitor accepted", () => {
    const options = buildOptions(config, true)
    expect(options.persistence).toBe("localStorage+cookie")
    expect(options.disable_session_recording).toBe(false)
  })

  it("talks to the proxy of the site, not to PostHog", () => {
    const options = buildOptions(config, false)
    expect(options.api_host).toBe("/ingest")
    expect(options.ui_host).toBe("https://eu.posthog.com")
  })

  it("keeps the person profiles, the recording details and the extras PostHog could switch on off", () => {
    for (const accepted of [false, true]) {
      const options = buildOptions(config, accepted)
      expect(options.person_profiles).toBe("identified_only")
      expect(options.cross_subdomain_cookie).toBe(false)
      expect(options.enable_recording_console_log).toBe(false)
      expect(options.capture_performance).toEqual({ network_timing: false, web_vitals: true })
      expect(options.session_recording).toMatchObject({
        maskAllInputs: true,
        recordHeaders: false,
        recordBody: false,
        captureCanvas: { recordCanvas: false },
      })
      expect(options).toMatchObject({
        advanced_disable_feature_flags: true,
        disable_surveys: true,
        disable_conversations: true,
        disable_web_experiments: true,
        capture_heatmaps: false,
        capture_dead_clicks: false,
      })
    }
  })

  it("asks the recorder to hide the table code from the page address and from the links it snapshots", () => {
    const { maskCapturedNetworkRequestFn, maskAttributeFn } = buildOptions(config, true).session_recording!
    const request = { name: "https://x.app/hanabi/game/ABC123", entryType: "navigation", startTime: 0, duration: 0, method: "GET" }
    expect(maskCapturedNetworkRequestFn?.(request)).toEqual({ ...request, name: "https://x.app/hanabi/game/:code" })
    expect(maskAttributeFn?.("href", "/hanabi/game/ABC123")).toBe("/hanabi/game/:code")
    expect(maskAttributeFn?.("alt", "A card")).toBe("A card")
  })

  it("asks the recorder to mask the tab title, which spells the code of a table, and nothing that would replace the stars", () => {
    for (const accepted of [false, true]) {
      const { maskTextSelector, maskTextFn } = buildOptions(config, accepted).session_recording!
      expect(maskTextSelector).toBe("title")
      // A `maskTextFn` would also be called for the nicknames (`ph-mask`) and let their text through
      expect(maskTextFn).toBeUndefined()
    }
  })
})

describe("beforeSend", () => {
  it("adds the deployment and removes the table code, from the address and from the title of the page", () => {
    const output = beforeSend("preview")(
      capture("$pageview", {
        $current_url: "https://x.app/hanabi/game/ABC123",
        $pathname: "/hanabi/game/ABC123",
        title: "Play Hanabi Online [PBGO] · Table #ABC-123",
      }),
    )
    expect(output?.properties).toEqual({
      $current_url: "https://x.app/hanabi/game/:code",
      $pathname: "/hanabi/game/:code",
      title: "Play Hanabi Online [PBGO] · Table #:code",
      env: "preview",
    })
  })

  it("does not let a property decide the deployment", () => {
    const output = beforeSend("production")(capture("language_changed", { env: "development", from: "fr", to: "en" }))
    expect(output?.properties.env).toBe("production")
  })

  it("leaves the recording chunks without a deployment, and their payload as it is", () => {
    const data = [{ type: 4 }]
    const output = beforeSend("production")(capture("$snapshot", { $snapshot_data: data, $session_id: "s1" }))
    expect(output?.properties).toEqual({ $snapshot_data: data, $session_id: "s1" })
    expect(output?.properties.$snapshot_data).toBe(data)
  })
})
