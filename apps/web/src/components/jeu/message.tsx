"use client"

import type { CarteVisible, Cible, EvenementVisible } from "@courtisans/engine"
import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"
import { PictoFamille, PictoRole } from "./pictos"

function NomCarte({ carte }: { carte: CarteVisible }) {
  const { catalogue } = useJeu()
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
      {carte.role && <PictoRole role={carte.role} className="size-4" />}
      {carte.role ? catalogue.roles[carte.role].nom : "Courtisan"}
      {carte.famille && (
        <>
          <PictoFamille famille={carte.famille} className="size-4" />
          {catalogue.familles[carte.famille].nom}
        </>
      )}
    </span>
  )
}

function Zone({ cible, auteurId, elimination }: { cible: Cible; auteurId: string; elimination?: boolean }) {
  const { pseudo } = useJeu()
  if (cible.zone === "table") {
    if (elimination) return <>à la table de la Reine</>
    return <>{cible.niveau === "haut" ? "en faveur" : "en défaveur"} à la table de la Reine</>
  }
  if (cible.joueurId === auteurId) return <>dans son domaine</>
  return (
    <>
      dans le domaine de <strong>{pseudo(cible.joueurId)}</strong>
    </>
  )
}

export function Message({ evenement, className }: { evenement: EvenementVisible; className?: string }) {
  const { pseudo } = useJeu()
  switch (evenement.type) {
    case "carteJouee":
      return (
        <span className={cn("inline-flex flex-wrap items-center justify-center gap-x-1.5", className)}>
          <strong>{pseudo(evenement.joueurId)}</strong> a joué un <NomCarte carte={evenement.carte} /> <Zone cible={evenement.cible} auteurId={evenement.joueurId} />
        </span>
      )
    case "carteEliminee":
      return (
        <span className={cn("inline-flex flex-wrap items-center justify-center gap-x-1.5", className)}>
          <strong>{pseudo(evenement.joueurId)}</strong> a éliminé un <NomCarte carte={evenement.carte} />{" "}
          <Zone cible={evenement.cible} auteurId={evenement.joueurId} elimination />
        </span>
      )
    case "pioche":
      return (
        <span className={className}>
          <strong>{pseudo(evenement.joueurId)}</strong> a pioché {evenement.nombre} carte{evenement.nombre > 1 ? "s" : ""}
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
