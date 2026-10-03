"use client"

import { MonitorIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSkin, useText } from "./skin-provider"

/** Pages de partie (salle d'attente, plateau) et leur aperçu dans l'admin : les seules que le mur recouvre. */
const GAME_PAGES = /^\/(game|preview\/game)(\/|$)/

/**
 * Sous 900 px, recouvre les pages de partie quand l'habillage le demande (`interface.desktopOnly`, vrai par défaut).
 * L'accueil, les règles et le reste du site restent lisibles sur mobile (référencement) : voir `DesktopNotice`.
 */
export function DesktopOnly() {
  const { desktopOnly, decor } = useSkin()
  const t = useText()
  const pathname = usePathname()
  if (!desktopOnly || !GAME_PAGES.test(pathname ?? "")) return null
  return (
    <div className="fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-5 bg-background px-8 text-center max-[899px]:flex">
      {decor.pattern && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[length:128px_128px] opacity-[0.07]" style={{ backgroundImage: `url(${decor.pattern})` }} />
      )}
      <MonitorIcon className="relative size-12 text-foreground/80" strokeWidth={1.4} />
      <p className="relative max-w-sm font-display text-lg leading-snug text-balance text-foreground/85">{t("desktopOnly")}</p>
    </div>
  )
}

/** Avis non bloquant sous 900 px (accueil) : on peut lire la page, mais la partie se joue sur ordinateur (le formulaire est alors masqué). */
export function DesktopNotice() {
  const { desktopOnly } = useSkin()
  const t = useText()
  if (!desktopOnly) return null
  return (
    <p className="mx-4 mt-[2.5vh] flex max-w-sm shrink-0 items-center gap-3 rounded-xl border border-foreground/25 bg-surface-dark/70 px-4 py-3 text-left text-sm leading-snug text-foreground/85 min-[900px]:hidden">
      <MonitorIcon aria-hidden className="size-6 shrink-0 text-foreground/80" strokeWidth={1.4} />
      <span>{t("desktopOnly")}</span>
    </p>
  )
}
