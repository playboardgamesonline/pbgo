// The browser's side of the visitor's language that must stay light, because the games' pages load it: the one setter (`setLanguage`), used by the language pickers of the
// games and by the Language row of `/me`. It holds no Supabase code: the account is reached through `./client`, which is imported only for a visitor who holds a session,
// so a guest never loads the auth client to change a language (docs/accounts.md). The sync of a signed-in visitor's device is `./language-sync`, the hub's.

import { hasSessionCookie, languageCookie, type PlatformLanguage } from "./language"

/** What became of a change: kept on the account and on the device, on the device alone (a guest, or the demo account, which keep nothing else), or not at all because the account could not be written. */
export type LanguageChange = "account" | "device" | "failed"

let changing = 0

/** Whether a change is on its way. The sync (`./language-sync`) waits meanwhile, or it would rewrite the cookie from an account that has not heard of the change yet. */
export const isChangingLanguage = (): boolean => changing > 0

/**
 * The one way to change the language of a visitor, wherever they do it. A signed-in visitor's account is written first and the cookie only once it holds the language, so that the
 * two never disagree for longer than the request takes; a visitor with no account, and the demo account of development, keep the cookie alone. When the account cannot be written
 * nothing changes and the answer is `failed`: the cookie would be undone by the account at the next sync, which is the account winning. The caller does the rest: render the page
 * again (`router.refresh()`), set `<html lang>`, report `language_changed`.
 */
export async function setLanguage(language: PlatformLanguage): Promise<LanguageChange> {
  changing += 1
  try {
    let change: LanguageChange = "device"
    if (hasSessionCookie(document.cookie)) {
      const { saveLanguage } = await import("./client")
      const saved = await saveLanguage(language)
      if (saved === "failed") return "failed"
      if (saved === "saved") change = "account"
    }
    document.cookie = languageCookie(language)
    return change
  } catch {
    return "failed"
  } finally {
    changing -= 1
  }
}
