"use client"

import { useMotionSync } from "@pbgo/accounts/client"

/**
 * Keeps the device of a signed-in member in step with the choice of their account for the site's motion, on every page of the hub (the layout mounts it once, next to `LanguageSync`): the cookie and the attribute of `<html>` are
 * written when they hold another choice. It draws nothing, asks no one and never makes a page dynamic: the browser reads the session, as the navbar does (`docs/accounts.md`, Settings).
 */
export function MotionSync() {
  useMotionSync()
  return null
}
