"use client"

import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"

export function Pseudo({ nom, couleur, className }: { nom: string; couleur: string; className?: string }) {
  return (
    <span
      className={cn("font-sans font-extrabold whitespace-nowrap normal-case", className)}
      style={{ color: couleur, WebkitTextStroke: "0.22em white", paintOrder: "stroke fill" }}
    >
      {nom}
    </span>
  )
}

export function PseudoJoueur({ id, className }: { id: string; className?: string }) {
  const { pseudo, couleur } = useJeu()
  return <Pseudo nom={pseudo(id)} couleur={couleur(id)} className={className} />
}
