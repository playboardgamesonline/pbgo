// Plain data, no Sanity import: read by the schema, by the seed script (games/love-letter/content) and by its tests.

/**
 * The ten characters of the 21 character cards (2025 rulebook, p. 2), lowest value first: the Spy at 0 to the Princess at 9. They are one kind of card, so one document type and one list in the Studio (`character`).
 * The key is the simplest English name a character has: its stable id, the same in Sanity, in the art file names and in the engine, which reads these ten keys as they are. Append only, never rename.
 */
export const CHARACTER_KEYS = ["spy", "guard", "priest", "baron", "handmaid", "prince", "chancellor", "king", "countess", "princess"] as const
export type CharacterKey = (typeof CHARACTER_KEYS)[number]

/** What the Studio lists a character under: its English name, as the 2025 rulebook prints it. */
export const CHARACTERS: { title: string; value: CharacterKey }[] = [
  { title: "Spy", value: "spy" },
  { title: "Guard", value: "guard" },
  { title: "Priest", value: "priest" },
  { title: "Baron", value: "baron" },
  { title: "Handmaid", value: "handmaid" },
  { title: "Prince", value: "prince" },
  { title: "Chancellor", value: "chancellor" },
  { title: "King", value: "king" },
  { title: "Countess", value: "countess" },
  { title: "Princess", value: "princess" },
]

export const titleOf = (choices: { title: string; value: string }[], value: unknown) => choices.find((choice) => choice.value === value)?.title
