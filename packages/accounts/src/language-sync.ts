// The sync of a signed-in visitor's device with the language of their account (docs/accounts.md): what `useLanguageSync` of `./client` runs each time the browser has read the
// session. Pure apart from the effects it is handed, so that it can be tested without a browser. The hub's alone: the games' pages do not read the account.

import { isDemoAccount } from "./demo"
import { languageFromCookies, planLanguage, type LanguagePlan, type LanguageSources, type PlatformLanguage } from "./language"
import { isChangingLanguage } from "./set-language"

/** What `applyLanguage` does to the world, so that the sync can be tested without a browser. */
export type LanguageEffects = {
  /** Writes the cookie. */
  writeCookie: (language: PlatformLanguage) => void
  /** Hands the language to the account, which keeps none yet; the answer does not matter (the next sync tries again). */
  saveAccount: (language: PlatformLanguage) => void
  /** Renders the page again in the new language. */
  refresh: () => void
}

/**
 * The sync of a signed-in visitor's device with their account (`planLanguage`): the cookie is rewritten to the account's language, an account that keeps none takes the language in
 * use, and the page is rendered again when it was in another language. Writing the same thing twice does nothing, so it can run as often as the session is read.
 */
export function applyLanguage(sources: LanguageSources, effects: LanguageEffects): LanguagePlan {
  const plan = planLanguage(sources)
  if (plan.writeCookie) effects.writeCookie(plan.language)
  if (plan.writeAccount) effects.saveAccount(plan.language)
  if (plan.writeCookie && plan.refresh) effects.refresh()
  return plan
}

/** What the sync needs to know of the visitor, as `useAccount` of `./client` says it: whether the browser has read a session yet, and whose. */
export type SyncedVisitor = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; account: { id: string; language: PlatformLanguage | null } }

/**
 * The sync as `useLanguageSync` runs it, each time the browser has read the session: for a real account only. Nothing for a visitor the browser has not read yet, for a guest, for the demo
 * account of development (which keeps its language in the cookie alone) and while a change is on its way (`setLanguage` is writing the account, which the sync would otherwise read as
 * not having heard of it yet). `where` is what the browser knows of the device: its cookies and its languages.
 */
export function syncLanguage(visitor: SyncedVisitor, where: { cookies: string; languages: readonly string[] }, effects: LanguageEffects): LanguagePlan | null {
  if (visitor.status !== "signed-in" || isDemoAccount(visitor.account) || isChangingLanguage()) return null
  return applyLanguage({ account: visitor.account.language, cookie: languageFromCookies(where.cookies), browser: where.languages }, effects)
}
