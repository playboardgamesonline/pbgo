"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Arrivee } from "./arrivee"
import { Face } from "./carte"
import { useJeu } from "./contexte"
import { useInteraction } from "./interaction"

export function Main() {
  const { vue, catalogue } = useJeu()
  const it = useInteraction()
  const main = vue.moi?.main ?? []
  const sel = it.selection

  let aide = ""
  if (it.assassinat) aide = ""
  else if (sel) aide = `Où jouer ${sel.role ? `ce ${catalogue.roles[sel.role].nom}` : "ce Courtisan"} ${catalogue.familles[sel.famille].nom} ?`
  else if (it.monTour) aide = "Choisis une carte de ta main"

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="h-5 text-sm text-primary">{aide}</p>
      <div className="flex items-end gap-3">
        {main.map((carte) => {
          const actif = sel?.id === carte.id
          return (
            <Arrivee key={carte.id} origine={it.origine(carte.id)}>
              <motion.button
                type="button"
                disabled={!it.monTour || !!it.assassinat || it.envoi}
                onClick={() => it.selectionner(actif ? null : carte)}
                animate={{ y: actif ? -18 : 0 }}
                whileHover={it.monTour && !it.assassinat ? { y: actif ? -18 : -8 } : undefined}
                className={cn("block rounded-lg transition-shadow disabled:cursor-default", actif && "ring-4 ring-primary shadow-[0_0_30px_-4px_var(--primary)]", !it.monTour && "opacity-90")}
              >
                <Face famille={carte.famille} role={carte.role} taille="lg" />
              </motion.button>
            </Arrivee>
          )
        })}
      </div>
    </div>
  )
}
