import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { LANGUAGE_COOKIE, PLATFORM_LANGUAGES, resolveLanguage, type PlatformLanguage } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { requireAccount } from "@pbgo/accounts/server"
import { LanguagePicker, type LanguageOption } from "@/components/language-picker"
import { SettingsField, SettingsPage } from "@/components/settings-page"
import { TimeFormatChoice } from "@/components/time-format-choice"

export const metadata: Metadata = { title: "Language & Time settings" }

/** The tag to ask for when the language alone names more than one written form: the platform's Chinese is the simplified one. */
const ENGLISH_NAME_TAGS: Partial<Record<PlatformLanguage, string>> = { zh: "zh-Hans" }

/** The languages of the platform as the picker lists them, in the platform's order (English first): each one's name in that language, and its name in English, which the server finds so that the browser never draws a name of its own. */
function languageOptions(): LanguageOption[] {
  const english = new Intl.DisplayNames(["en"], { type: "language" })
  return PLATFORM_LANGUAGES.map((language) => ({ id: language.id, native: language.title, english: english.of(ENGLISH_NAME_TAGS[language.id] ?? language.id) ?? language.title }))
}

/**
 * The Language & Time section of the settings: the language of the platform, in the order of the site (the account's, else the cookie's, else the browser's, else English), and how the times on the member's pages are written. The time format is
 * read from the account by the pages that print a time (`timeFormat` of `Account.preferences`), which are all drawn per request.
 */
export default async function LanguageSettingsPage() {
  const account = await requireAccount("/me/settings/language")
  const demo = isDemoAccount(account)
  const [store, requestHeaders] = await Promise.all([cookies(), headers()])
  const language = resolveLanguage({ account: account.language, cookie: store.get(LANGUAGE_COOKIE)?.value, browser: requestHeaders.get("accept-language") })

  return (
    <SettingsPage title="Language & Time" description="The language you read in, and how times are written.">
      <SettingsField title="Select a language" description="Choose the language you want the site to use.">
        <LanguagePicker language={language} options={languageOptions()} />
      </SettingsField>
      <SettingsField title="Time format" description="How the times on your pages are written.">
        <TimeFormatChoice format={account.preferences.timeFormat} demo={demo} />
      </SettingsField>
    </SettingsPage>
  )
}
