// What the terminal shows: colours (off when the output is not a terminal or NO_COLOR is set), durations, money, links, the rule above a gate.
import { homedir } from "node:os"

export type Palette = {
  bold: (text: string) => string
  dim: (text: string) => string
  green: (text: string) => string
  red: (text: string) => string
  yellow: (text: string) => string
  cyan: (text: string) => string
}

export function palette(color: boolean): Palette {
  const wrap = (open: number, close: number) => (text: string) => (color ? `\u001b[${open}m${text}\u001b[${close}m` : text)
  return { bold: wrap(1, 22), dim: wrap(2, 22), green: wrap(32, 39), red: wrap(31, 39), yellow: wrap(33, 39), cyan: wrap(36, 39) }
}

/** `4 min 12 s`, `37 s`: how long a call took. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/** One line of at most `max` characters: white space collapsed, an ellipsis when it was cut. */
export function shorten(text: string, max: number): string {
  const line = text.replace(/\s+/g, " ").trim()
  return line.length <= max ? line : `${line.slice(0, Math.max(0, max - 1))}…`
}

/** The home folder as `~`, for a path that is printed. */
export function tilde(path: string, home: string = homedir()): string {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

/** Every path of the home folder in a text as `~/…`: the lines a command printed, which hold absolute paths. */
export function tildeAll(text: string, home: string = homedir()): string {
  return home ? text.split(`${home}/`).join("~/") : text
}

const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const ESCAPES = [
  // a control sequence (colours, the cursor, clearing the screen), an operating-system command (the title of the window, a link), then any other escape of two
  // characters (a reset, a saved cursor): ESC, intermediate bytes, a final byte
  new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g"),
  new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)?`, "g"),
  new RegExp(`${ESC}[ -/]*[0-~]`, "g"),
]
const CONTROLS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`, "g")

/** Text from an agent that is safe to print: no escape sequence and no control character but the line break and the tab (a terminal obeys them, and the agent read web pages). */
export function printable(text: string): string {
  let clean = text
  for (const escape of ESCAPES) clean = clean.replace(escape, "")
  return clean.replace(CONTROLS, "")
}

/** The https addresses of a text, in order, each once, without the punctuation that ends a sentence. */
export function extractLinks(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/https:\/\/[^\s<>"'`]+/g)) {
    const link = match[0].replace(/[.,;:!?)\]}]+$/, "")
    if (link.length > "https://".length && !found.includes(link)) found.push(link)
  }
  return found
}

/** `━━━ title ━━━`: the line above a report. */
export function rule(title: string, palette: Palette): string {
  return palette.bold(`━━━ ${title} ━━━`)
}
