/**
 * Text a player writes: a clue, a word, a title, a note. It is the one input of a game that nobody wrote the rules for, so it is cleaned and bounded in one place, on the server, before it reaches a
 * state, a log or another player's screen. An engine calls `cleanText` on the text of the action in `apply`; the board may call it too, to tell the player before they send, but only the engine's
 * answer counts.
 *
 * What a game does with the text, and when the others may read it, is the game's: a text written in secret is a `Submissions<string>` (see `simultaneous.ts`) and stays out of the view until the step
 * is resolved. Two texts that mean the same word are compared with `sameText`.
 */
import { EngineError } from "./errors"

/** The most characters a text may have unless the game says another number: enough for a word, a clue or a short sentence */
export const DEFAULT_TEXT_MAX = 60

/** What a text must be like. Every field is optional. */
export type TextRules = {
  /** The most characters, counted the way a reader does: an accented letter or an emoji with its modifiers is one (default `DEFAULT_TEXT_MAX`). A longer text is refused, never cut */
  max?: number
  /** The fewest characters (default 1: an empty text is refused) */
  min?: number
  /** The most lines (default 1: a line break becomes a space). Empty lines are dropped */
  lines?: number
  /** The most words, a word being what spaces separate (default no limit): one for a clue that must be a single word */
  words?: number
}

// A reader counts what they see as one character: Intl.Segmenter does that, and the code points are the fallback where it is missing. The locale is fixed so that the count never depends on the machine
const segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null
const countCharacters = (text: string) => (segmenter ? [...segmenter.segment(text)].length : [...text].length)

// What never gets through: control characters (a line break is dealt with before), lone surrogates (jsonb refuses them), private use, and the invisible format characters that reorder or hide text
// (right-to-left overrides, zero-width spaces, soft hyphens, byte order marks). The two joiners stay: emoji sequences and some scripts cannot be written without them
const FORBIDDEN = /(?!\n)\p{Cc}|[\p{Cs}\p{Co}]|(?![\u200C\u200D])\p{Cf}/gu
const LINE_BREAKS = /\r\n|[\r\u0085\u2028\u2029]/g
const SPACES = /[\t\f\v\p{Zs}]/gu
// Combining marks past the third on one character (once the accents that compose are composed) are the stacks of "zalgo" text, which spill over everything around them
const MARK_STACKS = /(\p{M}{3})\p{M}+/gu

/** A text no engine would take: the cheapest check there is, made before any work, so a huge text costs nothing */
const unreasonable = (input: string, max: number) => input.length > max * 16 + 64

/**
 * The text a player wrote, ready for the state: normalised (composed accents), stripped of what cannot be shown or stored, with its spaces and lines tidied, and checked against `rules`.
 * Throws `EngineError("INVALID_TEXT")` for anything that is not a string, is empty, or is longer or has more lines or words than the rules allow: the platform words that refusal for the player.
 * The same text always gives the same result, on the server and in the browser.
 */
export function cleanText(input: unknown, rules: TextRules = {}): string {
  const { max = DEFAULT_TEXT_MAX, min = 1, lines = 1, words } = rules
  if (typeof input !== "string") throw new EngineError("INVALID_TEXT", "A text was expected")
  if (unreasonable(input, max)) throw new EngineError("INVALID_TEXT", "That text is far too long")

  const rows = input
    .normalize("NFC")
    .replace(LINE_BREAKS, "\n")
    .replace(/\n/g, lines <= 1 ? " " : "\n")
    .replace(SPACES, " ")
    .replace(FORBIDDEN, "")
    .replace(MARK_STACKS, "$1")
    .split("\n")
    .map((row) => row.replace(/ {2,}/g, " ").trim())
    .filter((row) => row !== "")
  if (rows.length > lines) throw new EngineError("INVALID_TEXT", "That text has too many lines")

  const text = rows.join(lines === 1 ? " " : "\n")
  const length = countCharacters(text)
  if (length < min) throw new EngineError("INVALID_TEXT", min <= 1 ? "That text is empty" : "That text is too short")
  if (length > max) throw new EngineError("INVALID_TEXT", "That text is too long")
  if (words !== undefined && text !== "" && text.split(/\s+/).length > words) throw new EngineError("INVALID_TEXT", "That text has too many words")
  return text
}

/**
 * What two texts are compared by: without accents, case or anything that is not a letter or a digit, so that "Éléphant!" and "elephant" are the same word. A text with no letter or digit
 * at all (a few emoji) is compared as it is. Use it for a rule such as "a clue cannot be a word of the board".
 */
export function textKey(text: string): string {
  const key = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
  return key === "" ? text.normalize("NFC").trim() : key
}

/** True when two texts are the same once compared by `textKey`; two empty texts are not the same word */
export function sameText(a: string, b: string): boolean {
  const key = textKey(a)
  return key !== "" && key === textKey(b)
}
