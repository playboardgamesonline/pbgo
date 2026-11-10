import { notFound } from "next/navigation"
import AccessibilitySettingsPage from "@/app/(hub)/me/settings/accessibility/page"
import AccountSettingsPage from "@/app/(hub)/me/settings/account/page"
import AppearanceSettingsPage from "@/app/(hub)/me/settings/appearance/page"
import BillingSettingsPage from "@/app/(hub)/me/settings/billing/page"
import LanguageSettingsPage from "@/app/(hub)/me/settings/language/page"
import NotificationSettingsPage from "@/app/(hub)/me/settings/notifications/page"
import PrivacySettingsPage from "@/app/(hub)/me/settings/privacy/page"

/** The sections of the settings by their name in the address: the pages of the settings' own address (`app/(hub)/me/settings`), drawn in the window over a game's screen. */
const SECTIONS = {
  accessibility: AccessibilitySettingsPage,
  account: AccountSettingsPage,
  appearance: AppearanceSettingsPage,
  billing: BillingSettingsPage,
  language: LanguageSettingsPage,
  notifications: NotificationSettingsPage,
  privacy: PrivacySettingsPage,
} as const

/**
 * The window over a game's screen draws the same section as the page of its own address (`app/[game]/@modal/(...)settings`: an interception needs the page it stands for, which is `(hub)/settings/[section]`). It is one page with the section for a parameter,
 * and not one page for each section as the hub's window has: Next 16 reads an interception route as dynamic by its intercepted address only, so a static address under a dynamic route (`[game]`) is matched as a static path in production, answers 404 there and
 * is prerendered by the build with a game it does not know.
 */
export default async function GameSettingsSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ steam?: string | string[] }> }) {
  const { section } = await params
  if (!Object.hasOwn(SECTIONS, section)) notFound()
  const Section = SECTIONS[section as keyof typeof SECTIONS]
  return <Section searchParams={searchParams} />
}
