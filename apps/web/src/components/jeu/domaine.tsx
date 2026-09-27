"use client"

import type { CarteVisible, Famille } from "@courtisans/engine"
import { motion } from "motion/react"
import { ChateauImage } from "@/components/chateau"
import { FAMILLES_PAR_DEFAUT } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { Arrivee } from "./arrivee"
import { Carte } from "./carte"
import { useJeu } from "./contexte"
import { useInteraction } from "./interaction"

const ORDRE = Object.keys(FAMILLES_PAR_DEFAUT) as Famille[]

export function Domaine({ joueurId, estMoi }: { joueurId: string; estMoi?: boolean }) {
  const { vue, catalogue, partie, enregistrer } = useJeu()
  const it = useInteraction()
  const joueur = vue.joueurs.find((j) => j.id === joueurId)!
  const info = partie.joueurs.find((j) => j.id === joueurId)
  const actif = vue.joueurActifId === joueurId
  const zone = estMoi ? "domaine" : "domaineAdverse"
  const cible = !!it.selection && it.peutJouer(zone)
  const zoneAssassinat = it.assassinat?.cible.zone === "domaine" && it.assassinat.cible.joueurId === joueurId

  const groupes: { cle: string; cartes: CarteVisible[] }[] = [
    ...ORDRE.map((f) => ({ cle: f, cartes: joueur.domaine.filter((c) => c.famille === f) })),
    { cle: "cache", cartes: joueur.domaine.filter((c) => !c.famille) },
  ].filter((g) => g.cartes.length > 0)

  return (
    <motion.div
      layout
      role={cible ? "button" : undefined}
      tabIndex={cible ? 0 : undefined}
      onClick={() => cible && it.jouer({ zone: "domaine", joueurId })}
      onKeyDown={(e) => cible && e.key === "Enter" && it.jouer({ zone: "domaine", joueurId })}
      className={cn(
        "flex min-w-44 items-center gap-3 rounded-2xl border bg-card/70 p-2 pr-3 backdrop-blur transition",
        actif && "border-primary shadow-[0_0_24px_-4px_var(--primary)]",
        cible && "cursor-pointer border-2 border-dashed border-primary bg-primary/15 hover:bg-primary/25",
        zoneAssassinat && "border-destructive",
      )}
    >
      <div ref={enregistrer(`chateau:${joueurId}`)} className="flex w-16 shrink-0 flex-col items-center gap-0.5">
        <ChateauImage chateau={catalogue.chateaux.find((c) => c.id === info?.chateau)} className="size-11" />
        <span className={cn("max-w-16 truncate text-xs", actif && "font-semibold text-primary")}>{estMoi ? "Toi" : joueur.pseudo}</span>
      </div>
      <div className="flex min-h-[76px] flex-wrap items-center gap-2">
        {groupes.length === 0 && <span className="text-xs text-muted-foreground">{cible ? "Jouer ici" : "Domaine vide"}</span>}
        {groupes.map((g) => (
          <div key={g.cle} className="flex">
            {g.cartes.map((carte, i) => {
              const candidat = zoneAssassinat && it.assassinat!.candidats.includes(carte.id)
              return (
                <Arrivee key={carte.id} origine={it.origine(carte.id)} style={{ marginLeft: i === 0 ? 0 : -30, zIndex: i + 1 }} className="relative">
                  <button
                    type="button"
                    disabled={!candidat}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (candidat) it.eliminer(carte.id)
                    }}
                    className={cn("block rounded-md", candidat && "cursor-crosshair ring-2 ring-destructive hover:-translate-y-1")}
                  >
                    <Carte carte={carte} taille="xs" />
                  </button>
                </Arrivee>
              )
            })}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
