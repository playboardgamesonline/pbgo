// The placeholders of a word, with no import: the one function that the boards, the platform and the Node-only content projects of the games all read, so that a word reads the same in the Studio's checks, in the seed and on the table.

/** What a word takes in its `{placeholders}`: the name of a player (`{target}`), a card, a number (`{number}`), a count of points (`{points}`) */
export type Values = Record<string, string | number>

/** A word with its placeholders filled in. A placeholder with no value stays as written, so a mistake shows on the table instead of hiding. */
export function fill(text: string, values: Values = {}): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
}
