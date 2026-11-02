"use client"

import { useLanguageSync } from "@pbgo/accounts/client"

/**
 * Keeps the device of a signed-in visitor in the language of their account, on every page of the hub (the layout mounts it once, next to the navbar): the cookie, which the server
 * reads, is rewritten to match when the account says another language, and an account that keeps none yet takes the language in use. It draws nothing, asks no one and
 * never makes a page dynamic: the browser reads the session, as the navbar does (`docs/accounts.md`, the visitor's language).
 */
export function LanguageSync() {
  useLanguageSync()
  return null
}
