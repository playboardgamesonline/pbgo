"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pbgo/ui/game/dialog"

/** Fenêtre de texte simple (cookies, mentions légales) : paragraphes séparés par une ligne vide, retours à la ligne conservés. */
export function InfoDialog({ open, onOpenChange, title, text }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; text: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border-0 bg-surface p-6 text-foreground">
        <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/85">
          {text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
