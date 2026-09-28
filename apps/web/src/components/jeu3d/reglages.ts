"use client"

import { useControls } from "leva"
import { useSyncExternalStore } from "react"
import { boutonCopie, onglet, type OngletDebug } from "./onglets-debug"

export type Champ = string | [label: string, min: number, max: number, step: number] | [label: string, options: Record<string, unknown>]

let version = 0
const abonnes = new Set<() => void>()

export function signalerReglages() {
  version++
  abonnes.forEach((f) => f())
}

export function useVersionReglages() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => version,
    () => 0,
  )
}

export function useReglages<T extends Record<string, unknown>>(
  dossier: string,
  objet: T,
  champs: { [K in keyof T]: Champ },
  { tab = "SCENE", ordre = 0, ferme = true }: { tab?: OngletDebug; ordre?: number; ferme?: boolean } = {},
) {
  const schema = Object.fromEntries(
    (Object.keys(champs) as (keyof T & string)[]).map((cle) => {
      const champ = champs[cle]
      const onChange = (v: unknown, _chemin: string, ctx: { initial: boolean }) => {
        ;(objet as Record<string, unknown>)[cle] = v
        if (!ctx.initial) signalerReglages()
      }
      if (typeof champ === "string") return [cle, { value: objet[cle], label: champ, onChange }]
      if (champ.length === 2) return [cle, { value: objet[cle], label: champ[0], options: champ[1], onChange }]
      const [label, min, max, step] = champ
      return [cle, { value: objet[cle], label, min, max, step, onChange }]
    }),
  )
  useControls(dossier, { ...schema, ...boutonCopie(tab, dossier) } as never, { collapsed: ferme, order: ordre }, onglet(tab))
}
