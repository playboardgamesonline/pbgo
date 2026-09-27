"use client"

import type { VueJoueur } from "@courtisans/engine"
import { useEffect, useRef } from "react"
import { jouerSon } from "@/lib/son"
import type { EtatFin } from "./fin"

export function useSonsJeu(vue: VueJoueur, fin: EtatFin | null, selectionId: string | null, missionFocus: string | null) {
  const longueur = useRef(vue.journal.length)
  useEffect(() => {
    const nouveaux = vue.journal.slice(longueur.current)
    longueur.current = vue.journal.length
    let t = 0
    for (const e of nouveaux) {
      if (e.type === "carteJouee") {
        jouerSon("glisse", { delai: t })
        jouerSon("pose", { delai: t + 0.95 })
        if (e.carte.role === "assassin") jouerSon("assassin", { delai: t + 1.05 })
        t += 0.15
      } else if (e.type === "carteEliminee") {
        jouerSon("elimine", { delai: t + 1.2 })
      } else if (e.type === "pioche") {
        for (let i = 0; i < e.nombre; i++) jouerSon("glisse", { delai: t + 0.35 + i * 0.28, volume: 0.8 })
      }
    }
  }, [vue.journal])

  const monTour = vue.phase === "jeu" && !!vue.moi && vue.joueurActifId === vue.moi.id
  useEffect(() => {
    if (monTour) jouerSon("tour", { delai: 0.9 })
  }, [monTour])

  useEffect(() => {
    if (selectionId) jouerSon("selection")
  }, [selectionId])

  useEffect(() => {
    if (missionFocus) jouerSon("revele")
  }, [missionFocus])

  const precedent = useRef<EtatFin | null>(null)
  useEffect(() => {
    const avant = precedent.current
    precedent.current = fin
    if (!fin) return
    if (fin.espionsTable === "retourne" && avant?.espionsTable !== "retourne") for (let i = 0; i < 4; i++) jouerSon("revele", { delai: i * 0.09 })
    if (fin.familles > (avant?.familles ?? 0)) jouerSon("pose", { volume: 0.8 })
    if (fin.domaines && !avant?.domaines) for (let i = 0; i < 4; i++) jouerSon("revele", { delai: i * 0.09 })
    if (fin.pile > (avant?.pile ?? 0)) jouerSon("clic", { volume: 1.4 })
    if (fin.missions && !avant?.missions) jouerSon("mission")
    if (fin.texte && !avant?.texte) jouerSon("victoire")
  }, [fin])
}
