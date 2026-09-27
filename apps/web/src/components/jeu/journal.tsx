"use client"

import { ChevronLeftIcon } from "lucide-react"
import { useRef, useState } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useJeu } from "./contexte"
import { Message } from "./message"

export function Journal() {
  const { vue } = useJeu()
  const [ouvert, setOuvert] = useState(false)
  const depart = useRef<number | null>(null)
  const evenements = vue.journal.map((e, i) => ({ e, i })).reverse()

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        onPointerDown={(e) => (depart.current = e.clientX)}
        onPointerMove={(e) => {
          if (depart.current !== null && depart.current - e.clientX > 24) {
            depart.current = null
            setOuvert(true)
          }
        }}
        onPointerUp={() => (depart.current = null)}
        className="group fixed top-1/2 right-0 z-30 flex -translate-y-1/2 touch-none items-center gap-1 py-6 pr-2 pl-1 text-foreground transition hover:text-foreground/70"
        aria-label="Ouvrir le journal"
      >
        <ChevronLeftIcon className="size-6 transition group-hover:-translate-x-1" />
        <span className="font-display text-lg tracking-[0.2em] [writing-mode:vertical-rl]">Journal</span>
      </button>
      <Drawer direction="right" open={ouvert} onOpenChange={setOuvert}>
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
    </>
  )
}
