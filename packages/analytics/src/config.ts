/**
 * Settings of the analytics, read once from the environment.
 *
 * The two PostHog variables are public by design (the key ships to the browser). They are read as literal
 * `process.env.NEXT_PUBLIC_*` expressions on purpose: Next inlines those at build time, so a lookup through a variable name
 * (`process.env[name]`) would find nothing in the browser bundle. Without both values, `CONFIG` is null and everything
 * here switches itself off (no request, no banner, no "Cookies" link).
 */

/** Where the browser talks to PostHog: a same-origin path that `apps/web/next.config.ts` rewrites to the EU hosts. */
export const INGEST_PATH = "/ingest"

/** The deployment an event comes from (`VERCEL_ENV`, copied to `NEXT_PUBLIC_APP_ENV` by `next.config.ts`). */
export type AppEnv = "production" | "preview" | "development"

export type AnalyticsConfig = {
  /** Public project key (`phc_…`). */
  key: string
  /** Where the server sends its events, and where the proxy sends the browser's, no trailing slash. */
  ingestHost: string
  /** Where the proxy sends the browser's requests for PostHog's scripts (`/static`, `/array`). */
  assetsHost: string
  /** The PostHog app, for the links its toolbar and recordings open. */
  uiHost: string
  appEnv: AppEnv
}

export type RawEnv = {
  key?: string
  host?: string
  appEnv?: string
}

/** The project key: a secret key (`phx_…`, `phs_…`) pasted into a public variable is refused, not shipped. */
const PROJECT_KEY = /^phc_[A-Za-z0-9]+$/

/** PostHog Cloud: the ingest host tells the region, and the assets and the app live on sibling hosts. */
const POSTHOG_CLOUD = /^https:\/\/(us|eu)\.i\.posthog\.com$/

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

/** `https://host[:port]` with nothing after it, or `http://` for a loopback address (a local stand-in of PostHog). */
function origin(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const secure = url.protocol === "https:"
  const local = url.protocol === "http:" && LOOPBACK.has(url.hostname)
  if (!secure && !local) return null
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null
  return url.origin
}

function appEnvOf(value: string | undefined): AppEnv {
  return value === "production" || value === "preview" ? value : "development"
}

/** Pure on purpose: `CONFIG` below feeds it the environment, tests feed it values. */
export function resolveConfig(env: RawEnv): AnalyticsConfig | null {
  const key = env.key?.trim() ?? ""
  const host = origin((env.host?.trim() ?? "").replace(/\/+$/, ""))
  if (!PROJECT_KEY.test(key) || !host) return null
  const cloud = POSTHOG_CLOUD.exec(host)
  return {
    key,
    ingestHost: host,
    assetsHost: cloud ? `https://${cloud[1]}-assets.i.posthog.com` : host,
    uiHost: cloud ? `https://${cloud[1]}.posthog.com` : host,
    appEnv: appEnvOf(env.appEnv),
  }
}

export const CONFIG: AnalyticsConfig | null = resolveConfig({
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV,
})

/** False without a valid key and host: no request leaves, no banner shows, no "Cookies" link appears. */
export const ANALYTICS_ENABLED = CONFIG !== null

/**
 * The pages that never report: the gamemaster, and the previews it shows in iframes (served below `/gamemaster/<slug>/preview`
 * or, opened directly, `/<slug>/preview`), then `/design` and `/docs`, the team's own reference, whose demo of the banner (`/design`) would meet the real one.
 * The preview pattern is the one of `PREVIEW_PATH` in `@pbgo/core/lib/preview`, which this package cannot import.
 */
const EXCLUDED_PATH = /^(?:\/(?:gamemaster|design|docs)(?:\/|$)|\/[^/]+\/preview(?:\/|$))/

export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATH.test(pathname)
}
