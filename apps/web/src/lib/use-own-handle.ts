"use client"

import { useEffect, useSyncExternalStore } from "react"
import { ownHandleOf, type Account, type OwnHandle } from "@pbgo/accounts"
import { DEMO_TAG, isDemoAccount } from "@pbgo/accounts/demo"

// The member's own tag in the browser (PLT-39). The session has the name but not the tag, so the account menu and the panel head ask `GET /api/hub/profile` once per page.
// The answer is kept in `sessionStorage` for the next pages of the tab, so a page does not paint the name and then the tag. One store serves the menu, the panel head and the Edit profile window.

const handles = new Map<string, OwnHandle>()
const asked = new Set<string>()
const listeners = new Set<() => void>()

const keyOf = (id: string): string => `pbgo:handle:${id}`

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** What an earlier page of this tab kept, if it is a handle. The storage can be blocked, and holds what anyone wrote: nothing is taken for granted. */
function keptFor(id: string): OwnHandle | null {
  try {
    return ownHandleOf(JSON.parse(sessionStorage.getItem(keyOf(id)) ?? "null"))
  } catch {
    return null
  }
}

/** The handle of the member as this page knows it now: told by the server, else kept by an earlier page. */
function current(id: string): OwnHandle | null {
  if (!handles.has(id)) {
    const kept = keptFor(id)
    if (kept) handles.set(id, kept)
  }
  return handles.get(id) ?? null
}

/** Keeps the handle of a member for this page and the next ones of the tab, and tells whoever shows it. The Edit profile window calls it with what the member has just saved. */
export function rememberOwnHandle(id: string, handle: OwnHandle): void {
  handles.set(id, handle)
  try {
    sessionStorage.setItem(keyOf(id), JSON.stringify(handle))
  } catch {
    // A blocked storage only costs the next page a moment with the name alone
  }
  for (const listener of listeners) listener()
}

/** Asks the server for the member's handle, once for this page. A refusal or a network failure leaves what is known as it is and lets the next page ask again. */
async function load(id: string): Promise<void> {
  if (asked.has(id)) return
  asked.add(id)
  try {
    const response = await fetch("/api/hub/profile", { cache: "no-store" })
    const handle = response.ok ? ownHandleOf(await response.json()) : null
    if (handle) rememberOwnHandle(id, handle)
    else asked.delete(id)
  } catch {
    asked.delete(id)
  }
}

/**
 * The signed-in member's own handle: the profile's nickname and the tag (null while unknown, or without a profile: the name stands alone). The demo account has a made-up one and asks nothing.
 */
export function useOwnHandle(account: Pick<Account, "id" | "nickname">): OwnHandle | null {
  const id = account.id
  const handle = useSyncExternalStore(
    subscribe,
    () => current(id),
    () => null,
  )
  useEffect(() => {
    if (isDemoAccount({ id })) rememberOwnHandle(id, { nickname: account.nickname, tag: DEMO_TAG })
    else void load(id)
  }, [id, account.nickname])
  return handle
}
