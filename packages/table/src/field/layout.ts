/** How wide a text is, in pixels, in the font and size the layout is made for */
export type Measure = (text: string) => number

/** One line of a sheet: its text, and the index in the whole text of its first character (a line that ends on a space leaves that space out, so the next one starts a character later) */
export type Row = { text: string; start: number }

/** The room a text has, in pixels, and how many lines it may run over */
export type Box = { width: number; height: number; lines: number }

export type SheetLayout = {
  /** The size of the letters, in pixels */
  size: number
  /** The height of one line, in pixels */
  pitch: number
  rows: Row[]
  /** True when the text did not fit even at the smallest size, so that its last lines are not shown */
  cut: boolean
}

/** The size of the letters in a line, as a share of the line's height, and how far the letters may shrink to fit: below this a text is cut instead */
export const LETTER_SHARE = 0.68
export const SMALLEST = 0.5

// A reader counts what they see as one character, and a line breaks between them, never inside an emoji or behind an accent
const segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null

function characters(text: string): { at: number; text: string }[] {
  if (segmenter) return [...segmenter.segment(text)].map((part) => ({ at: part.index, text: part.segment }))
  let at = 0
  return [...text].map((character) => {
    const part = { at, text: character }
    at += character.length
    return part
  })
}

function wrapParagraph(paragraph: string, offset: number, width: number, measure: Measure): Row[] {
  const rows: Row[] = []
  const parts = characters(paragraph)
  let first = 0
  let space = -1
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (part.text === " ") space = i
    const row = paragraph.slice(parts[first]!.at, part.at + part.text.length).trimEnd()
    if (measure(row) <= width || i === first) continue
    if (space > first) {
      // Break at the last space of the line; the space stays at the end of this line and is not drawn
      rows.push({ text: paragraph.slice(parts[first]!.at, parts[space]!.at).trimEnd(), start: offset + parts[first]!.at })
      first = space + 1
    } else {
      // A word wider than the line: break before the character that no longer fits
      rows.push({ text: paragraph.slice(parts[first]!.at, part.at), start: offset + parts[first]!.at })
      first = i
    }
    space = -1
    i = first - 1
  }
  rows.push({ text: parts.length === 0 ? "" : paragraph.slice(parts[first]!.at), start: offset + (parts.length === 0 ? 0 : parts[first]!.at) })
  return rows
}

/** The lines a text breaks into when no line may be wider than `width`: at the spaces, and inside a word only when the word is wider than the line. A line break of the text starts a line */
export function wrapRows(text: string, width: number, measure: Measure): Row[] {
  const rows: Row[] = []
  let offset = 0
  for (const paragraph of text.split("\n")) {
    rows.push(...wrapParagraph(paragraph, offset, width, measure))
    offset += paragraph.length + 1
  }
  return rows
}

/**
 * How a text lies on a sheet: the letters are as big as the line is high, and shrink, step by step, until the text fits in the lines the sheet has; when it still does not at the smallest size, the lines
 * that do fit are kept and `cut` says the rest is not shown. `measureAt` gives the measure of a size.
 */
export function layoutSheet(text: string, box: Box, measureAt: (size: number) => Measure): SheetLayout {
  const pitch = box.height / box.lines
  const base = pitch * LETTER_SHARE
  let rows: Row[] = []
  let size = base
  for (let scale = 1; scale >= SMALLEST - 1e-9; scale -= 0.05) {
    size = base * scale
    rows = wrapRows(text, box.width, measureAt(size))
    if (rows.length <= box.lines) return { size, pitch, rows, cut: false }
  }
  return { size, pitch, rows: rows.slice(0, box.lines), cut: true }
}
