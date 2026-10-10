import { DEFAULT_PICTO_FRAME, DEFAULT_ROLE_RULES, DEFAULT_RULE_TEXTS, type RuleTexts } from "./default-rules"
import { FAMILIES, type Family, ROLES, type Role } from "@courtisans/engine"
import { DEFAULT_MISSION_IMAGES } from "./default-missions"
import { DEFAULT_LOCALE, type Locale } from "@pbgo/core/lib/i18n"
import { defaultMissionTexts, gameDict } from "./i18n"
import { ROLE_RULE_TEXTS, RULE_TEXTS } from "./i18n-rules"

export type FamilyInfo = { key: Family; name: string; plural: string; color: string; pictogramUrl: string | null }
export type RoleInfo = { key: Role; name: string; pictogramUrl: string | null }

export const MAT_ORDER: (Family | "queen")[] = ["butterfly", "toad", "nightingale", "queen", "hare", "stag", "carp"]

const FR = gameDict(DEFAULT_LOCALE)
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const FAMILY_COLORS: Record<Family, string> = {
  butterfly: "#a3bcc2",
  toad: "#8d9431",
  nightingale: "#d2415e",
  hare: "#f5b935",
  stag: "#0f8a69",
  carp: "#4a73b5",
}

export const DEFAULT_FAMILIES = Object.fromEntries(
  FAMILIES.map((f) => [
    f,
    { key: f, name: FR.families[f].name, plural: cap(FR.families[f].plural), color: FAMILY_COLORS[f], pictogramUrl: `/pictograms/PICTOGRAM_${f.toUpperCase()}.webp` },
  ]),
) as Record<Family, FamilyInfo>

export const DEFAULT_ROLES = Object.fromEntries(
  ROLES.map((r) => [r, { key: r, name: FR.roles[r].name, pictogramUrl: `/pictograms/PICTOGRAM_${r.toUpperCase()}.webp` }]),
) as Record<Role, RoleInfo>

const FAMILY_EN: Record<Family, string> = {
  butterfly: "BUTTERFLY",
  toad: "TOAD",
  nightingale: "NIGHTINGALE",
  hare: "HARE",
  stag: "STAG",
  carp: "CARP",
}
const ROLE_EN: Record<Role, string> = { noble: "NOBLE", guard: "GUARD", spy: "SPY", assassin: "ASSASSIN" }
const defaultCardImage = (f: Family, r: Role | null) => `/cards/${r ? ROLE_EN[r] : "BASE"}_${FAMILY_EN[f]}.webp`

const PER_FAMILY_COUNT: Record<Role, number> = { noble: 4, guard: 3, spy: 2, assassin: 2 }

export type RoleRules = {
  name: string
  count: number
  text: string
  letteringUrl: string | null
  pictogramUrl: string | null
  cards: [string, string]
}

export const ROLE_VISUAL_FAMILIES: Record<Role, [Family, Family]> = {
  noble: ["butterfly", "carp"],
  guard: ["hare", "carp"],
  spy: ["hare", "toad"],
  assassin: ["nightingale", "stag"],
}

export type FamilyRules = { key: Family; name: string; color: string; pictogramUrl: string | null; cardUrl: string }

export const RULES_MISSION_VISUALS: [string, string] = ["mission-dark-7", "mission-light-5"]

export type RulesCatalog = {
  texts: RuleTexts
  roles: Record<Role, RoleRules>
  families: FamilyRules[]
  missions: [string, string]
  pictoFrame: string
}

