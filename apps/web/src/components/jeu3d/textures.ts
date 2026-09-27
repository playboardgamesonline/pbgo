"use client"

import { type CarteVisible, FAMILLES, ROLES, type Mission } from "@courtisans/engine"
import { useTexture } from "@react-three/drei"
import { useMemo } from "react"
import { CanvasTexture, SRGBColorSpace, type Texture } from "three"
import { type CatalogueClient, cleCarte } from "@/lib/catalogue"

function textureTexte(texte: string, fond: string, encre: string, ratio: number) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = Math.round(512 * ratio)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = fond
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = encre
  ctx.textAlign = "center"
  ctx.font = "bold 40px Georgia, serif"
  const mots = texte.split(" ")
  const lignes: string[] = []
  let ligne = ""
  for (const mot of mots) {
    if (ctx.measureText(`${ligne} ${mot}`).width > 440) {
      lignes.push(ligne)
      ligne = mot
    } else ligne = ligne ? `${ligne} ${mot}` : mot
  }
  lignes.push(ligne)
  lignes.forEach((l, i) => ctx.fillText(l, canvas.width / 2, canvas.height / 2 + (i - (lignes.length - 1) / 2) * 48))
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

export type Textures = {
  face: (carte: CarteVisible) => Texture
  dos: Texture
  tapis: Texture
  mission: (m: Mission) => Texture
  dosMission: (m: Mission) => Texture
}

export function useTextures(catalogue: CatalogueClient, missions: Mission[]): Textures {
  const urls = useMemo(() => {
    const u: Record<string, string> = { tapis: catalogue.tapisUrl }
    for (const f of FAMILLES) for (const r of [null, ...ROLES]) {
      const url = catalogue.cartes[cleCarte(f, r)]
      if (url) u[`face:${cleCarte(f, r)}`] = url
    }
    if (catalogue.dosCourtisanUrl) u.dos = catalogue.dosCourtisanUrl
    if (catalogue.dosMissionBlancheUrl) u.dosBlanche = catalogue.dosMissionBlancheUrl
    if (catalogue.dosMissionBleueUrl) u.dosBleue = catalogue.dosMissionBleueUrl
    for (const m of missions) if (catalogue.missions[m.id]) u[`mission:${m.id}`] = catalogue.missions[m.id]!
    return u
  }, [catalogue, missions])

  const chargees = useTexture(urls, (t) => {
    for (const tex of Array.isArray(t) ? t : [t]) {
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 8
    }
  }) as Record<string, Texture>

  return useMemo(() => {
    const secours = new Map<string, Texture>()
    const deSecours = (cle: string, creer: () => Texture) => {
      if (!secours.has(cle)) secours.set(cle, creer())
      return secours.get(cle)!
    }
    const dos = chargees.dos ?? deSecours("dos", () => textureTexte("★", "#10363c", "#d9a93f", 890 / 472))
    return {
      tapis: chargees.tapis!,
      dos,
      face: (c) => {
        if (!c.famille) return dos
        const cle = cleCarte(c.famille, c.role)
        return chargees[`face:${cle}`] ?? deSecours(cle, () => textureTexte(`${c.role ?? "courtisan"} ${c.famille}`, catalogue.familles[c.famille!].couleur, "#fff", 890 / 472))
      },
      mission: (m) => chargees[`mission:${m.id}`] ?? deSecours(`m:${m.id}`, () => textureTexte(m.texte, m.couleur === "bleue" ? "#0d5c63" : "#efe1bf", m.couleur === "bleue" ? "#fff" : "#10363c", 452 / 688)),
      dosMission: (m) =>
        (m.couleur === "bleue" ? chargees.dosBleue : chargees.dosBlanche) ??
        deSecours(`dm:${m.couleur}`, () => textureTexte("★", m.couleur === "bleue" ? "#0d3b43" : "#e8d7ae", "#c9a227", 452 / 688)),
    }
  }, [chargees, catalogue])
}
