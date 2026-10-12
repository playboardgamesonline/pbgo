"use client"

import { usePathname } from "next/navigation"
import { Toaster as PlatformToaster } from "@pbgo/ui/platform/sonner"
import { Toaster as GameToaster } from "@pbgo/ui/game/sonner"

const ADMIN_PATH = /^\/[^/]+\/admin(\/|$)/

/** Toasts: the game's style everywhere, the platform's style on /<slug>/admin (a single Toaster at a time, no duplicates). */
export function AppToaster() {
  const admin = ADMIN_PATH.test(usePathname() ?? "")
  return admin ? <PlatformToaster position="bottom-right" /> : <GameToaster position="top-center" />
}
