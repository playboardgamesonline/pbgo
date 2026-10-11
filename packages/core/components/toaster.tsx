"use client"

import { usePathname } from "next/navigation"
import { Toaster as AdminToaster } from "@pbgo/ui/admin/sonner"
import { Toaster as GameToaster } from "@pbgo/ui/game/sonner"

const ADMIN_PATH = /^\/[^/]+\/admin(\/|$)/

/** Toasts: the game's style everywhere, the admin's shadcn style on /<slug>/admin (a single Toaster at a time, no duplicates). */
export function AppToaster() {
  const admin = ADMIN_PATH.test(usePathname() ?? "")
  return admin ? <AdminToaster position="bottom-right" /> : <GameToaster position="top-center" />
}
