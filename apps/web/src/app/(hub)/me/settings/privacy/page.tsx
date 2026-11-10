import type { Metadata } from "next"
import Link from "next/link"
import { UserBlock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { PreferenceRow } from "@/components/preference-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"
import { CONTACT } from "@/site"

export const metadata: Metadata = { title: "Data & Privacy settings" }

/**
 * The Data & Privacy section of the settings: what the other players see (the profile is public by default, and the member can hide their game history: PLT-16), the players they blocked (none can be yet: the list has its place and its empty state), and
 * their data: the Privacy Policy, and a copy of what is held on them, which is asked for by e-mail as the policy says. The choice to hide the history is kept in the account; what shows it to the other players is the profile pages (PLT-111).
 */
export default async function PrivacySettingsPage() {
  const account = await requireAccount("/me/settings/privacy")
  const demo = isDemoAccount(account)

  return (
    <SettingsPage title="Data & Privacy">
      <SettingsGroup title="Your profile">
        <PreferenceRow
          name="hideHistory"
          title="Hide my game history"
          description="The other players cannot see the games you played on your profile."
          initial={account.preferences.hideHistory}
          demo={demo}
        />
      </SettingsGroup>
      <SettingsGroup title="Blocked players">
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserBlock01Icon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No one blocked</EmptyTitle>
            <EmptyDescription>The players you block cannot write to you or invite you. They are listed here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
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
