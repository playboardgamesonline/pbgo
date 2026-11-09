"use client"

import { useDisplaySync } from "@pbgo/accounts/client"

/**
 * Keeps the device of a signed-in member in step with the choices of their account for how the site is shown (its motion and its transparency), on every page of the hub (the layout mounts it once, next to `LanguageSync`): the cookies and the
 * attributes of `<html>` are written when they hold other choices. It draws nothing, asks no one and never makes a page dynamic: the browser reads the session, as the navbar does (`docs/accounts.md`, Settings).
 */
export function DisplaySync() {
  useDisplaySync()
  return null
}
