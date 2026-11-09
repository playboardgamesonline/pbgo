import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { LANGUAGE_COOKIE, resolveLanguage } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { LanguageRow } from "@/components/language-row"
import { SettingsGroup, SettingsPage } from "@/components/settings-page"
import { TimeFormatRow } from "@/components/choice-rows"

export const metadata: Metadata = { title: "Language & time settings" }

/**
 * The Language & time section of the settings: the language of the platform, in the order of the site (the account's, else the cookie's, else the browser's, else English), and how the times on the member's pages are written. The time format is
 * read from the account by the pages that print a time (`timeFormat` of `Account.preferences`), which are all drawn per request.
 */
export default async function LanguageSettingsPage() {
  const account = await requireAccount("/me/settings/language")
  const demo = isDemoAccount(account)
  const [store, requestHeaders] = await Promise.all([cookies(), headers()])
  const language = resolveLanguage({ account: account.language, cookie: store.get(LANGUAGE_COOKIE)?.value, browser: requestHeaders.get("accept-language") })

  return (
    <SettingsPage title="Language & time" description="The language you read in, and how times are written.">
      <SettingsGroup title="Preferences">
        <LanguageRow language={language} />
        <TimeFormatRow format={account.preferences.timeFormat} demo={demo} />
      </SettingsGroup>
    </SettingsPage>
  )
}
