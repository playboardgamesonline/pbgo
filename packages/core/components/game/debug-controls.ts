import { createElement, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react"
import type * as Leva from "leva"

/**
 * Leva-free entry point for the debug tools.
 *
 * Exposes the same `useControls` / `button` API as leva, but leva itself is only loaded (dynamic import of
 * `./debug-tools`) when debugging: `?debug` in the URL, `localStorage["game:debug"] === "1"`, Shift+D, or
 * a development build. Until then `useControls` returns the schema defaults without touching leva, so
 * production bundles that only import this module ship neither leva nor the debug panels.
 *
 * Hooks cannot switch implementation in place: a component tree using these controls must remount
 * once the tools are loaded (key it on `useDebugTools()`).
 * Importing `./debug-tabs` (which imports leva statically) registers the tools immediately.
 */

type LevaModule = typeof Leva
type Store = typeof Leva.levaStore

export const DEBUG_TABS = ["GAME", "SCENE", "TRANSITION"] as const
export type DebugTab = (typeof DEBUG_TABS)[number]

export const roundValue = (_key: string, v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)

/** Always last in its folder (high order), even when several useControls feed the same folder. */
export const COPY_ORDER = 10000

type Tools = { leva: LevaModule; stores: Record<DebugTab, Store>; Panel?: ComponentType }
let tools: Tools | null = null
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach((f) => f())
const subscribe = (f: () => void) => {
  subscribers.add(f)
  return () => {
    subscribers.delete(f)
  }
}

/** Called by `./debug-tabs` as soon as leva is evaluated. */
export function registerDebugTools(leva: LevaModule, stores: Record<DebugTab, Store>) {
  if (tools) return
  tools = { leva, stores }
  notify()
}

let loading: Promise<void> | null = null

/** Loads leva and the debug panel (separate chunk). Idempotent. */
export function loadDebugTools() {
  if (tools?.Panel) return Promise.resolve()
  loading ??= import("./debug-tools")
    .then((m) => {
      tools = { ...(tools ?? { leva: m.leva, stores: m.DEBUG_STORES }), Panel: m.DebugPanel }
      notify()
    })
    .catch((e) => {
      loading = null
      console.error(e)
    })
  return loading
}

// Debug flag: ?debug in the URL or localStorage, toggled with Shift+D.
const STORAGE_KEY = "game:debug"

export function isDebugRequested() {
  try {
    return new URLSearchParams(window.location.search).has("debug") || localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function toggleDebug() {
  try {
    localStorage.setItem(STORAGE_KEY, isDebugRequested() ? "0" : "1")
    const url = new URL(window.location.href)
    if (url.searchParams.has("debug")) {
      url.searchParams.delete("debug")
      window.history.replaceState(null, "", url)
    }
  } catch {}
  if (isDebugRequested()) loadDebugTools()
  notify()
}

export function useDebugRequested() {
  return useSyncExternalStore(subscribe, isDebugRequested, () => false)
}

let shortcutUsers = 0
const onKey = (e: KeyboardEvent) => {
  if (e.shiftKey && e.key.toLowerCase() === "d" && !(e.target instanceof HTMLInputElement)) toggleDebug()
}

/** Shift+D toggles debug mode. One window listener, however many components use it. */
export function useDebugShortcut() {
  useEffect(() => {
    if (shortcutUsers++ === 0) window.addEventListener("keydown", onKey)
    return () => {
      if (--shortcutUsers === 0) window.removeEventListener("keydown", onKey)
    }
  }, [])
}

/**
 * true once leva is available. Loads it when debug mode is requested (or in development) and listens to Shift+D.
 * Use the result as a `key` on the tree that calls `useControls`, so it remounts with the real controls.
 */
export function useDebugTools() {
  useDebugShortcut()
  const ready = useSyncExternalStore(subscribe, () => !!tools, () => false)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isDebugRequested()) loadDebugTools()
  }, [])
  return ready
}

/** The debug panel (tabs + leva), rendered only once the tools are loaded. */
export function DebugSlot() {
  const Panel = useSyncExternalStore(subscribe, () => tools?.Panel ?? null, () => null)
  useDebugShortcut()
  return Panel ? createElement(Panel) : null
}

// leva-compatible API

const BUTTON = Symbol("debug-button")
type Button = { [BUTTON]: true }

export const button: LevaModule["button"] = ((onClick: unknown, settings?: unknown) =>
  tools ? tools.leva.button(onClick as never, settings as never) : ({ [BUTTON]: true } satisfies Button)) as never

function defaultValue(entry: unknown): { value: unknown } | null {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return { value: entry }
  const input = entry as Record<string | symbol, unknown>
  if (input[BUTTON] || input.type === "BUTTON") return null
  if ("value" in input) return { value: input.value }
  if ("options" in input) {
    const options = input.options
    return { value: Array.isArray(options) ? options[0] : Object.values(options as object)[0] }
  }
  return { value: entry }
}

function defaults(schema: unknown) {
  const values: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries((typeof schema === "function" ? schema() : schema) as object)) {
    const d = defaultValue(entry)
    if (d) values[key] = d.value
  }
  return values
}

const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])))

/** Without leva: the schema defaults, stable until `deps` change (like leva). */
function useDefaultControls(...args: unknown[]) {
  const [first, second] = args
  const schema = typeof first === "string" ? second : first
  const deps = args.slice(1).find((a) => Array.isArray(a)) as unknown[] | undefined
  const memo = useRef<{ deps: unknown[] | undefined; values: Record<string, unknown> } | null>(null)
  if (!memo.current || !sameDeps(memo.current.deps, deps)) memo.current = { deps, values: defaults(schema) }
  const values = memo.current.values
  if (typeof schema !== "function") return values
  return [values, () => {}, (path: string) => values[path]]
}

export const useControls: LevaModule["useControls"] = ((...args: unknown[]) => {
  // The implementation is chosen once per mount, so the hooks called never change (see useDebugTools).
  const [leva] = useState(() => tools?.leva ?? null)
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `leva` is constant for the lifetime of the component
  return leva ? (leva.useControls as (...a: unknown[]) => unknown)(...args) : useDefaultControls(...args)
}) as never

export const debugTab = (name: DebugTab) => ({ store: tools?.stores[name] as Store })

export function copyFolder(name: DebugTab, folder: string) {
  if (!tools) return
  const payload = tools.stores[name].getData() as Record<string, { type?: string; value?: unknown }>
  const values: Record<string, unknown> = {}
  for (const [route, entry] of Object.entries(payload)) {
    if (!route.startsWith(`${folder}.`) || !entry || entry.type === "BUTTON" || entry.value === undefined) continue
    values[route.slice(folder.length + 1)] = entry.value
  }
  const text = JSON.stringify({ [folder]: values }, roundValue, 2)
  navigator.clipboard?.writeText(text).catch(() => null)
  console.info(text)
}

export const copyValuesButton = (onClick: (get: (path: string) => unknown) => void) => ({ "Copy values": { ...button(onClick as never), order: COPY_ORDER } })
export const copyButton = (name: DebugTab, folder: string) => copyValuesButton(() => copyFolder(name, folder))
