"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

export type Profil = { pseudo: string; chateau: string }

const KEY = "courtisans:profil"
const listeners = new Set<() => void>()
let memoire: string | null = null

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memoire
  } catch {
    return memoire
  }
}

function ecrire(valeur: string) {
  memoire = valeur
  try {
    localStorage.setItem(KEY, valeur)
  } catch {}
  listeners.forEach((l) => l())
}

export function useProfil(chateauParDefaut: string) {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, getSnapshot, () => undefined)

  const profil = useMemo<Profil>(() => {
    let stocke: Partial<Profil> = {}
    try {
      stocke = raw ? (JSON.parse(raw) as Partial<Profil>) : {}
    } catch {}
    return { pseudo: stocke.pseudo ?? "", chateau: stocke.chateau || chateauParDefaut }
  }, [raw, chateauParDefaut])

  const setProfil = useCallback((patch: Partial<Profil>) => ecrire(JSON.stringify({ ...profil, ...patch })), [profil])

  return { profil, setProfil, pret: raw !== undefined, valide: profil.pseudo.trim().length > 0 && !!profil.chateau }
}
