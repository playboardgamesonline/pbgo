import type { Famille, Mission, Role, Statut } from "@courtisans/engine"

const ORDRE: Famille[] = ["carpe", "cerf", "crapaud", "lievre", "papillon", "rossignol"]
const PLURIELS: Record<Famille, string> = { papillon: "papillons", crapaud: "crapauds", rossignol: "rossignols", lievre: "lièvres", cerf: "cerfs", carpe: "carpes" }
const ROLES: [Role, number, string][] = [
  ["espion", 3, "espions"],
  ["noble", 3, "nobles"],
  ["assassin", 2, "assassins"],
  ["garde", 4, "gardes"],
]
const REINES: [string, Statut, number][] = [
  ["Au moins 2 familles doivent être en disgrâce à la cour.", "disgrace", 2],
  ["Au moins 2 familles doivent être dans la lumière.", "lumiere", 2],
  ["Au moins 3 familles doivent être en disgrâce à la cour.", "disgrace", 3],
  ["Au moins 1 famille doit être neutre.", "neutre", 1],
]

export const MISSIONS_PAR_DEFAUT: Mission[] = [
  ...ORDRE.map((famille, i): Mission => ({
    id: `mission-light-${i + 1}`,
    couleur: "blanche",
    texte: `Vous devez posséder moins de ${PLURIELS[famille]} que votre voisin de gauche.`,
    condition: { type: "comparaisonJoueurs", filtre: { famille }, comparateur: "lt", adversaire: "voisinGauche" },
  })),
  ...ROLES.map(([role, valeur, nom], i): Mission => ({
    id: `mission-light-${i + 7}`,
    couleur: "blanche",
    texte: `Vous devez posséder au moins ${valeur} ${nom}.`,
    condition: { type: "nombreCartesDomaine", filtre: { role }, comparateur: "gte", valeur },
  })),
  ...ORDRE.map((famille, i): Mission => ({
    id: `mission-dark-${i + 1}`,
    couleur: "bleue",
    texte: `Les ${PLURIELS[famille]} doivent être en disgrâce à la cour.`,
    condition: { type: "statutFamille", famille, statut: "disgrace" },
  })),
  ...REINES.map(([texte, statut, valeur], i): Mission => ({
    id: `mission-dark-${i + 7}`,
    couleur: "bleue",
    texte,
    condition: { type: "nombreFamillesStatut", statut, comparateur: "gte", valeur },
  })),
]

export const IMAGES_MISSIONS_PAR_DEFAUT: Record<string, string> = Object.fromEntries(
  MISSIONS_PAR_DEFAUT.map((m) => [m.id, `/cards/${m.id.replace("mission-", "MISSION_").replace("light-", "LIGHT_").replace("dark-", "DARK_")}.webp`]),
)
