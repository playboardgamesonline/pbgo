/** The most characters of a nickname that the board and the HUD draw: a longer one ends in an ellipsis. The full name stays the accessible label (`title`, `aria-label`) of what draws it. */
export const NAME_LIMIT = 12

const ELLIPSIS = "…"

/**
 * A nickname as it is drawn on a plate or in a list: at most `limit` characters of what is drawn, the ellipsis included, so a name of 13 characters or more is cut to `limit - 1` characters, the spaces
 * before the cut dropped, and ends in "…". Characters are counted as the eye counts them, by code point (an emoji or an accent written as one code point is one, never cut in half), and a letter with its combining marks or an emoji
 * joined by a zero-width joiner stays whole. A name that fits is returned as it is.
 */
export function shortName(name: string, limit: number = NAME_LIMIT): string {
  const clusters = graphemes(name)
  if (clusters.length <= limit) return name
  const kept = clusters.slice(0, Math.max(0, limit - 1)).join("").trimEnd()
  return kept + ELLIPSIS
}

/** The characters a reader sees, as a list: `Intl.Segmenter` where the runtime has it, else code points (still never half an emoji). */
function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => { segment: (text: string) => Iterable<{ segment: string }> } }).Segmenter
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment)
  return Array.from(text)
}
