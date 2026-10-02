import { button, levaStore } from "leva"

type Store = typeof levaStore
const Store = levaStore.constructor as new () => Store

export const roundValue = (_key: string, v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)

export const DEBUG_TABS = ["GAME", "SCENE", "TRANSITION"] as const
export type DebugTab = (typeof DEBUG_TABS)[number]

export const DEBUG_STORES: Record<DebugTab, Store> = {
  GAME: levaStore,
  SCENE: new Store(),
  TRANSITION: new Store(),
}

export const debugTab = (name: DebugTab) => ({ store: DEBUG_STORES[name] })

export function copyFolder(name: DebugTab, folder: string) {
  const payload = DEBUG_STORES[name].getData() as Record<string, { type?: string; value?: unknown }>
  const values: Record<string, unknown> = {}
  for (const [route, entry] of Object.entries(payload)) {
    if (!route.startsWith(`${folder}.`) || !entry || entry.type === "BUTTON" || entry.value === undefined) continue
    values[route.slice(folder.length + 1)] = entry.value
  }
  const text = JSON.stringify({ [folder]: values }, roundValue, 2)
  navigator.clipboard?.writeText(text).catch(() => null)
  console.info(text)
}

/** Toujours en dernier dans son dossier (order élevé), même quand plusieurs useControls alimentent le même dossier. */
export const COPY_ORDER = 10000
export const copyValuesButton = (onClick: (get: (path: string) => unknown) => void) => ({ "Copy values": { ...button(onClick as never), order: COPY_ORDER } })
export const copyButton = (name: DebugTab, folder: string) => copyValuesButton(() => copyFolder(name, folder))
