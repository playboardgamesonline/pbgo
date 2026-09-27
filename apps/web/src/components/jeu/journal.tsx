"use client"

import { ScrollTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useJeu } from "./contexte"
import { Message } from "./message"

export function Journal() {
  const { vue } = useJeu()
  const evenements = vue.journal.map((e, i) => ({ e, i })).reverse()
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="outline" className="shadow-lg">
          <ScrollTextIcon />
          Journal
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-popover text-popover-foreground">
        <DrawerHeader>
          <DrawerTitle className="font-display text-xl text-[var(--disgrace)]">Journal de la cour</DrawerTitle>
          <DrawerDescription className="text-popover-foreground/70">Tour {vue.numeroTour}</DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {evenements.length === 0 && <p className="text-sm opacity-70">Aucune action pour l&apos;instant.</p>}
          <ol className="space-y-2">
            {evenements.map(({ e, i }) => (
              <li key={i} className="rounded-lg border border-[var(--disgrace)]/15 bg-white/50 px-3 py-2 text-sm">
                <Message evenement={e} className="justify-start text-left" />
              </li>
            ))}
          </ol>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
