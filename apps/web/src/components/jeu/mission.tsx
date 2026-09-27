"use client"

import type { Mission } from "@courtisans/engine"
import { ScrollIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useJeu } from "./contexte"

export function CarteMission({ mission, className }: { mission: Mission; className?: string }) {
  const { catalogue } = useJeu()
  const url = catalogue.missions[mission.id]
  const bleue = mission.couleur === "bleue"
  return (
    <figure className={cn("w-72 space-y-2", className)}>
      <div
        className={cn(
          "relative aspect-[688/452] overflow-hidden rounded-xl border-2 shadow-xl",
          bleue ? "border-[var(--disgrace)] bg-[#0d5c63]" : "border-primary/60 bg-[#efe1bf]",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center p-6">
            <div className="flex size-full flex-col items-center justify-center rounded-lg bg-[#fbf6ea] p-4 text-center text-[var(--disgrace)]">
              <span className="font-display text-2xl text-primary">3 pts</span>
              <span className="text-sm leading-snug">{mission.texte}</span>
            </div>
          </div>
        )}
      </div>
      {url && <figcaption className="text-center text-sm leading-snug">{mission.texte.replace(/^\[À vérifier\]\s*/, "")}</figcaption>}
    </figure>
  )
}

export function MesMissions() {
  const { vue } = useJeu()
  if (!vue.moi) return null
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="shadow-lg">
          <ScrollIcon />
          Mes missions
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-popover text-popover-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Tes missions secrètes</DialogTitle>
          <DialogDescription className="text-popover-foreground/70">Chaque mission réussie rapporte 3 points en fin de partie.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-center gap-6">
          {vue.moi.missions.map((m) => (
            <CarteMission key={m.id} mission={m} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
