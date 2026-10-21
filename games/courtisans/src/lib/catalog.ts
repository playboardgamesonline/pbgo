import { FAMILIES, type Family, ROLES, type Role } from "@courtisans/engine"
import { missing } from "@pbgo/core/lib/missing"

export type FamilyInfo = { key: Family; name: string; color: string; pictogramUrl: string | null }
export type RoleInfo = { key: Role; name: string; pictogramUrl: string | null }

export const MAT_ORDER: (Family | "queen")[] = ["butterfly", "toad", "nightingale", "queen", "hare", "stag", "carp"]

/** The colour of each family, until its document in Sanity sets its own. */
const FAMILY_COLORS: Record<Family, string> = {
  butterfly: "#a3bcc2",
  toad: "#8d9431",
  nightingale: "#d2415e",
  hare: "#f5b935",
  stag: "#0f8a69",
  carp: "#4a73b5",
}

/** The words of the board: the fields of the "Board" tab of the `texts` document in Sanity, under the same names. */
export const WORD_FIELDS = [
  "courtier",
  "zoneTable",
  "zoneYours",
  "zoneTheirs",
  "zoneOther",
  "youPlay",
  "youEliminate",
  "youDrawOne",
  "youDrawMany",
  "theyPlay",
  "theyEliminate",
  "theyDrawOne",
  "theyDrawMany",
  "gameOverLog",
  "missionsSucceeded",
  "noAssassination",
  "skip",
] as const

export type Vocabulary = Record<(typeof WORD_FIELDS)[number], string>

/** Every wording of a status that a mission text uses, in every language: the table highlights them on the mission cards. */
export type StatusWords = { light: string[]; disgrace: string[] }

/** What the board shows from Sanity: no text and no picture comes from the code. A text Sanity does not have reads `[missing: <key>]`; a picture it does not have is `null` (or absent from `cards` and `missions`): the table draws a placeholder and the Launch checklist says what is missing. */
export type ClientCatalog = {
  families: Record<Family, FamilyInfo>
  roles: Record<Role, RoleInfo>
  cards: Record<string, string>
  missions: Record<string, string>
  matUrl: string | null
  clothUrl: string | null
  courtierBackUrl: string | null
  whiteMissionBackUrl: string | null
  blueMissionBackUrl: string | null
  arrowUpUrl: string | null
  arrowDownUrl: string | null
  missionsButtonText: string
  banquetStartText: string
  words: Vocabulary
  statusWords: StatusWords
  /**
   * Mission texts in the player's language (id → text), in every language including the default one.
   * The text frozen into the game state (`Mission.text`) is only read for a mission since removed from Sanity.
   */
  missionTexts: Record<string, string>
}

export const cardKey = (family: Family, role: Role | null) => `${role ?? "base"}-${family}`

/** The catalog when Sanity has not answered (or the game has no project): every text is a visible marker and there is no picture. */
export const MISSING_CATALOG: ClientCatalog = {
  families: Object.fromEntries(
    FAMILIES.map((f) => [f, { key: f, name: missing(`families.${f}`), color: FAMILY_COLORS[f], pictogramUrl: null }]),
  ) as Record<Family, FamilyInfo>,
  roles: Object.fromEntries(ROLES.map((r) => [r, { key: r, name: missing(`roles.${r}`), pictogramUrl: null }])) as Record<Role, RoleInfo>,
  cards: {},
  missions: {},
  matUrl: null,
  clothUrl: null,
  courtierBackUrl: null,
  whiteMissionBackUrl: null,
  blueMissionBackUrl: null,
  arrowUpUrl: null,
  arrowDownUrl: null,
  missionsButtonText: missing("missionsButton"),
  banquetStartText: missing("banquetStarts"),
  words: Object.fromEntries(WORD_FIELDS.map((field) => [field, missing(field)])) as Vocabulary,
  statusWords: { light: [], disgrace: [] },
  missionTexts: {},
}
