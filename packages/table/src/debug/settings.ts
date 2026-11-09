"use client"

import { useSyncExternalStore } from "react"
import { copyButton, type DebugTab } from "@pbgo/core/components/game/debug-controls"
import { useDebugFolder } from "@pbgo/core/components/game/debug-folders"

/** What a knob of the debug panel is, for one field of a settings object: a label alone, a label with the least, the greatest and the step of a number, or a label with the choices */
export type Field = string | [label: string, min: number, max: number, step: number] | [label: string, options: Record<string, unknown> | readonly string[]]

let version = 0
const subscribers = new Set<() => void>()

/** Says that a setting changed. A knob does it by itself; do it after changing a settings object by hand */
export function notifySettings() {
  version++
  subscribers.forEach((f) => f())
}

/** Calls `listener` each time a setting changes. Returns what stops it */
export function subscribeSettings(listener: () => void) {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

/**
 * A number that changes each time a knob of the debug panel moves. A frame reads a setting on its own, but a layout computed in a `useMemo` does not: it lists this number
 * among its dependencies, or it stays as it was. A component that binds a folder with `useSettings` re-renders on it already.
 */
export function useSettingsVersion() {
  return useSyncExternalStore(
    subscribeSettings,
    () => version,
    () => 0,
  )
}

/** The input of one field: it starts at the object's value, and a move of the knob writes the new value into the object */
function input(object: Record<string, unknown>, key: string, field: Field) {
  const onChange = (value: unknown, _route: string, context: { initial: boolean }) => {
    object[key] = value
    if (!context.initial) notifySettings()
  }
  if (typeof field === "string") return { value: object[key], label: field, onChange }
  if (field.length === 2) return { value: object[key], label: field[0], options: field[1], onChange }
  const [label, min, max, step] = field
  return { value: object[key], label, min, max, step, onChange }
}

/** The inputs of the fields listed, in that order, bound to `object` */
export function inputs<T extends Record<string, unknown>>(object: T, fields: { [K in keyof T]?: Field }) {
  return Object.fromEntries((Object.keys(fields) as (keyof T & string)[]).map((key) => [key, input(object, key, fields[key] as Field)]))
}

/** What a folder holds when it is bound to an object: its inputs, then a "Copy values" button for the folder */
export function settingsSchema<T extends Record<string, unknown>>(folder: string, tab: DebugTab, object: T, fields: { [K in keyof T]?: Field }) {
  return { ...inputs(object, fields), ...copyButton(tab, folder) }
}

/**
 * Binds a settings object to a folder of the debug panel: `fields` says which of its keys get a knob and how, in that order. Moving a knob writes the value into the object, which a frame
 * reads on its own. Every folder has a "Copy values" button that copies it as JSON, to paste back as the defaults in code. Bind a stable object (a constant of the game): the knobs are
 * made once, from the object as it is when the component mounts.
 *
 * Nothing here loads leva: the folder is written down, and the panel draws it when it is there. On the production deployment there is no panel, and this does nothing but follow the knobs.
 */
export function useSettings<T extends Record<string, unknown>>(
  folder: string,
  object: T,
  fields: { [K in keyof T]?: Field },
  { tab = "SCENE", order = 0, closed = true }: { tab?: DebugTab; order?: number; closed?: boolean } = {},
) {
  // The component re-renders when a knob moves, so what it computes from the object follows
  useSettingsVersion()
  useDebugFolder({ folder, tab, order, closed, schema: () => settingsSchema(folder, tab, object, fields) })
}
