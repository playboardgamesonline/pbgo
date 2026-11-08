"use client"

import { useState, useSyncExternalStore } from "react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"

/** What the browser says of this site's right to show notifications: it has not been asked (`default`), it said yes (`granted`) or no (`denied`), or it has no notifications at all (`unsupported`). `null` while the server draws. */
type Permission = NotificationPermission | "unsupported" | null

// The permission is the browser's: the server does not know it, so the first paint is the server's (`null`) and the real answer comes right after
const subscribeToNothing = () => () => {}
const readPermission = (): Permission => (typeof Notification === "undefined" ? "unsupported" : Notification.permission)
const readNoPermission = (): Permission => null

/**
 * The Browser notifications row: whether this browser lets the site show notifications, and the way to allow them. A press on Allow asks the browser, which shows its own prompt; a refusal cannot be undone from the page, so the row says where it
 * is undone (the browser's settings for the site). What the notifications are for, and which of them the member wants, are the two rows under it (`PreferenceRow`); the notifications themselves are PLT-24.
 */
export function BrowserNotificationsRow() {
  const read = useSyncExternalStore(subscribeToNothing, readPermission, readNoPermission)
  // What the browser answered to the last press: the browser's own answer is not something the page is told about otherwise
  const [asked, setAsked] = useState<NotificationPermission | null>(null)
  const permission: Permission = asked ?? read

  async function allow() {
    setAsked(await Notification.requestPermission())
  }

  return (
    <Item>
      <ItemContent>
        <ItemTitle>Browser notifications</ItemTitle>
        <ItemDescription>
          {permission === "unsupported"
            ? "Your browser cannot show notifications."
            : permission === "denied"
              ? "Blocked. Allow notifications for this site in your browser's settings."
              : "Let this browser tell you when something waits for you, even when the tab is in the background."}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {permission === "granted" && <Badge variant="success">Allowed</Badge>}
        {permission === "default" && (
          <Button variant="outline" onClick={allow}>
            Allow
          </Button>
        )}
        {permission === "denied" && <Badge variant="destructive">Blocked</Badge>}
      </ItemActions>
    </Item>
  )
}
