import { button, levaStore } from "leva"

type Magasin = typeof levaStore
const Magasin = levaStore.constructor as new () => Magasin

export const ONGLETS_DEBUG = ["GAME", "SCENE", "AUDIO", "TRANSITION"] as const
export type OngletDebug = (typeof ONGLETS_DEBUG)[number]

export const MAGASINS_DEBUG: Record<OngletDebug, Magasin> = {
  GAME: levaStore,
  SCENE: new Magasin(),
  AUDIO: new Magasin(),
  TRANSITION: new Magasin(),
}

export const onglet = (nom: OngletDebug) => ({ store: MAGASINS_DEBUG[nom] })

export function copierDossier(nom: OngletDebug, dossier: string) {
  const donnees = MAGASINS_DEBUG[nom].getData() as Record<string, { type?: string; value?: unknown }>
  const valeurs: Record<string, unknown> = {}
  for (const [chemin, entree] of Object.entries(donnees)) {
    if (!chemin.startsWith(`${dossier}.`) || !entree || entree.type === "BUTTON" || entree.value === undefined) continue
    valeurs[chemin.slice(dossier.length + 1)] = entree.value
  }
  const texte = JSON.stringify({ [dossier]: valeurs }, null, 2)
  navigator.clipboard?.writeText(texte).catch(() => null)
  console.info(texte)
}

export const boutonCopie = (nom: OngletDebug, dossier: string) => ({ "Copier les valeurs": button(() => copierDossier(nom, dossier)) })
