"use client"

import { useSyncExternalStore } from "react"

export const LIMITES = { lacet: 0.4, inclinaison: 0.62, zoomMin: 0.72, zoomMax: 1.15 }

export const vueCamera = { lacet: 0, inclinaison: 0, zoom: 1 }

const abonnes = new Set<() => void>()
let deplacee = false
let glisse = false

function notifier() {
  const d = Math.abs(vueCamera.lacet) > 0.02 || vueCamera.inclinaison > 0.02 || Math.abs(vueCamera.zoom - 1) > 0.02
  if (d !== deplacee) {
    deplacee = d
    abonnes.forEach((f) => f())
  }
}

const borner = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function deplacerCamera(dLacet: number, dInclinaison: number) {
  vueCamera.lacet = borner(vueCamera.lacet + dLacet, -LIMITES.lacet, LIMITES.lacet)
  vueCamera.inclinaison = borner(vueCamera.inclinaison + dInclinaison, 0, LIMITES.inclinaison)
  notifier()
}

export function zoomerCamera(facteur: number) {
  vueCamera.zoom = borner(vueCamera.zoom * facteur, LIMITES.zoomMin, LIMITES.zoomMax)
  notifier()
}

export function recentrerCamera() {
  vueCamera.lacet = 0
  vueCamera.inclinaison = 0
  vueCamera.zoom = 1
  notifier()
}

export const setGlisse = (v: boolean) => {
  glisse = v
}
export const aGlisse = () => glisse

export function useCameraDeplacee() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => deplacee,
    () => false,
  )
}
