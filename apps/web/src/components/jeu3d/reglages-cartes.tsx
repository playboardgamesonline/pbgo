"use client"

import { useControls } from "leva"
import { REGLAGES_CARTE } from "./carte3d"
import { boutonCopie, onglet } from "./onglets-debug"

type Cle = keyof typeof REGLAGES_CARTE

const LABELS: Record<Cle, [string, number?, number?, number?]> = {
  couleurAssassin: ["couleur assassin"],
  haloAssassin: ["halo assassin", 0, 1, 0.01],
  pulsationAssassin: ["pulsation assassin", 0, 0.5, 0.01],
  contourAssassin: ["contour plein assassin"],
  couleurOr: ["couleur mission réussie"],
  haloOr: ["halo mission réussie", 0, 1, 0.01],
  pulsationOr: ["pulsation mission réussie", 0, 0.5, 0.01],
  scintillement: ["scintillement", 0, 1, 0.01],
  vitesseScintillement: ["vitesse scintillement", 0, 2, 0.01],
  vitessePulsation: ["vitesse pulsation", 0, 8, 0.1],
  couleurSelection: ["couleur cadre sélection"],
  opaciteCadre: ["opacité cadre", 0, 1, 0.01],
  pulsationCadre: ["pulsation cadre", 0, 0.5, 0.01],
  respirationCadre: ["respiration cadre", 0, 0.1, 0.001],
  vitesseCadre: ["vitesse cadre", 0, 10, 0.1],
  reflet: ["reflet", 0, 1, 0.01],
  mouvementReflet: ["mouvement reflet", 0, 1.5, 0.01],
  ombre: ["ombre des cartes", 0, 1, 0.01],
  dureeVol: ["durée des vols (×)", 0.3, 3, 0.05],
  hauteurVol: ["hauteur des vols (×)", 0, 3, 0.05],
}

export function ReglagesCartes() {
  const schema = Object.fromEntries(
    (Object.keys(REGLAGES_CARTE) as Cle[]).map((cle) => {
      const [label, min, max, step] = LABELS[cle]
      const onChange = (v: never) => {
        ;(REGLAGES_CARTE as Record<Cle, unknown>)[cle] = v
      }
      return [cle, { value: REGLAGES_CARTE[cle], label, min, max, step, onChange }]
    }),
  )
  useControls(
    "Cartes · effets et animations",
    { ...schema, ...boutonCopie("SCENE", "Cartes · effets et animations") } as never,
    { collapsed: true },
    onglet("SCENE"),
  )
  return null
}
