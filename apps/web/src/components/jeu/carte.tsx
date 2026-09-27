"use client"

import type { CarteVisible, Famille, Role } from "@courtisans/engine"
import { StarIcon } from "lucide-react"
import { cleCarte } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"
import { PictoRole } from "./pictos"

export const TAILLES = { xs: 40, sm: 54, md: 76, lg: 100 } as const
export type TailleCarte = keyof typeof TAILLES
const RATIO = 890 / 472

export function Dos({ taille, className, espion }: { taille: TailleCarte; className?: string; espion?: boolean }) {
  const { catalogue } = useJeu()
  const largeur = TAILLES[taille]
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-[6%/3.2%] border border-black/30 shadow-md", className)}
      style={{ width: largeur, height: largeur * RATIO }}
    >
      {catalogue.dosCourtisanUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={catalogue.dosCourtisanUrl} alt="Dos de carte" className="size-full object-cover" draggable={false} />
      ) : (
        <div className="flex size-full items-center justify-center bg-[var(--disgrace)] bg-[radial-gradient(circle,var(--accent)_20%,transparent_70%)]">
          <StarIcon className="size-1/2 fill-primary text-primary" />
        </div>
      )}
      {espion && (
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center">
          <span className="rounded-full bg-black/60 p-[6%]">
            <PictoRole role="espion" className="size-[max(10px,22%)] text-white" />
          </span>
        </div>
      )}
    </div>
  )
}

export function Face({ famille, role, taille, className }: { famille: Famille; role: Role | null; taille: TailleCarte; className?: string }) {
  const { catalogue } = useJeu()
  const largeur = TAILLES[taille]
  const url = catalogue.cartes[cleCarte(famille, role)]
  const info = catalogue.familles[famille]
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-[6%/3.2%] border border-black/30 shadow-md", className)}
      style={{ width: largeur, height: largeur * RATIO, backgroundColor: info.couleur }}
      title={`${role ? catalogue.roles[role].nom : "Courtisan"} ${info.nom}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <div className="flex size-full flex-col items-center justify-between p-[8%] text-white [text-shadow:0_1px_2px_rgb(0_0_0/60%)]">
          <div className="flex w-full justify-between">{role && <PictoRole role={role} className="size-[max(10px,22%)]" />}</div>
          <span className="font-display leading-none" style={{ fontSize: Math.max(8, largeur * 0.16) }}>
            {info.nom}
          </span>
          <span style={{ fontSize: Math.max(7, largeur * 0.11) }}>{role ? catalogue.roles[role].nom : "Courtisan"}</span>
        </div>
      )}
    </div>
  )
}

export function Carte({ carte, taille, className }: { carte: CarteVisible; taille: TailleCarte; className?: string }) {
  if (!carte.famille) return <Dos taille={taille} className={className} espion />
  return <Face famille={carte.famille} role={carte.role} taille={taille} className={className} />
}
