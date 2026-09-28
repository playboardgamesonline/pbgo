"use client"

import { useControls } from "leva"
import { motion } from "motion/react"
import { useEffect } from "react"
import { jouerSon, type NomSon } from "@/lib/son"
import { boutonCopie, onglet } from "./onglets-debug"

export type TypeAnnonce = "banquet" | "tour"

const DEFAUT = {
  duree: 2.4,
  son: true,
  voile: 0.3,
  fondu: 0.3,
  taille: 4.5,
  espacement: 0.06,
  couleurTexte: "#ffffff",
  contour: 3,
  couleurContour: "#f2b705",
  ombre: 4,
  flou: 18,
  echelleDepart: 0.85,
  rebond: 16,
  lignes: true,
  dureeLignes: 2.6,
  epaisseurLignes: 3,
  couleurLignes: "#f5c542",
  ecartLignes: 24,
}
export type ReglagesAnnonce = typeof DEFAUT

function schema(defaut: ReglagesAnnonce, dossier: string) {
  return {
    duree: { value: defaut.duree, min: 0.5, max: 8, step: 0.1, label: "durée (s)" },
    son: { value: defaut.son, label: "son" },
    voile: { value: defaut.voile, min: 0, max: 1, step: 0.01, label: "opacité overlay" },
    fondu: { value: defaut.fondu, min: 0, max: 2, step: 0.05, label: "fondu (s)" },
    taille: { value: defaut.taille, min: 1, max: 10, step: 0.1, label: "taille texte (rem)" },
    espacement: { value: defaut.espacement, min: 0, max: 0.5, step: 0.01, label: "espacement (em)" },
    couleurTexte: { value: defaut.couleurTexte, label: "couleur texte" },
    contour: { value: defaut.contour, min: 0, max: 10, step: 0.5, label: "contour (px)" },
    couleurContour: { value: defaut.couleurContour, label: "couleur contour" },
    ombre: { value: defaut.ombre, min: 0, max: 20, step: 0.5, label: "ombre (px)" },
    flou: { value: defaut.flou, min: 0, max: 60, step: 1, label: "flou ombre (px)" },
    echelleDepart: { value: defaut.echelleDepart, min: 0.2, max: 2, step: 0.01, label: "échelle départ" },
    rebond: { value: defaut.rebond, min: 4, max: 40, step: 1, label: "amortissement" },
    lignes: { value: defaut.lignes, label: "lignes" },
    dureeLignes: { value: defaut.dureeLignes, min: 0.3, max: 6, step: 0.1, label: "durée lignes (s)" },
    epaisseurLignes: { value: defaut.epaisseurLignes, min: 1, max: 12, step: 0.5, label: "épaisseur lignes (px)" },
    couleurLignes: { value: defaut.couleurLignes, label: "couleur lignes" },
    ecartLignes: { value: defaut.ecartLignes, min: 0, max: 120, step: 1, label: "écart lignes (px)" },
    ...boutonCopie("TRANSITION", dossier),
  }
}

export function useReglagesAnnonces(): Record<TypeAnnonce, ReglagesAnnonce> {
  const banquet = useControls("Annonce banquet", schema(DEFAUT, "Annonce banquet"), { collapsed: true }, onglet("TRANSITION"))
  const tour = useControls("Annonce votre tour", schema(DEFAUT, "Annonce votre tour"), { collapsed: true }, onglet("TRANSITION"))
  return { banquet: banquet as ReglagesAnnonce, tour: tour as ReglagesAnnonce }
}

function Ligne({ sens, r }: { sens: 1 | -1; r: ReglagesAnnonce }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: r.epaisseurLignes }}>
      <motion.div
        className="absolute inset-y-0 w-[70%]"
        style={{ background: `linear-gradient(90deg, transparent, ${r.couleurLignes} 30%, #fff4d6 50%, ${r.couleurLignes} 70%, transparent)` }}
        initial={{ x: sens === 1 ? "-100%" : "145%" }}
        animate={{ x: sens === 1 ? "145%" : "-100%" }}
        transition={{ duration: r.dureeLignes, ease: [0.45, 0, 0.2, 1] }}
      />
    </div>
  )
}

export function Annonce({ texte, son, reglages: r }: { texte: string; son: NomSon; reglages: ReglagesAnnonce }) {
  useEffect(() => {
    if (r.son) jouerSon(son)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [son])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: r.fondu + 0.2 } }}
      transition={{ duration: r.fondu }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: `rgb(0 0 0 / ${r.voile})` }}
    >
      <div className="flex w-full flex-col items-center" style={{ gap: r.ecartLignes }}>
        {r.lignes && <Ligne sens={1} r={r} />}
        <motion.h2
          initial={{ opacity: 0, scale: r.echelleDepart, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: r.rebond, delay: 0.1 }}
          className="px-6 text-center font-typey uppercase"
          style={{
            fontSize: `${r.taille}rem`,
            lineHeight: 1.1,
            letterSpacing: `${r.espacement}em`,
            color: r.couleurTexte,
            WebkitTextStroke: r.contour ? `${r.contour}px ${r.couleurContour}` : undefined,
            paintOrder: "stroke fill",
            filter: `drop-shadow(0 ${r.ombre}px 0 rgb(0 0 0 / 85%)) drop-shadow(0 ${r.ombre * 2.5}px ${r.flou}px rgb(0 0 0 / 60%))`,
          }}
        >
          {texte}
        </motion.h2>
        {r.lignes && <Ligne sens={-1} r={r} />}
      </div>
    </motion.div>
  )
}
