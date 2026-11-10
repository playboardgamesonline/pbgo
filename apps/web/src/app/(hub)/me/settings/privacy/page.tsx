import type { Metadata } from "next"
import Link from "next/link"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { BlockedPlayers } from "@/components/blocked-players"
import { PreferenceRow } from "@/components/preference-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"
import { DEMO_BLOCKED } from "@/lib/demo-data"
import { socialOf } from "@/lib/social-state"
import { CONTACT } from "@/site"

export const metadata: Metadata = { title: "Data & Privacy settings" }

/**
 * The Data & Privacy section of the settings: what the other players see (the profile is public by default, and the member can hide their game history: PLT-16), the players they blocked (PLT-23: each with the button that lifts the block, read on the server, and the empty state), and
 * their data: the Privacy Policy, and a copy of what is held on them, which is asked for by e-mail as the policy says. The choice to hide the history is kept in the account and copied to the member's profile (PLT-39): the public profile then shows other players no games, records or ranks.
 */
export default async function PrivacySettingsPage() {
  const account = await requireAccount("/me/settings/privacy")
  const demo = isDemoAccount(account)
  const blocked = demo ? DEMO_BLOCKED : ((await socialOf(account))?.blocked ?? [])

  return (
    <SettingsPage title="Data & Privacy">
      <SettingsGroup title="Your profile">
        <PreferenceRow
          name="hideHistory"
          title="Hide my game history"
          description="The other players cannot see your games, your records and your ranks on your profile."
          initial={account.preferences.hideHistory}
          demo={demo}
        />
      </SettingsGroup>
      <SettingsGroup title="Blocked players">
        <BlockedPlayers blocked={blocked} />
      </SettingsGroup>
      <SettingsGroup title="Your data">
        <Item>
          <ItemContent>
            <ItemTitle>Privacy Policy</ItemTitle>
            <ItemDescription>What we keep, why, for how long and who receives it.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button asChild variant="outline">
              <Link href="/legal/privacy">Read</Link>
            </Button>
          </ItemActions>
        </Item>
        <Item>
          <ItemContent>
            <ItemTitle>A copy of your data</ItemTitle>
            <ItemDescription>Ask for what we hold about you, in a usable format.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button asChild variant="outline">
              <a href={`mailto:${CONTACT}?subject=${encodeURIComponent("A copy of my data")}`}>Ask for a copy</a>
            </Button>
          </ItemActions>
        </Item>
      </SettingsGroup>
    </SettingsPage>
  )
}
