"use client"

import { CopyIcon, CrownIcon, Loader2Icon, LinkIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { ChateauImage } from "@/components/chateau"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api, lienPartie } from "@/lib/api"
import type { ChateauOption } from "@/lib/catalogue"
import { MAX_JOUEURS, MIN_JOUEURS, type PartiePublique } from "@/lib/partie-types"
import { cn } from "@/lib/utils"

async function copier(texte: string, message: string) {
  try {
    await navigator.clipboard.writeText(texte)
    toast.success(message)
  } catch {
    toast.error("Impossible de copier")
  }
}

export function Lobby({ partie, chateaux, onMaj }: { partie: PartiePublique; chateaux: ChateauOption[]; onMaj: (p: PartiePublique) => void }) {
  const [lancement, setLancement] = useState(false)
  const estHote = partie.moiId === partie.hoteId
  const assez = partie.joueurs.length >= MIN_JOUEURS

  async function lancer() {
    setLancement(true)
    try {
      onMaj(await api.lancer(partie.code))
    } catch (e) {
      toast.error((e as Error).message)
      setLancement(false)
    }
  }

  return (
    <section className="w-full max-w-md space-y-6 rounded-2xl border bg-card/80 p-6 shadow-2xl backdrop-blur">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">Code de la partie</p>
        <div className="flex items-center gap-1">
          <span className="font-display text-4xl tracking-[0.3em] text-primary">{partie.code}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Copier le code" onClick={() => copier(partie.code, "Code copié !")}>
                <CopyIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copier le code</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Copier le lien" onClick={() => copier(lienPartie(partie.code), "Lien copié !")}>
                <LinkIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copier le lien d&apos;invitation</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ul className="space-y-2">
        {Array.from({ length: MAX_JOUEURS }, (_, i) => {
          const joueur = partie.joueurs[i]
          return (
            <li key={joueur?.id ?? `vide-${i}`}>
              <AnimatePresence mode="popLayout">
                {joueur ? (
                  <motion.div
                    key={joueur.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className={cn("flex h-14 items-center gap-3 rounded-xl border bg-accent/60 px-3", joueur.id === partie.moiId && "border-primary")}
                  >
                    <ChateauImage chateau={chateaux.find((c) => c.id === joueur.chateau)} className="size-10" />
                    <span className="flex-1 truncate text-lg">
                      {joueur.pseudo}
                      {joueur.id === partie.moiId && <span className="ml-2 text-sm text-muted-foreground">(toi)</span>}
                    </span>
                    {joueur.id === partie.hoteId && <CrownIcon className="size-5 fill-primary text-primary" aria-label="Hôte" />}
                  </motion.div>
                ) : (
                  <div className="flex h-14 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                    Place libre
                  </div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>

      {estHote ? (
        <Button size="lg" className="h-12 w-full font-display text-base" onClick={lancer} disabled={!assez || lancement}>
          {lancement && <Loader2Icon className="animate-spin" />}
          {assez ? "Lancer la partie" : "En attente de joueurs…"}
        </Button>
      ) : (
        <Button size="lg" variant="secondary" className="h-12 w-full font-display text-base" disabled>
          <Loader2Icon className="animate-spin" />
          En attente de l&apos;hôte
        </Button>
      )}
    </section>
  )
}
