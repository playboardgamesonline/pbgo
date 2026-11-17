// What `pnpm game-flow` prints of what other people and agents wrote: links, one-line summaries, paths with the home folder as `~`, and text with no escape sequence in it.
import { homedir } from "node:os"

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
