"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { SLUG } from "@pbgo/binding"

export type Profile = { nickname: string }

const KEY = `${SLUG}:profile`
const listeners = new Set<() => void>()
let memory: string | null = null

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
    return localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

function persist(value: string) {
  memory = value
  try {
    localStorage.setItem(KEY, value)
  } catch {}
  listeners.forEach((l) => l())
}

export function useProfile() {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, getSnapshot, () => undefined)

  const profile = useMemo<Profile>(() => {
    let stored: Partial<Profile> = {}
    try {
      stored = raw ? (JSON.parse(raw) as Partial<Profile>) : {}
    } catch {}
    return { nickname: stored.nickname ?? "" }
  }, [raw])

  const setProfile = useCallback((patch: Partial<Profile>) => persist(JSON.stringify({ ...profile, ...patch })), [profile])

  return { profile, setProfile, ready: raw !== undefined, valid: profile.nickname.trim().length > 0 }
}
