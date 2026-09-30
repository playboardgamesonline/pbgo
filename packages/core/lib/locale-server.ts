import "server-only"
import { cookies, headers } from "next/headers"
import { cache } from "react"
import { DEFAULT_LOCALE, fromAcceptLanguage, isLocale, LOCALE_COOKIE, type Locale } from "./i18n"

/**
 * Langue du visiteur : choix mémorisé (cookie), sinon langue du navigateur (Accept-Language), sinon le français.
 * Même URL pour tout le monde : la page est rendue dans la langue de la requête.
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
