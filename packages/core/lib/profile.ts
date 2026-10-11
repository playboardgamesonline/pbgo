"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useGameSlug } from "./binding-context"

export type Profile = { nickname: string }

const listeners = new Set<() => void>()
/** Copy kept in memory when localStorage is unavailable (private browsing), per key. */
const memory = new Map<string, string>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener("storage", callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", callback)
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function persist(key: string, value: string) {
  memory.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {}
  listeners.forEach((l) => l())
}

/** Profile of the visitor (nickname), remembered per game: `<slug>:profile`. */
export function useProfile() {
  const key = `${useGameSlug()}:profile`
  const getSnapshot = useCallback(() => read(key), [key])
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, getSnapshot, () => undefined)

  const profile = useMemo<Profile>(() => {
    let stored: Partial<Profile> = {}
    try {
      stored = raw ? (JSON.parse(raw) as Partial<Profile>) : {}
    } catch {}
    return { nickname: stored.nickname ?? "" }
  }, [raw])

  const setProfile = useCallback((patch: Partial<Profile>) => persist(key, JSON.stringify({ ...profile, ...patch })), [key, profile])

  return { profile, setProfile, ready: raw !== undefined, valid: profile.nickname.trim().length > 0 }
}
