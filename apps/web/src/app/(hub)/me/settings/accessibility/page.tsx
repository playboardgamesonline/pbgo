import type { Metadata } from "next"
import { cookies } from "next/headers"
import { DISPLAY_SETTINGS, displayChoiceOf } from "@pbgo/accounts/display"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { ReduceMotionRow } from "@/components/choice-rows"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Accessibility settings" }

/**
 * The Accessibility section of the settings: what makes the site easier to use, for now how it moves. The choice is kept on the account and mirrored on each device by a cookie, which the head of every page reads before it paints
 * (`DISPLAY_SCRIPT`); the demo account of development keeps nothing, so its row starts from that cookie.
 */
export default async function AccessibilitySettingsPage() {
  const account = await requireAccount("/me/settings/accessibility")
  const demo = isDemoAccount(account)
  const store = await cookies()
  const choice = demo ? displayChoiceOf(store.get(DISPLAY_SETTINGS.reduceMotion.cookie)?.value) : account.preferences.reduceMotion

  return (
    <SettingsPage title="Accessibility">
      <SettingsGroup title="Motion">
        <ReduceMotionRow choice={choice} demo={demo} />
      </SettingsGroup>
    </SettingsPage>
  )
}
