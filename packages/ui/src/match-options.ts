// What a list of options with a search field (`@pbgo/ui/platform/combobox`) keeps for what was typed. No React in this file, so that it is tested as it is.

/** A text as the search compares it: in lower case and without accents, so "Hervé" and "herve" are the same word. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase()
}

/** The options that hold what was typed, wherever it is in them, in their own order. Blanks around the text are ignored; no text keeps them all. */
export function matchOptions(options: readonly string[], query: string): string[] {
  const needle = fold(query).trim()
  return needle === "" ? [...options] : options.filter((option) => fold(option).includes(needle))
}
