"use client"

import type { Famille, Role } from "@courtisans/engine"
import { CrownIcon, ShieldIcon, SwordIcon, VenetianMaskIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"

const ICONES: Record<Role, typeof CrownIcon> = { noble: CrownIcon, espion: VenetianMaskIcon, assassin: SwordIcon, garde: ShieldIcon }

export function PictoRole({ role, className }: { role: Role; className?: string }) {
  const { catalogue } = useJeu()
  const url = catalogue.roles[role].pictoUrl
  if (url) {
    return (
      <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--disgrace)] p-[2px] align-middle", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={catalogue.roles[role].nom} className="size-full object-contain" />
      </span>
    )
  }
  const Icone = ICONES[role]
  return <Icone className={cn("size-4", className)} aria-label={catalogue.roles[role].nom} />
}

export function PictoFamille({ famille, className }: { famille: Famille; className?: string }) {
  const { catalogue } = useJeu()
  const info = catalogue.familles[famille]
  return (
    <span
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle", className)}
      style={{ backgroundColor: info.couleur }}
      title={info.nom}
    >
      {info.pictoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.pictoUrl} alt={info.nom} className="size-[70%] object-contain" />
      ) : (
        <span className="font-display text-[0.6em] leading-none text-white">{info.nom[0]}</span>
      )}
    </span>
  )
}
