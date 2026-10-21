import { FAMILIES, type Family, ROLES, type Role } from "@courtisans/engine"
import { DEFAULT_LOCALE, type Locale } from "@pbgo/core/lib/i18n"
import { defaultMissionTexts, gameDict } from "./i18n"

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
  FAMILIES.map((f) => [f, { key: f, name: FR.families[f].name, plural: cap(FR.families[f].plural), color: FAMILY_COLORS[f], pictogramUrl: null }]),
) as Record<Family, FamilyInfo>

export const DEFAULT_ROLES = Object.fromEntries(ROLES.map((r) => [r, { key: r, name: FR.roles[r].name, pictogramUrl: null }])) as Record<Role, RoleInfo>

/** What the board shows from Sanity. A picture it does not have is `null` (or absent from `cards` and `missions`): the table draws a placeholder and the Launch checklist says what is missing. */
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
  /**
   * Mission texts in the player's language (id → text), in every language including the default one.
   * The text frozen into the game state (`Mission.text`) is only a fallback, e.g. for a mission since removed from Sanity.
   */
  missionTexts: Record<string, string>
}

export const cardKey = (family: Family, role: Role | null) => `${role ?? "base"}-${family}`

/** The catalog before Sanity answers, or when it can't: the texts of the code and no picture. */
export const DEFAULT_CATALOG: ClientCatalog = {
  families: DEFAULT_FAMILIES,
  roles: DEFAULT_ROLES,
  cards: {},
  missions: {},
  matUrl: null,
  clothUrl: null,
  courtierBackUrl: null,
  whiteMissionBackUrl: null,
  blueMissionBackUrl: null,
  arrowUpUrl: null,
  arrowDownUrl: null,
  missionsButtonText: FR.missionsButton,
  banquetStartText: FR.banquetStart,
  missionTexts: defaultMissionTexts(DEFAULT_LOCALE),
}

/** Default catalog (no picture) with the texts of the language: families, roles, buttons, missions. */
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
    missionsButtonText: d.missionsButton,
    banquetStartText: d.banquetStart,
    missionTexts: defaultMissionTexts(locale),
  }
}
