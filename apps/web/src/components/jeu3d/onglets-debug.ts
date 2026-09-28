import { levaStore } from "leva"

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
