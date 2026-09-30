"use client"

import { usePathname } from "next/navigation"
import { Toaster as AdminToaster } from "@pbgo/ui/admin/sonner"
import { Toaster as GameToaster } from "@pbgo/ui/game/sonner"

/** Toasts : style du jeu partout, style shadcn de l'admin sur /admin (un seul Toaster à la fois, pas de doublon). */
export function AppToaster() {
  const admin = usePathname()?.startsWith("/admin")
  return admin ? <AdminToaster position="bottom-right" /> : <GameToaster position="top-center" />
}
