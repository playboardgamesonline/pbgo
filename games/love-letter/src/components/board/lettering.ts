import type { CharacterKey } from "@love-letter/engine"

/**
 * Where the name and the card text of a character go on its face. The faces of the owner's art are blank plates of 760 by 1060 pixels: the value and the copies are printed (a burgundy medallion at the top left and dots on the left edge), the name and the text
 * are not, so the board draws them. Each plate is the largest empty rectangle measured on the files ("Pictures" in the game's CLAUDE.md), in pixels of the picture.
 */
export const FACE = { width: 760, height: 1060 }

export type Plate = { x: number; y: number; width: number; height: number }

/** The banner right of the medallion: the name, one line, centred */
export const NAME_PLATE: Plate = { x: 307, y: 72, width: 277, height: 78 }

/** The plate under the portrait: layout A (spy, guard, baron, handmaid, prince, chancellor) is the taller one, layout B (priest, king, countess, princess) is shorter because the portrait runs lower */
const TEXT_PLATES = {
  A: { x: 91, y: 810, width: 578, height: 168 },
  B: { x: 91, y: 846, width: 578, height: 131 },
} as const satisfies Record<string, Plate>

const SHORT_PLATE: readonly CharacterKey[] = ["priest", "king", "countess", "princess"]

/** The plate of the card text of a character */
export const textPlateOf = (key: CharacterKey): Plate => (SHORT_PLATE.includes(key) ? TEXT_PLATES.B : TEXT_PLATES.A)

/** The size, in pixels of the picture, that the lettering starts from and the least it may be set at: a text that does not fit at the largest size is set smaller, down to the least, which a text of the budgets (130 or 90 characters) never needs */
export const NAME_SIZE = { start: 58, least: 22 }
export const TEXT_SIZE = { start: 36, least: 18 }

/** The height of a line of the card text, as a share of its size */
export const LINE_HEIGHT = 1.16

/** The largest size from `start` down to `least` at which `fits` holds, in whole pixels; `least` when none does */
export function largestFit(start: number, least: number, fits: (size: number) => boolean): number {
  for (let size = start; size > least; size--) if (fits(size)) return size
  return least
}

/**
 * `text` broken into lines of at most `width`, at the spaces, with `measure` giving the width of a piece of text at the size being tried. A word wider than a line stays whole on a line of its own (the caller sees it does not fit and sets the text smaller).
 */
export function wrap(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && measure(`${line} ${word}`) > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

/** How a text is set in a plate: the size and the lines. `fits` is false when even the least size overflows the plate */
export type Setting = { size: number; lines: string[]; fits: boolean }

/** The card text set in its plate: the largest size at which every line fits the width and all the lines fit the height */
export function setText(text: string, plate: Plate, measureAt: (size: number) => (text: string) => number): Setting {
  const attempt = (size: number) => {
    const measure = measureAt(size)
    const lines = wrap(text, plate.width, measure)
    return { size, lines, fits: lines.length * size * LINE_HEIGHT <= plate.height && lines.every((line) => measure(line) <= plate.width) }
  }
  const size = largestFit(TEXT_SIZE.start, TEXT_SIZE.least, (candidate) => attempt(candidate).fits)
  return attempt(size)
}

/** The name set in its banner: the largest size at which it fits the width of the banner and its height */
export function setName(name: string, plate: Plate, measureAt: (size: number) => (text: string) => number): { size: number; fits: boolean } {
  const fits = (size: number) => measureAt(size)(name) <= plate.width && size <= plate.height
  const size = largestFit(NAME_SIZE.start, NAME_SIZE.least, fits)
  return { size, fits: fits(size) }
}
