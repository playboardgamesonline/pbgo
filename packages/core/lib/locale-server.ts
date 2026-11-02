import "server-only"
import { isPlatformLanguage } from "@pbgo/accounts/language"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { DEFAULT_LOCALE, fromAcceptLanguage, LOCALE_COOKIE, localeFor, type Locale } from "./i18n"

/**
 * Language of the visitor: remembered choice (cookie: any of the platform's twelve languages, English if the games do not have it), else the browser's language
 * (Accept-Language), else French. Same URL for everyone: the page is rendered in the language of the request. The cookie follows the visitor's account when they have
 * one (`@pbgo/accounts`), the server never reads the account itself.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const stored = (await cookies()).get(LOCALE_COOKIE)?.value
    if (isPlatformLanguage(stored)) return localeFor(stored)
    return fromAcceptLanguage((await headers()).get("accept-language"))
  } catch {
    return DEFAULT_LOCALE
  }
})
