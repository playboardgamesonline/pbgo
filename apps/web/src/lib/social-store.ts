"use client"

import { useEffect, useSyncExternalStore } from "react"
import { FRIENDS_PATH, socialStateOf, type SocialState } from "@pbgo/core/lib/friends"
import { startSocialSync } from "@pbgo/core/lib/social-sync"

// The social state of the signed-in member in the browser (PLT-23): their friends with their presence, the requests that came in and went out, the members they blocked. One store for the whole page, which the panel of the navbar, the pages of the friends,
// the settings and the buttons of a profile all read, so that an answer given in one is seen in the others at once. It asks `GET /api/hub/friends` when the first of them is on the page and then every 20 s while a tab is in view (`startSocialSync`), and
// the page asks for another read after each change it makes (`refreshSocial`). The state is of one account: a page that shows another one starts from nothing.

let owner: string | null = null
let state: SocialState | null = null
let kept = ""
let users = 0
let sync: ReturnType<typeof startSocialSync> | null = null
const listeners = new Set<() => void>()

const tell = () => {
  for (const listener of listeners) listener()
}

/** Keeps a state that the server gave, and tells whoever shows it: a read that says what the page already has changes nothing, so a panel is not drawn again every 20 s for no reason. */
function keep(next: SocialState) {
  const text = JSON.stringify(next)
  if (text === kept) return
  kept = text
  state = next
  tell()
}

/** Reads the state once, for the account that asked: the answer of an account that is not the page's any more is thrown away. */
async function load(id: string): Promise<boolean> {
  try {
    const response = await fetch(FRIENDS_PATH, { cache: "no-store" })
    if (!response.ok) return false
    const next = socialStateOf(await response.json().catch(() => null))
    if (!next) return false
    if (owner === id) keep(next)
    return owner === id
  } catch {
    return false
  }
}

/** One more user of the state of this account: the first starts reading it, the last stops. Returns what lets go. */
function acquire(id: string): () => void {
  if (owner !== id) {
    sync?.stop()
    sync = null
    owner = id
    state = null
    kept = ""
    users = 0
    tell()
  }
  users += 1
  if (!sync) {
    sync = startSocialSync({
      load: () => load(id),
      visible: () => document.visibilityState === "visible",
      onVisible: (callback) => {
        const listener = () => {
          if (document.visibilityState === "visible") callback()
        }
        document.addEventListener("visibilitychange", listener)
        return () => document.removeEventListener("visibilitychange", listener)
      },
    })
  }
  return () => {
    if (owner !== id) return
    users -= 1
    if (users <= 0) {
      sync?.stop()
      sync = null
      users = 0
    }
  }
}

/** Reads the state now, after a change the member made: what the panel and the pages show is then the server's, whatever the change was. Nothing when no page shows the state. */
export function refreshSocial(): void {
  sync?.refresh()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The state the store holds right now, for what is not about an account of its own: the toast of a request that was sent looks in it for the picture of the member the request went to. Null until a read. */
export function useSocialRead(): SocialState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  )
}

/**
 * The social state of the account `id`, kept fresh while the component is on the page: null until it is read (`initial`, when the page has read it already on the server, is shown meanwhile), and always null for no account (`id` null: a guest, or the
 * demo account of development, whose friends the browser makes up).
 */
export function useSocialState(id: string | null, initial?: SocialState | null): SocialState | null {
  const current = useSyncExternalStore(
    subscribe,
    () => (id !== null && owner === id ? state : null),
    () => null,
  )
  useEffect(() => (id === null ? undefined : acquire(id)), [id])
  return id === null ? null : (current ?? initial ?? null)
}
