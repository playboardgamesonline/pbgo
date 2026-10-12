import "server-only"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { DEFAULT_LOCALE, fromAcceptLanguage, isLocale, LOCALE_COOKIE, type Locale } from "./i18n"

/**
 * Language of the visitor: remembered choice (cookie), else the browser's language (Accept-Language), else French.
 * Same URL for everyone: the page is rendered in the language of the request.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const stored = (await cookies()).get(LOCALE_COOKIE)?.value
    if (isLocale(stored)) return stored
    return fromAcceptLanguage((await headers()).get("accept-language"))
  } catch {
    return DEFAULT_LOCALE
  }
})
