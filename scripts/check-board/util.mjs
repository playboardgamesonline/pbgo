// Small helpers shared by the parts of `pnpm check:board`.
import { setTimeout as sleep } from "node:timers/promises"

export { sleep }

/** Calls `read` until it gives something other than `null`, `undefined` or `false`, and gives that; `null` when the time is up. A read that throws is a read that gave nothing yet. */
export async function waitFor(read, { timeoutMs = 10_000, everyMs = 250 } = {}) {
  const until = Date.now() + timeoutMs
  for (;;) {
    let value = null
    try {
      value = await read()
    } catch {
      value = null
    }
    if (value !== null && value !== undefined && value !== false) return value
    if (Date.now() + everyMs > until) return null
    await sleep(everyMs)
  }
}

/** "1280x800" as [1280, 800], or null */
export function parseSize(text) {
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(text.trim())
  return match ? [Number(match[1]), Number(match[2])] : null
}

/** "12 s" or "1 min 5 s", for the lines of the report */
export function seconds(ms) {
  const total = Math.round(ms / 100) / 10
  return total < 60 ? `${total} s` : `${Math.floor(total / 60)} min ${Math.round(total % 60)} s`
}

/** The first `n` distinct strings of a list, in order */
export function distinct(list, n = 8) {
  return [...new Set(list)].slice(0, n)
}

/** Whether a text matches one of the patterns (RegExps, or strings that the text must contain) */
export function matchesAny(text, patterns = []) {
  return patterns.some((pattern) => (pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern))))
}

/** Mean absolute difference of two equally long lists of numbers (0 to 255 for pixels) */
export function meanDiff(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

/** The biggest difference between two lists of numbers */
export function maxDiff(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity
  let biggest = 0
  for (let i = 0; i < a.length; i++) biggest = Math.max(biggest, Math.abs(a[i] - b[i]))
  return biggest
}
