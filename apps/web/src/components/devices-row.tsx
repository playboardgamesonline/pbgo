"use client"

import { useState, useSyncExternalStore } from "react"
import { describeDevice, deviceLabel } from "@pbgo/accounts"
import { signOutOtherDevices } from "@pbgo/accounts/client"
import { Alert, AlertDescription } from "@pbgo/ui/platform/alert"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Spinner } from "@pbgo/ui/platform/spinner"
import { toast } from "@pbgo/ui/platform/sonner"
import { changing, failureOf } from "@/lib/settings-change"

// The user agent is the browser's: the server does not know it, and nothing here asks it to render the same on both sides, so the first paint (the server's and the browser's first) says "This browser" and the name comes right after
const subscribeToNothing = () => () => {}
const readUserAgent = () => navigator.userAgent
const readNoUserAgent = () => ""

/**
 * The devices of the account: the one the member is on, named as far as its browser says (`describeDevice`: "Chrome on macOS"), and a button that signs them out of all the others (`signOutOtherDevices`: Supabase Auth ends their other
 * sessions, which stop at their next renewal, an hour at most). A list of every session, with where and when, needs the sessions of the project's Auth, which the browser cannot read: it waits for a function of the database (`docs/accounts.md`).
 */
export function DevicesRow({ demo }: { demo: boolean }) {
  const userAgent = useSyncExternalStore(subscribeToNothing, readUserAgent, readNoUserAgent)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOutOthers() {
    setPending(true)
    setError(null)
    const outcome = await changing(demo, signOutOtherDevices)
    setPending(false)
    const failure = failureOf(outcome)
    if (failure) setError(failure)
    else toast.success("Signed out of your other devices")
  }

  return (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Item>
        <ItemContent>
          <ItemTitle>{userAgent ? deviceLabel(describeDevice(userAgent)) : "This browser"}</ItemTitle>
          <ItemDescription>You are signed in here.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="secondary">This device</Badge>
        </ItemActions>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Other devices</ItemTitle>
          <ItemDescription>Sign out of your account everywhere else.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" disabled={pending} onClick={signOutOthers}>
            {pending && <Spinner />}
            Sign out
          </Button>
        </ItemActions>
      </Item>
    </>
  )
}
