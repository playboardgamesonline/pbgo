"use client"

import type { CarteVisible, Famille, Niveau } from "@courtisans/engine"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { motion } from "motion/react"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { Arrivee } from "./arrivee"
import { Carte, TAILLES } from "./carte"
import { useJeu } from "./contexte"
import { useInteraction } from "./interaction"

type Colonne = Famille | "reine"
const HAUTEUR = TAILLES.xs * (890 / 472)
const DECALAGE = 26

function colonneDe(carte: CarteVisible): Colonne {
  return carte.famille ?? "reine"
}

function Pile({ cartes, niveau, colonne }: { cartes: CarteVisible[]; niveau: Niveau; colonne: Colonne }) {
  const it = useInteraction()
  const cible = it.selection && it.peutJouer("table") && (it.selection.role === "espion" ? "reine" : it.selection.famille) === colonne
  return (
    <div className={cn("flex items-center", niveau === "haut" ? "flex-col-reverse justify-start" : "flex-col justify-start")}>
      {cartes.map((carte, i) => {
        const candidat = it.assassinat?.cible.zone === "table" && it.assassinat.candidats.includes(carte.id)
        return (
          <Arrivee
            key={carte.id}
            origine={it.origine(carte.id)}
            className="relative"
            style={{ zIndex: i + 1, [niveau === "haut" ? "marginBottom" : "marginTop"]: i === 0 ? 0 : DECALAGE - HAUTEUR }}
          >
            <button
              type="button"
              disabled={!candidat}
              onClick={() => candidat && it.eliminer(carte.id)}
              className={cn("block rounded-md transition", candidat && "cursor-crosshair ring-2 ring-destructive ring-offset-1 ring-offset-background hover:-translate-y-1")}
            >
              <Carte carte={carte} taille="xs" />
            </button>
          </Arrivee>
        )
      })}
      {cible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => it.jouer({ zone: "table", niveau })}
          disabled={it.envoi}
          className="relative z-50 flex flex-col items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/25 text-[9px] leading-none font-semibold text-primary shadow-[0_0_16px_-2px_var(--primary)] hover:bg-primary/50"
          style={{ width: TAILLES.xs + 12, height: 38, [niveau === "haut" ? "marginBottom" : "marginTop"]: cartes.length ? 4 : 0 }}
        >
          {niveau === "haut" ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          {niveau === "haut" ? "Faveur" : "Défaveur"}
        </motion.button>
      )}
    </div>
  )
}

function poidsVisible(cartes: CarteVisible[]) {
  return cartes.reduce((s, c) => s + (c.role === "noble" ? 2 : 1), 0)
}

export function TableReine() {
  const { vue, catalogue } = useJeu()
  const parColonne = (colonne: Colonne, niveau: Niveau) => vue.table.filter((p) => p.niveau === niveau && colonneDe(p.carte) === colonne).map((p) => p.carte)

  return (
    <div className="w-full" style={{ maxWidth: "clamp(40rem, calc((100dvh - 680px) * 4.08), 64rem)" }}>
      <div className="grid grid-cols-7 items-end px-[3.3%]" style={{ minHeight: HAUTEUR + 2 * DECALAGE }}>
        {ORDRE_TAPIS.map((c) => (
          <div key={c} className="flex justify-center pb-1">
            <Pile cartes={parColonne(c, "haut")} niveau="haut" colonne={c} />
          </div>
        ))}
      </div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={catalogue.tapisUrl} alt="Table de la Reine" className="w-full select-none rounded-xl border-2 border-primary/40 shadow-2xl" draggable={false} />
        <div className="absolute inset-x-0 bottom-1 grid grid-cols-7 px-[3.3%]">
          {ORDRE_TAPIS.map((c) => {
            const haut = poidsVisible(parColonne(c, "haut"))
            const bas = poidsVisible(parColonne(c, "bas"))
            if (!haut && !bas) return <span key={c} />
            return (
              <span key={c} className="mx-auto rounded-full bg-black/60 px-1.5 text-[10px] leading-4 text-white tabular-nums">
                ▲{haut} ▼{bas}
              </span>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-7 items-start px-[3.3%]" style={{ minHeight: HAUTEUR + 2 * DECALAGE }}>
        {ORDRE_TAPIS.map((c) => (
          <div key={c} className="flex justify-center pt-1">
            <Pile cartes={parColonne(c, "bas")} niveau="bas" colonne={c} />
          </div>
        ))}
      </div>
    </div>
  )
}
