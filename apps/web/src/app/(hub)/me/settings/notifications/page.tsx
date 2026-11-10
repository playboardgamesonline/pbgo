import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { BrowserNotificationsRow } from "@/components/browser-notifications-row"
import { PreferenceRow } from "@/components/preference-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"
import { NOTIFICATIONS_OPEN } from "@/site"

export const metadata: Metadata = { title: "Notification settings" }

/**
 * The Notifications section of the settings: browser notifications only, as PLT-24 decided (no e-mail, no Discord): whether this browser lets the site show them, and which of the two the member wants, a game that waits for them and an
 * invitation from a friend. The choices are kept in the account (`PreferenceRow`); the notifications themselves are shown by PLT-24. Nothing shows one yet, so the section is hidden: it has no entry in the settings and shows the 404 page
 * while `NOTIFICATIONS_OPEN` (`apps/web/src/site.ts`) is false.
 */
export default async function NotificationSettingsPage() {
  if (!NOTIFICATIONS_OPEN) notFound()
  const account = await requireAccount("/me/settings/notifications")
  const demo = isDemoAccount(account)

  return (
    <SettingsPage title="Notifications">
      <SettingsGroup title="In your browser">
        <BrowserNotificationsRow />
        <PreferenceRow name="notifyTurn" title="Your turn" description="A game is waiting for you to play." initial={account.preferences.notifyTurn} demo={demo} />
        <PreferenceRow name="notifyInvites" title="Friend invites" description="A friend invites you to a table." initial={account.preferences.notifyInvites} demo={demo} />
      </SettingsGroup>
    </SettingsPage>
  )
}
