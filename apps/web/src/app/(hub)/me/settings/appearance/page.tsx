import type { Metadata } from "next"
import { cookies } from "next/headers"
import { DISPLAY_SETTINGS, displayChoiceOf } from "@pbgo/accounts/display"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { ReduceTransparencyRow } from "@/components/choice-rows"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Appearance settings" }

/**
 * The Appearance section of the settings: how the site looks for the member. The platform has one look, dark, so there is no row for a theme; the glass of its surfaces can be made solid. The choice is kept the way the motion's is: on the
 * account, mirrored on each device by a cookie that the head of every page reads before it paints (`DISPLAY_SCRIPT`), and the demo account of development, which keeps nothing, starts its row from that cookie.
 */
export default async function AppearanceSettingsPage() {
  const account = await requireAccount("/me/settings/appearance")
  const demo = isDemoAccount(account)
  const store = await cookies()
  const choice = demo ? displayChoiceOf(store.get(DISPLAY_SETTINGS.reduceTransparency.cookie)?.value) : account.preferences.reduceTransparency

  return (
    <SettingsPage title="Appearance" description="How the site looks for you.">
      <SettingsGroup title="Transparency">
        <ReduceTransparencyRow choice={choice} demo={demo} />
      </SettingsGroup>
    </SettingsPage>
  )
}
