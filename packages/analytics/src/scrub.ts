/**
 * Table codes stay out of the analytics. A table's address (`/<slug>/game/<CODE>`) is what lets someone sit down at it, so it
 * is not something to store in an event: the path is reported as `/<slug>/game/:code`, which also lets a funnel group the tables.
 */

/**
 * `/game/` (the table page) or `/games/` (its API, `/api/<slug>/games/<code>/…`) followed by a 6-character code (`CODE_LENGTH` of
 * the server, upper case in the URLs we build), not part of a longer word.
 */
const TABLE_CODE = /(\/games?\/)[A-Za-z0-9]{6}(?![A-Za-z0-9])/g

/**
 * The code as the tab title spells it (`tableTitle` of core: « Play Courtisans Online [PBGO] · Table #4XV-XA1 »): after a `#`, in
 * two groups of three. `$pageview` carries the title of the page. No lookbehind: Safari before 16.4 fails to parse the whole bundle
 * on one, so the character before the `#` is matched and given back instead.
 */
const TITLE_CODE = /(^|[^A-Za-z0-9])#[A-Za-z0-9]{3}-[A-Za-z0-9]{3}(?![A-Za-z0-9])/g

export const CODE_PLACEHOLDER = ":code"

/** `value` with the table code removed from the address, the API address and the tab title it appears in. */
export function scrubText(value: string): string {
  let scrubbed = value
  if (scrubbed.includes("/game")) scrubbed = scrubbed.replace(TABLE_CODE, `$1${CODE_PLACEHOLDER}`)
  if (scrubbed.includes("#")) scrubbed = scrubbed.replace(TITLE_CODE, `$1#${CODE_PLACEHOLDER}`)
  return scrubbed
}

/** Past this depth a value is left alone: an event is a shallow object, this only guards a cycle. */
const MAX_DEPTH = 8

/** A copy of `value` with every string leaf scrubbed. Arrays and plain objects are walked, anything else is returned as it is. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubText(value) as T
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1)) as T
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubDeep(item, depth + 1)])) as T
}

/**
 * The part of `CaptureResult` (posthog-js) that we read. No index signature on purpose: `CaptureResult` is an interface, which
 * would not satisfy `Record<string, unknown>`.
 */
export type Capture = { event: string; properties?: object }

/** The recording of a session, in the `$snapshot` events: large, and possibly compressed by the time `before_send` sees it. */
const SNAPSHOT_DATA = "$snapshot_data"

/**
 * `before_send` of the browser client: the table code leaves every string of the event. The payload of a session recording is the
 * one exception, it is not walked: the recorder masks it where it is produced (`maskCapturedNetworkRequestFn` for the page
 * address, `maskAttributeFn` for the links, `maskTextSelector` for the tab title, see `options.ts`), while the page properties
 * that `$snapshot` events carry, like any other event, are scrubbed here.
 */
export function scrubCapture<T extends Capture>(capture: T | null): T | null {
  if (!capture) return capture
  const properties = capture.properties as Record<string, unknown> | undefined
  if (capture.event !== "$snapshot" || !properties || !(SNAPSHOT_DATA in properties)) return scrubDeep(capture)
  const { [SNAPSHOT_DATA]: data, ...others } = properties
  const siblings = scrubDeep({ ...capture, properties: undefined })
  return { ...siblings, properties: { ...scrubDeep(others), [SNAPSHOT_DATA]: data } } as unknown as T
}
