"use client"

import { REGLAGES_CARTE } from "./carte3d"
import { REGLAGES_DISPOSITION } from "./disposition"
import { useReglages } from "./reglages"

export function ReglagesCartes() {
  useReglages(
    "Card",
    REGLAGES_DISPOSITION,
    {
      rotationAleatoire: ["random rotation (rad)", 0, 0.3, 0.001],
      espacementPile: ["stack spacing", 0.001, 0.05, 0.001],
      espacementPioche: ["draw pile spacing", 0.001, 0.05, 0.001],
    },
    { ordre: 1 },
  )
  useReglages(
    "Card",
    REGLAGES_CARTE,
    {
      epaisseur: ["thickness (× width)", 0.001, 0.03, 0.0005],
      pliable: ["bendability", 0, 1, 0.01],
      dureeVol: ["flight duration (×)", 0.3, 3, 0.05],
      hauteurVol: ["flight height (×)", 0, 3, 0.05],
      ombre: ["shadow", 0, 1, 0.01],
    } as never,
    { ordre: 1 },
  )
  useReglages(
    "Card Effects",
    REGLAGES_CARTE,
    {
      couleurAssassin: "assassin color",
      haloAssassin: ["assassin glow", 0, 1, 0.01],
      pulsationAssassin: ["assassin pulse", 0, 0.5, 0.01],
      contourAssassin: "assassin solid outline",
      couleurOr: "completed mission color",
      haloOr: ["completed mission glow", 0, 1, 0.01],
      pulsationOr: ["completed mission pulse", 0, 0.5, 0.01],
      scintillement: ["sparkle", 0, 1, 0.01],
      vitesseScintillement: ["sparkle speed", 0, 2, 0.01],
      vitessePulsation: ["pulse speed", 0, 8, 0.1],
      couleurSelection: "selection frame color",
      opaciteCadre: ["frame opacity", 0, 1, 0.01],
      pulsationCadre: ["frame pulse", 0, 0.5, 0.01],
      respirationCadre: ["frame breathing", 0, 0.1, 0.001],
      vitesseCadre: ["frame speed", 0, 10, 0.1],
      reflet: ["reflection", 0, 1, 0.01],
      mouvementReflet: ["reflection motion", 0, 1.5, 0.01],
    } as never,
    { ordre: 7 },
  )
  return null
}
