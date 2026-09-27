import "server-only"
import type { Condition, Famille, Mission, Role } from "@courtisans/engine"
import { getCatalogue } from "@/sanity/catalogue"

type ConditionSanity = {
  type?: string
  famille?: string
  statut?: string
  filtreFamille?: string
  filtreRole?: string
  niveau?: string
  comparateur?: string
  valeur?: number
  adversaire?: string
  mode?: string
  conditions?: ConditionSanity[]
}

function filtre(c: ConditionSanity) {
  return {
    ...(c.filtreFamille ? { famille: c.filtreFamille as Famille } : {}),
    ...(c.filtreRole ? { role: c.filtreRole as Role | "sansRole" } : {}),
  }
}

export function versCondition(c: ConditionSanity): Condition {
  const comparateur = (c.comparateur ?? "gte") as Extract<Condition, { comparateur: unknown }>["comparateur"]
  const mode = (c.mode ?? "cartes") as "cartes" | "poids"
  switch (c.type) {
    case "statutFamille":
      return { type: "statutFamille", famille: c.famille as Famille, statut: c.statut as "lumiere" }
    case "nombreFamillesStatut":
      return { type: "nombreFamillesStatut", statut: c.statut as "lumiere", comparateur, valeur: c.valeur ?? 0 }
    case "nombreCartesDomaine":
      return { type: "nombreCartesDomaine", filtre: filtre(c), comparateur, valeur: c.valeur ?? 0, mode }
    case "nombreCartesTable":
      return {
        type: "nombreCartesTable",
        filtre: filtre(c),
        comparateur,
        valeur: c.valeur ?? 0,
        mode,
        ...(c.niveau ? { niveau: c.niveau as "haut" | "bas" } : {}),
      }
    case "comparaisonJoueurs":
      return { type: "comparaisonJoueurs", filtre: filtre(c), comparateur, adversaire: c.adversaire as "voisinGauche", mode }
    case "et":
    case "ou":
      return { type: c.type, conditions: (c.conditions ?? []).map(versCondition) }
    case "non":
      return { type: "non", condition: versCondition(c.conditions?.[0] ?? {}) }
    default:
      throw new Error(`Condition inconnue : ${c.type}`)
  }
}

export const MISSIONS_PROVISOIRES: Mission[] = [
  { id: "provisoire-b1", couleur: "bleue", texte: "Au moins 2 familles doivent être en disgrâce à la cour.", condition: { type: "nombreFamillesStatut", statut: "disgrace", comparateur: "gte", valeur: 2 } },
  { id: "provisoire-b2", couleur: "bleue", texte: "Les lièvres doivent être en disgrâce à la cour.", condition: { type: "statutFamille", famille: "lievre", statut: "disgrace" } },
  { id: "provisoire-b3", couleur: "bleue", texte: "Au moins 2 familles doivent être dans la lumière.", condition: { type: "nombreFamillesStatut", statut: "lumiere", comparateur: "gte", valeur: 2 } },
  { id: "provisoire-b4", couleur: "bleue", texte: "Les cerfs doivent être dans la lumière.", condition: { type: "statutFamille", famille: "cerf", statut: "lumiere" } },
  { id: "provisoire-b5", couleur: "bleue", texte: "Au moins une famille doit être neutre.", condition: { type: "nombreFamillesStatut", statut: "neutre", comparateur: "gte", valeur: 1 } },
  { id: "provisoire-w1", couleur: "blanche", texte: "Vous devez posséder moins de papillons que votre voisin de gauche.", condition: { type: "comparaisonJoueurs", filtre: { famille: "papillon" }, comparateur: "lt", adversaire: "voisinGauche" } },
  { id: "provisoire-w2", couleur: "blanche", texte: "Vous devez posséder plus de carpes que votre voisin de droite.", condition: { type: "comparaisonJoueurs", filtre: { famille: "carpe" }, comparateur: "gt", adversaire: "voisinDroite" } },
  { id: "provisoire-w3", couleur: "blanche", texte: "Vous devez posséder au moins 3 crapauds.", condition: { type: "nombreCartesDomaine", filtre: { famille: "crapaud" }, comparateur: "gte", valeur: 3 } },
  { id: "provisoire-w4", couleur: "blanche", texte: "Vous devez posséder au moins 2 gardes.", condition: { type: "nombreCartesDomaine", filtre: { role: "garde" }, comparateur: "gte", valeur: 2 } },
  { id: "provisoire-w5", couleur: "blanche", texte: "Vous ne devez posséder aucun rossignol.", condition: { type: "nombreCartesDomaine", filtre: { famille: "rossignol" }, comparateur: "eq", valeur: 0 } },
]

export async function chargerMissions(nombreJoueurs: number): Promise<Mission[]> {
  try {
    const { missions } = await getCatalogue()
    const converties = missions.flatMap((m) => {
      try {
        return [{ id: m._id, couleur: m.couleur as Mission["couleur"], texte: m.texte ?? "", condition: versCondition(m.condition as ConditionSanity) }]
      } catch {
        return []
      }
    })
    const assez = (couleur: Mission["couleur"]) => converties.filter((m) => m.couleur === couleur).length >= nombreJoueurs
    if (assez("blanche") && assez("bleue")) return converties
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
  }
  return MISSIONS_PROVISOIRES
}
