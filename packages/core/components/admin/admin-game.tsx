"use client"

import { createContext, useContext } from "react"

const AdminGameContext = createContext<string | null>(null)

/**
 * The game a gamemaster page edits (`/gamemaster/<slug>/…`). The gamemaster mounts no game runtime, so its components cannot read
 * the slug from the binding: the server page gives it here, and everything else a section needs comes as plain props.
 */
export function AdminGameProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  return <AdminGameContext.Provider value={slug}>{children}</AdminGameContext.Provider>
}

export function useAdminSlug() {
  const slug = useContext(AdminGameContext)
  if (slug === null) throw new Error("useAdminSlug() must be used inside <AdminGameProvider>")
  return slug
}
