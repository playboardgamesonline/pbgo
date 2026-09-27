"use client"

import type { CarteVisible, Cible, EvenementVisible } from "@courtisans/engine"
import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"
import { PictoRole } from "./pictos"
import { PseudoJoueur } from "./pseudo"

export function BadgeCarte({ carte, className }: { carte: CarteVisible; className?: string }) {
  const { catalogue } = useJeu()
  const famille = carte.famille ? catalogue.familles[carte.famille] : null
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-white/30 py-0.5 pr-7 pl-1.5 align-middle font-semibold whitespace-nowrap text-white shadow-md [text-shadow:0_1px_3px_rgb(0_0_0/70%)]",
        className,
      )}
      style={{ backgroundColor: famille?.couleur ?? "var(--disgrace)" }}
    >
      {famille?.pictoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={famille.pictoUrl} alt="" aria-hidden className="pointer-events-none absolute -right-1.5 -bottom-2.5 size-10 opacity-35" />
      )}
      {carte.role && <PictoRole role={carte.role} className="relative size-[1.15em]" />}
      <span className="relative">{carte.role ? catalogue.roles[carte.role].nom : "Courtisan"}</span>
    </span>
  )
}

function Zone({ cible, auteurId }: { cible: Cible; auteurId: string }) {
  if (cible.zone === "table") return <span>à la table de la Reine.</span>
  if (cible.joueurId === auteurId) return <span>chez lui.</span>
  return (
    <span>
      chez <PseudoJoueur id={cible.joueurId} />.
    </span>
  )
}

const LIGNE = "inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1"

export function Message({ evenement, className }: { evenement: EvenementVisible; className?: string }) {
  switch (evenement.type) {
    case "carteJouee":
      return (
        <span className={cn(LIGNE, className)}>
          <PseudoJoueur id={evenement.joueurId} /> joue <BadgeCarte carte={evenement.carte} /> <Zone cible={evenement.cible} auteurId={evenement.joueurId} />
        </span>
      )
    case "carteEliminee":
      return (
        <span className={cn(LIGNE, className)}>
          <PseudoJoueur id={evenement.joueurId} /> élimine <BadgeCarte carte={evenement.carte} /> <Zone cible={evenement.cible} auteurId={evenement.joueurId} />
        </span>
      )
    case "pioche":
      return (
        <span className={cn(LIGNE, className)}>
          <PseudoJoueur id={evenement.joueurId} /> <span>pioche {evenement.nombre} carte{evenement.nombre > 1 ? "s" : ""}.</span>
        </span>
      )
    case "finDePartie":
      return <span className={className}>La pioche est vide : fin de la partie !</span>
  }
}

export function Messages({ evenements }: { evenements: EvenementVisible[] }) {
  return (
    <>
      {evenements.map((e, i) => (
        <Fragment key={i}>
          <Message evenement={e} />
        </Fragment>
      ))}
    </>
  )
}
