import type { Family, Mission, Role, Status } from "@courtisans/engine"
import { DEFAULT_LOCALE } from "@pbgo/core/lib/i18n"
import { defaultMissionTexts } from "./i18n"

const ORDER: Family[] = ["carp", "stag", "toad", "hare", "butterfly", "nightingale"]
const ROLES: [Role, number][] = [
  ["spy", 3],
  ["noble", 3],
  ["assassin", 2],
  ["guard", 4],
]
const QUEENS: [Status, number][] = [
  ["disgrace", 2],
  ["light", 2],
  ["disgrace", 3],
  ["neutral", 1],
]

/** Text frozen into the game state: default language. Players read `catalog.missionTexts[id]` in their own language. */
const TEXTS = defaultMissionTexts(DEFAULT_LOCALE)

export const DEFAULT_MISSIONS: Mission[] = [
  ...ORDER.map((family, i): Mission => ({
    id: `mission-light-${i + 1}`,
    color: "white",
    text: TEXTS[`mission-light-${i + 1}`]!,
    condition: { type: "playerComparison", filter: { family }, comparator: "lt", opponent: "leftNeighbor" },
  })),
  ...ROLES.map(([role, value], i): Mission => ({
    id: `mission-light-${i + 7}`,
    color: "white",
    text: TEXTS[`mission-light-${i + 7}`]!,
    condition: { type: "domainCards", filter: { role }, comparator: "gte", value },
  })),
  ...ORDER.map((family, i): Mission => ({
    id: `mission-dark-${i + 1}`,
    color: "blue",
    text: TEXTS[`mission-dark-${i + 1}`]!,
    condition: { type: "familyStatus", family, status: "disgrace" },
  })),
  ...QUEENS.map(([status, value], i): Mission => ({
    id: `mission-dark-${i + 7}`,
    color: "blue",
    text: TEXTS[`mission-dark-${i + 7}`]!,
    condition: { type: "familiesWithStatus", status, comparator: "gte", value },
  })),
]

export const DEFAULT_MISSION_IMAGES: Record<string, string> = Object.fromEntries(
  DEFAULT_MISSIONS.map((m) => [m.id, `/cards/${m.id.replace("mission-", "MISSION_").replace("light-", "LIGHT_").replace("dark-", "DARK_")}.webp`]),
)
