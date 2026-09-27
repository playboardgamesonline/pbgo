"use client"

import { Dos } from "./carte"
import { useJeu } from "./contexte"

export function Pioche() {
  const { vue, enregistrer } = useJeu()
  const n = vue.nombreCartesPioche
  const epaisseur = Math.min(4, Math.ceil(n / 12))
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={enregistrer("pioche")} className="relative" style={{ width: 62, height: 106 }}>
        {n === 0 ? (
          <div className="size-full rounded-md border-2 border-dashed border-border" />
        ) : (
          Array.from({ length: epaisseur }, (_, i) => (
            <div key={i} className="absolute" style={{ left: i * 2, top: -i * 2 }}>
              <Dos taille="sm" />
            </div>
          ))
        )}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        Pioche · {n} carte{n > 1 ? "s" : ""}
      </span>
    </div>
  )
}
