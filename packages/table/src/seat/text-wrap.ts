// Breaking a text into lines: the pure half of a lettering of several lines. No canvas and no three.js: `table-text.tsx` measures the words with a canvas and paints the lines, and `text-wrap.test.ts` holds this.

/** The words of a text: its runs of characters between spaces. A text with none has no word */
const wordsOf = (text: string): string[] => text.split(/\s+/).filter((word) => word !== "")

/** The lines that the words fill in a room, as `widthOf` measures a line: a line takes words while the next one still fits, and a word wider than the room has a line of its own, wider than the room (a word is never cut) */
function fill(words: readonly string[], widthOf: (line: string) => number, room: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const joined = line === "" ? word : `${line} ${word}`
    if (line !== "" && widthOf(joined) > room) {
      lines.push(line)
      line = word
    } else {
      line = joined
    }
  }
  if (line !== "") lines.push(line)
  return lines
}

/**
 * Breaks a text at its spaces into the fewest lines that fit `room`, as `widthOf` measures a line (pixels, units: whatever `room` is in), and evens them out: the same number of lines in the narrowest room that still holds the words, so that three words do not
 * end as two on the first line and one on the second when two and one would do as well, and the label does not lean on its first line. A word wider than the room is not cut: it has a line of its own, wider than the room. A text with no word is one empty line.
 */
export function wrapText(text: string, widthOf: (line: string) => number, room: number): string[] {
  const words = wordsOf(text)
  if (words.length === 0) return [""]
  const greedy = fill(words, widthOf, room)
  if (greedy.length < 2) return greedy
  // the narrowest room that still holds the words in as many lines: a search between the widest word (no room is narrower than it) and the room
  let narrow = Math.min(room, Math.max(...words.map(widthOf)))
  let wide = room
  for (let step = 0; step < 16; step++) {
    const middle = (narrow + wide) / 2
    if (fill(words, widthOf, middle).length <= greedy.length) wide = middle
    else narrow = middle
  }
  return fill(words, widthOf, wide)
}

/** How wide the widest of the lines is, as `widthOf` measures a line */
export const widest = (lines: readonly string[], widthOf: (line: string) => number): number => Math.max(0, ...lines.map(widthOf))
