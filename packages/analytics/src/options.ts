import type { BeforeSendFn, PostHogConfig } from "posthog-js"
import { INGEST_PATH, type AnalyticsConfig, type AppEnv } from "./config"
import type { Allowed } from "./consent"
import { scrubCapture, scrubText } from "./scrub"

/**
 * `before_send` of the browser client, run on every event: the table code leaves it (`scrubCapture`), and the deployment is
 * added as `env`. It is added here rather than registered as a super property because `reset()` (a withdrawn consent) clears the
 * registered ones. A recording chunk (`$snapshot`) does not get it: it only carries the session it belongs to.
 */
export function beforeSend(env: AppEnv): BeforeSendFn {
  return (capture) => {
    const scrubbed = scrubCapture(capture)
    if (!scrubbed || scrubbed.event === "$snapshot") return scrubbed
    return { ...scrubbed, properties: { ...scrubbed.properties, env } }
  }
}

/**
 * The options of `posthog.init`. Before the visitor allowed it, nothing is stored on the device (`persistence: "memory"`) and no
 * session is recorded; allowing the identifier and the recording switches them on later (`driver.ts`, `grant`), refusing never does.
 *
 * `defaults` is pinned to a dated set of PostHog's defaults rather than the newest: the newest ones switch on things this
 * site did not ask for (a "test user" flag on localhost that turns person profiles on). Everything that matters here is also
 * written out below, so a default that changes under us changes nothing.
 */
export function buildOptions(config: AnalyticsConfig, allowed: Allowed): Partial<PostHogConfig> {
  return {
    // The proxy of `next.config.ts`: the browser only ever talks to this origin.
    api_host: INGEST_PATH,
    ui_host: config.uiHost,
    defaults: "2025-11-30",

    persistence: allowed.analytics ? "localStorage+cookie" : "memory",
    cross_subdomain_cookie: false,
    // A profile exists only for a player who accepted: the others stay anonymous events.
    person_profiles: "identified_only",

    capture_pageview: "history_change",
    autocapture: true,
    capture_exceptions: true,
    capture_performance: { network_timing: false, web_vitals: true },
    capture_heatmaps: false,
    capture_dead_clicks: false,

    // Nothing to evaluate: no flags, no surveys, no experiments, so none of their scripts is fetched either.
    advanced_disable_feature_flags: true,
    disable_surveys: true,
    disable_conversations: true,
    disable_web_experiments: true,

    disable_session_recording: !allowed.recordings,
    // What the project's own settings say does not matter for these: a value set here wins over them.
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      // The recorder asks this function to mask the address of the page it records (the `href` of its first event): the
      // table code is removed at the source, the compressed chunks are not something `before_send` can read.
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: scrubText(request.name) }),
      // Same for the links and sources of the page it snapshots.
      maskAttributeFn: (_name, value) => scrubText(value),
      // And for the title of the tab, which spells the code of a table (« … · Table #4XV-XA1 »). Stars, not `maskTextFn`: that
      // one would also replace the stars of the nicknames (`ph-mask`).
      maskTextSelector: "title",
    },

    before_send: beforeSend(config.appEnv),
  }
}
