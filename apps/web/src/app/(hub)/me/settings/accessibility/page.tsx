import type { Metadata } from "next"
import { cookies } from "next/headers"
import { MOTION_COOKIE, motionOf } from "@pbgo/accounts/motion"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { ReduceMotionRow } from "@/components/choice-rows"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"

export const metadata: Metadata = { title: "Accessibility & appearance settings" }

/**
 * The Accessibility & appearance section of the settings: how the site moves for the member. The choice is kept on the account and mirrored on each device by a cookie, which the head of every page reads before it paints
 * (`MOTION_SCRIPT`); the demo account of development keeps nothing, so its row starts from that cookie. The platform has one look, dark, so there is no row for a theme.
 */
export default async function AccessibilitySettingsPage() {
  const account = await requireAccount("/me/settings/accessibility")
  const demo = isDemoAccount(account)
  const store = await cookies()
  const choice = demo ? motionOf(store.get(MOTION_COOKIE)?.value) : account.preferences.reduceMotion

  return (
    <SettingsPage title="Accessibility & appearance" description="How the site moves and looks for you.">
      <SettingsGroup title="Motion">
        <ReduceMotionRow choice={choice} demo={demo} />
      </SettingsGroup>
    </SettingsPage>
  )
}
