"use client"

import { MonitorIcon } from "lucide-react"
import { useSkin, useText } from "./skin-provider"

/** Recouvre tout sous 900 px quand l'habillage le demande (`interface.desktopOnly`, vrai par défaut). */
export function DesktopOnly() {
  const { desktopOnly, decor } = useSkin()
  const t = useText()
  if (!desktopOnly) return null
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