export const DEFAULT_RULES: RulesCatalog = {
  texts: DEFAULT_RULE_TEXTS,
  pictoFrame: DEFAULT_PICTO_FRAME,
  families: MAT_ORDER.filter((f): f is Family => f !== "queen").map((f) => ({
    key: f,
    name: DEFAULT_FAMILIES[f].name,
    color: DEFAULT_FAMILIES[f].color,
    pictogramUrl: DEFAULT_FAMILIES[f].pictogramUrl,
    cardUrl: defaultCardImage(f, null),
  })),
  missions: RULES_MISSION_VISUALS.map((id) => DEFAULT_MISSION_IMAGES[id]!) as [string, string],
  roles: Object.fromEntries(
    ROLES.map((r) => [
      r,
      {
        name: DEFAULT_ROLES[r].name,
        count: PER_FAMILY_COUNT[r],
        cards: ROLE_VISUAL_FAMILIES[r].map((f) => defaultCardImage(f, r)) as [string, string],
        text: DEFAULT_ROLE_RULES[r],
        letteringUrl: null,
        pictogramUrl: DEFAULT_ROLES[r].pictogramUrl,
      },
    ]),
  ) as Record<Role, RoleRules>,
}

export type ClientCatalog = {
  families: Record<Family, FamilyInfo>
  roles: Record<Role, RoleInfo>
  cards: Record<string, string>
  missions: Record<string, string>
  matUrl: string
  clothUrl: string
  courtierBackUrl: string | null
  whiteMissionBackUrl: string | null
  blueMissionBackUrl: string | null
  arrowUpUrl: string
  arrowDownUrl: string
  rules: RulesCatalog
  missionsButtonText: string
  banquetStartText: string
  /**
   * Mission texts in the player's language (id → text), in every language including the default one.
   * The text frozen into the game state (`Mission.text`) is only a fallback, e.g. for a mission since removed from Sanity.
   */
  missionTexts: Record<string, string>
}

export const cardKey = (family: Family, role: Role | null) => `${role ?? "base"}-${family}`

export const DEFAULT_CATALOG: ClientCatalog = {
  families: DEFAULT_FAMILIES,
  roles: DEFAULT_ROLES,
  cards: Object.fromEntries(FAMILIES.flatMap((f) => [null, ...ROLES].map((r) => [cardKey(f, r), defaultCardImage(f, r)]))),
  missions: DEFAULT_MISSION_IMAGES,
  matUrl: "/GAME_MAT.jpg",
  clothUrl: "/textures/GAME_MAT_TEXTURE.webp",
  courtierBackUrl: "/cards/COURTIER_BACK.webp",
  whiteMissionBackUrl: "/cards/MISSION_BACK_LIGHT.webp",
  blueMissionBackUrl: "/cards/MISSION_BACK_DARK.webp",
  arrowUpUrl: "/pictograms/PICTOGRAM_ARROW_UP.svg",
  arrowDownUrl: "/pictograms/PICTOGRAM_ARROW_DOWN.svg",
  rules: DEFAULT_RULES,
  missionsButtonText: FR.missionsButton,
  banquetStartText: FR.banquetStart,
  missionTexts: defaultMissionTexts(DEFAULT_LOCALE),
}

/** Catalogue par défaut (images du code) avec les textes de la langue : familles, rôles, règles, boutons, missions. */
export function defaultCatalog(locale: Locale): ClientCatalog {
  if (locale === DEFAULT_LOCALE) return DEFAULT_CATALOG
  const d = gameDict(locale)
  const c = DEFAULT_CATALOG
  const families = Object.fromEntries(
    FAMILIES.map((f) => [f, { ...c.families[f], name: d.families[f].name, plural: cap(d.families[f].plural) }]),
  ) as Record<Family, FamilyInfo>
  const roles = Object.fromEntries(ROLES.map((r) => [r, { ...c.roles[r], name: d.roles[r].name }])) as Record<Role, RoleInfo>
  return {
    ...c,
    families,
    roles,
    rules: {
      ...c.rules,
      texts: RULE_TEXTS[locale],
      roles: Object.fromEntries(ROLES.map((r) => [r, { ...c.rules.roles[r], name: roles[r].name, text: ROLE_RULE_TEXTS[locale][r] }])) as Record<Role, RoleRules>,
      families: c.rules.families.map((f) => ({ ...f, name: families[f.key].name })),
    },
    missionsButtonText: d.missionsButton,
    banquetStartText: d.banquetStart,
    missionTexts: defaultMissionTexts(locale),
  }
}
