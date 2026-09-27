import "server-only"
import type { Condition, Famille, Mission, Role } from "@courtisans/engine"
import { MISSIONS_PAR_DEFAUT } from "@/lib/missions-par-defaut"
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

export const MISSIONS_PROVISOIRES: Mission[] = MISSIONS_PAR_DEFAUT

export async function chargerMissions(nombreJoueurs: number): Promise<Mission[]> {
  let depuisSanity: Mission[] = []
  try {
    const { missions } = await getCatalogue()
    depuisSanity = missions.flatMap((m) => {
      try {
        return [{ id: m._id, couleur: m.couleur as Mission["couleur"], texte: m.texte ?? "", condition: versCondition(m.condition as ConditionSanity) }]
      } catch {
        return []
      }
    })
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
  }

  return (["blanche", "bleue"] as const).flatMap((couleur) => {
    const valides = depuisSanity.filter((m) => m.couleur === couleur)
    const textes = new Set(valides.map((m) => m.texte))
    const complements = MISSIONS_PROVISOIRES.filter((m) => m.couleur === couleur && !textes.has(m.texte))
    return [...valides, ...complements.slice(0, Math.max(0, nombreJoueurs - valides.length))]
  })
}
