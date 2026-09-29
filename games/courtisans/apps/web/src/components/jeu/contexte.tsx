"use client"

import type { VueJoueur } from "@courtisans/engine"
import { createContext, useCallback, useContext, useMemo, useRef } from "react"
import type { CatalogueClient } from "@/lib/catalogue"
import type { PartiePublique } from "@/lib/partie-types"

type Positions = {
  enregistrer: (cle: string) => (el: HTMLElement | null) => void
  rect: (cle: string) => DOMRect | null
}

type JeuContexte = Positions & {
  catalogue: CatalogueClient
  partie: PartiePublique
  vue: VueJoueur
  pseudo: (joueurId: string) => string
  couleur: (joueurId: string) => string
}

export const COULEURS_JOUEURS = ["#a8603a", "#6f5b99", "#9c4c72", "#4f6478", "#7a5a3a"]

const Contexte = createContext<JeuContexte | null>(null)

export function JeuProvider({ catalogue, partie, vue, children }: { catalogue: CatalogueClient; partie: PartiePublique; vue: VueJoueur; children: React.ReactNode }) {
  const elements = useRef(new Map<string, HTMLElement>())
  const callbacks = useRef(new Map<string, (el: HTMLElement | null) => void>())

  const enregistrer = useCallback((cle: string) => {
    let cb = callbacks.current.get(cle)
    if (!cb) {
      cb = (el) => {
        if (el) elements.current.set(cle, el)
        else elements.current.delete(cle)
      }
      callbacks.current.set(cle, cb)
    }
    return cb
  }, [])

  const rect = useCallback((cle: string) => elements.current.get(cle)?.getBoundingClientRect() ?? null, [])

  const valeur = useMemo<JeuContexte>(
    () => ({
      catalogue,
      partie,
      vue,
      enregistrer,
      rect,
      pseudo: (id) => partie.joueurs.find((j) => j.id === id)?.pseudo ?? "?",
      couleur: (id) => COULEURS_JOUEURS[Math.max(0, partie.joueurs.findIndex((j) => j.id === id)) % COULEURS_JOUEURS.length],
    }),
    [catalogue, partie, vue, enregistrer, rect],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useJeu() {
  const ctx = useContext(Contexte)
  if (!ctx) throw new Error("useJeu hors de JeuProvider")
  return ctx
}
