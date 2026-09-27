"use client"

import { Leva, button, levaStore, useControls } from "leva"
import { useEffect, useSyncExternalStore } from "react"

const CLE = "courtisans:debug"
const abonnes = new Set<() => void>()

function lire() {
  try {
    return new URLSearchParams(window.location.search).has("debug") || localStorage.getItem(CLE) === "1"
  } catch {
    return false
  }
}

function basculer() {
  try {
    localStorage.setItem(CLE, lire() ? "0" : "1")
    const url = new URL(window.location.href)
    if (url.searchParams.has("debug")) {
      url.searchParams.delete("debug")
      window.history.replaceState(null, "", url)
    }
  } catch {}
  abonnes.forEach((f) => f())
}

function copierTout() {
  const donnees = levaStore.getData() as Record<string, { type?: string; value?: unknown }>
  const valeurs: Record<string, unknown> = {}
  for (const [chemin, entree] of Object.entries(donnees)) {
    if (!entree || entree.type === "BUTTON" || entree.value === undefined) continue
    valeurs[chemin] = entree.value
  }
  const texte = JSON.stringify(valeurs, null, 2)
  navigator.clipboard?.writeText(texte).catch(() => null)
  console.info("Réglages debug", valeurs)
}

export function PanneauDebug() {
  useControls({ "Copier tous les réglages": button(copierTout) })
  const actif = useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    lire,
    () => false,
  )

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "d" && !(e.target instanceof HTMLInputElement)) basculer()
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [])

  return (
    <div className="absolute top-20 right-4 z-40 w-80">
      <Leva fill hidden={!actif} collapsed={false} titleBar={{ title: "Debug · Shift+D" }} />
    </div>
  )
}
