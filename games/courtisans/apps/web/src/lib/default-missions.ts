import type { Family, Mission, Role, Status } from "@courtisans/engine"

const ORDER: Family[] = ["carp", "stag", "toad", "hare", "butterfly", "nightingale"]
const PLURALS: Record<Family, string> = { butterfly: "papillons", toad: "crapauds", nightingale: "rossignols", hare: "lièvres", stag: "cerfs", carp: "carpes" }
const ROLES: [Role, number, string][] = [
  ["spy", 3, "espions"],
  ["noble", 3, "nobles"],
  ["assassin", 2, "assassins"],
  ["guard", 4, "gardes"],
]
const QUEENS: [string, Status, number][] = [
  ["Au moins 2 familles doivent être en disgrâce à la cour.", "disgrace", 2],
  ["Au moins 2 familles doivent être dans la lumière.", "light", 2],
  ["Au moins 3 familles doivent être en disgrâce à la cour.", "disgrace", 3],
  ["Au moins 1 famille doit être neutre.", "neutral", 1],
]

export const DEFAULT_MISSIONS: Mission[] = [
  ...ORDER.map((family, i): Mission => ({
    id: `mission-light-${i + 1}`,
    color: "white",
    text: `Vous devez posséder moins de ${PLURALS[family]} que votre voisin de gauche.`,
    condition: { type: "playerComparison", filter: { family }, comparator: "lt", opponent: "leftNeighbor" },
  })),
  ...ROLES.map(([role, value, name], i): Mission => ({
    id: `mission-light-${i + 7}`,
    color: "white",
    text: `Vous devez posséder au moins ${value} ${name}.`,
    condition: { type: "domainCards", filter: { role }, comparator: "gte", value },
  })),
  ...ORDER.map((family, i): Mission => ({
    id: `mission-dark-${i + 1}`,
    color: "blue",
    text: `Les ${PLURALS[family]} doivent être en disgrâce à la cour.`,
    condition: { type: "familyStatus", family, status: "disgrace" },
  })),
  ...QUEENS.map(([text, status, value], i): Mission => ({
    id: `mission-dark-${i + 7}`,
    color: "blue",
    text,
    condition: { type: "familiesWithStatus", status, comparator: "gte", value },
  })),
]

export const DEFAULT_MISSION_IMAGES: Record<string, string> = Object.fromEntries(
  DEFAULT_MISSIONS.map((m) => [m.id, `/cards/${m.id.replace("mission-", "MISSION_").replace("light-", "LIGHT_").replace("dark-", "DARK_")}.webp`]),
)
