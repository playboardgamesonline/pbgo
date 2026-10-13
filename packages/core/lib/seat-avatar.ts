/**
 * The seat avatar: what stands for a player next to their nickname, on the table, in the strip of pending players, the lobby,
 * the announcements and the game over. Until accounts exist (PLT-13) it is generated from the player alone, the initial of the
 * nickname on the seat colour; a profile picture replaces it through `imageUrl`, and no caller changes. Pure (no DOM): the
 * component (`components/game/seat-label.tsx`) and the painter of the 3D tables (`seat-avatar-canvas.ts`) both draw from this.
 */

export type SeatAvatarInput = {
  nickname: string
  /** Seat colour: any CSS colour, as the skin's `playerColors` give it */
  color: string
  /** The account's picture (PLT-13), when the player has one. Never set before accounts exist. */
  imageUrl?: string | null
}

export type SeatAvatar = {
  /** One character: "É" for "élodie", "🦊" for "🦊 Fox", "?" for an empty nickname */
  initial: string
  color: string
  /** Colour of the initial on `color`: white or near-black, whichever reads better */
  ink: string
  imageUrl: string | null
}

export const INK_LIGHT = "#ffffff"
export const INK_DARK = "#14110d"

// A character is more than one code point (accents written as two, flags, emoji joined together): cut on graphemes.
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null
const graphemes = (text: string): string[] => (segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text))

// What can stand for a name: a letter, a digit or an emoji (a leading "@" or "-" cannot)
const SYMBOL = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Emoji_Presentation}]/u

/** First letter, digit or emoji of the nickname, upper-cased; the first character when there is none, "?" for an empty nickname. */
export function initialOf(nickname: string): string {
  const parts = graphemes(nickname.trim())
  const first = parts.find((part) => SYMBOL.test(part)) ?? parts[0]
  if (!first) return "?"
  // "ß" upper-cases to "SS": keep the first character
  return graphemes(first.toUpperCase())[0] ?? "?"
}

type Rgb = [number, number, number]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// h in degrees, s and l in 0..1
function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255
  return [f(0), f(8), f(4)]
}

/** Hex (3, 4, 6 or 8 digits), `rgb()` and `hsl()` in the comma or the space syntax; anything else (`var()`, names…): null. */
function parseColor(input: string): Rgb | null {
  const css = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(css)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? Array.from(hex, (digit) => digit + digit).join("") : hex
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
  }
  const fn = /^(rgb|hsl)a?\(\s*([^)]*?)\s*\)$/.exec(css)
  if (!fn) return null
  const parts = (fn[2] ?? "").split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const numbers = parts.slice(0, 3).map((part) => parseFloat(part))
  if (numbers.some(Number.isNaN)) return null
  if (fn[1] === "hsl") return hslToRgb(numbers[0]!, clamp(numbers[1]!, 0, 100) / 100, clamp(numbers[2]!, 0, 100) / 100)
  return parts.slice(0, 3).map((part, i) => clamp(part.endsWith("%") ? numbers[i]! * 2.55 : numbers[i]!, 0, 255)) as Rgb
}

// WCAG 2 relative luminance and contrast ratio
const channel = (value: number) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const LIGHT_LUMINANCE = luminance(parseColor(INK_LIGHT)!)
const DARK_LUMINANCE = luminance(parseColor(INK_DARK)!)

/** The ink that reads better on `background`: white or near-black, by contrast. A colour that cannot be read (`var()`…): white. */
export function readableOn(background: string): string {
  const rgb = parseColor(background)
  if (!rgb) return INK_LIGHT
  const l = luminance(rgb)
  return contrast(l, LIGHT_LUMINANCE) >= contrast(l, DARK_LUMINANCE) ? INK_LIGHT : INK_DARK
}

/** Everything a seat label draws for a player. Deterministic: the same nickname and colour always give the same avatar. */
export function seatAvatar({ nickname, color, imageUrl }: SeatAvatarInput): SeatAvatar {
  return { initial: initialOf(nickname), color, ink: readableOn(color), imageUrl: imageUrl?.trim() || null }
}
