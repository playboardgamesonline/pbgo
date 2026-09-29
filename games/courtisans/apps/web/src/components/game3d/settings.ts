"use client"

import { useControls } from "leva"
import { useSyncExternalStore } from "react"
import { copyButton, debugTab, type DebugTab } from "@pgo/core/components/game/debug-tabs"

export type Field = string | [label: string, min: number, max: number, step: number] | [label: string, options: Record<string, unknown>]

let version = 0
const listeners = new Set<() => void>()

export function notifySettings() {
  version++
  listeners.forEach((f) => f())
}

export function useSettingsVersion() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => version,
    () => 0,
  )
}

export function useSettings<T extends Record<string, unknown>>(
  folder: string,
  object: T,
  fields: { [K in keyof T]: Field },
  { tab = "SCENE", order = 0, closed = true }: { tab?: DebugTab; order?: number; closed?: boolean } = {},
) {
  const schema = Object.fromEntries(
    (Object.keys(fields) as (keyof T & string)[]).map((key) => {
      const field = fields[key]
      const onChange = (v: unknown, _path: string, ctx: { initial: boolean }) => {
        ;(object as Record<string, unknown>)[key] = v
        if (!ctx.initial) notifySettings()
      }
      if (typeof field === "string") return [key, { value: object[key], label: field, onChange }]
      if (field.length === 2) return [key, { value: object[key], label: field[0], options: field[1], onChange }]
      const [label, min, max, step] = field
      return [key, { value: object[key], label, min, max, step, onChange }]
    }),
  )
  useControls(folder, { ...schema, ...copyButton(tab, folder) } as never, { collapsed: closed, order: order }, debugTab(tab))
}
