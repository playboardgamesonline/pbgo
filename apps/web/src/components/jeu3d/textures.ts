"use client"

import { type CarteVisible, FAMILLES, type Mission, ROLES } from "@courtisans/engine"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, SRGBColorSpace, type Texture, TextureLoader } from "three"
import { CATALOGUE_PAR_DEFAUT, type CatalogueClient, cleCarte } from "@/lib/catalogue"
import { IMAGES_MISSIONS_PAR_DEFAUT } from "@/lib/missions-par-defaut"

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
  const lignes: string[] = []
  let ligne = ""
  for (const mot of texte.split(" ")) {
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

const loader = new TextureLoader().setCrossOrigin("anonymous")
const cache = new Map<string, Promise<Texture>>()

function charger(url: string): Promise<Texture> {
  let promesse = cache.get(url)
  if (!promesse) {
    promesse = loader.loadAsync(url).then((t) => {
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 8
      return t
    })
    promesse.catch(() => cache.delete(url))
    cache.set(url, promesse)
  }
  return promesse
}

async function chargerAvecSecours(urls: (string | null | undefined)[]): Promise<Texture | null> {
  for (const url of urls) {
    if (!url) continue
    try {
      return await charger(url)
    } catch {
      console.warn(`Image indisponible, essai suivant : ${url}`)
    }
  }
  return null
}

export type Textures = {
  face: (carte: CarteVisible) => Texture
  dos: Texture
  tapis: Texture
  mission: (m: Mission) => Texture
  dosMission: (m: Mission) => Texture
}

type Source = { cle: string; urls: (string | null | undefined)[] }

export function useTextures(catalogue: CatalogueClient, missions: Mission[]): Textures {
  const d = CATALOGUE_PAR_DEFAUT
  const sources = useMemo<Source[]>(() => {
    const liste: Source[] = [
      { cle: "tapis", urls: [catalogue.tapisUrl, d.tapisUrl] },
      { cle: "dos", urls: [catalogue.dosCourtisanUrl, d.dosCourtisanUrl] },
      { cle: "dosBlanche", urls: [catalogue.dosMissionBlancheUrl, d.dosMissionBlancheUrl] },
      { cle: "dosBleue", urls: [catalogue.dosMissionBleueUrl, d.dosMissionBleueUrl] },
    ]
    for (const f of FAMILLES) for (const r of [null, ...ROLES]) {
      const cle = cleCarte(f, r)
      liste.push({ cle: `face:${cle}`, urls: [catalogue.cartes[cle], d.cartes[cle]] })
    }
    for (const m of missions) liste.push({ cle: `mission:${m.id}`, urls: [catalogue.missions[m.id], IMAGES_MISSIONS_PAR_DEFAUT[m.id]] })
    return liste
  }, [catalogue, missions, d])

  const [chargees, setChargees] = useState<Record<string, Texture>>({})

  useEffect(() => {
    let actif = true
    for (const { cle, urls } of sources) {
      chargerAvecSecours(urls).then((t) => {
        if (actif && t) setChargees((c) => (c[cle] === t ? c : { ...c, [cle]: t }))
      })
    }
    return () => {
      actif = false
    }
  }, [sources])

  const [secours] = useState(() => new Map<string, Texture>())

  return useMemo(() => {
    const deSecours = (cle: string, creer: () => Texture) => {
      if (!secours.has(cle)) secours.set(cle, creer())
      return secours.get(cle)!
    }
    const dos = chargees.dos ?? deSecours("dos", () => textureTexte("★", "#10363c", "#d9a93f", 890 / 472))
    return {
      tapis: chargees.tapis ?? deSecours("tapis", () => textureTexte("", "#1b3f45", "#fff", 579 / 2362)),
      dos,
      face: (c) => {
        if (!c.famille) return dos
        const cle = cleCarte(c.famille, c.role)
        return chargees[`face:${cle}`] ?? deSecours(cle, () => textureTexte("", catalogue.familles[c.famille!].couleur, "#fff", 890 / 472))
      },
      mission: (m) =>
        chargees[`mission:${m.id}`] ??
        deSecours(`m:${m.id}`, () => textureTexte(m.texte, m.couleur === "bleue" ? "#0d5c63" : "#efe1bf", m.couleur === "bleue" ? "#fff" : "#10363c", 452 / 688)),
      dosMission: (m) =>
        (m.couleur === "bleue" ? chargees.dosBleue : chargees.dosBlanche) ??
        deSecours(`dm:${m.couleur}`, () => textureTexte("★", m.couleur === "bleue" ? "#0d3b43" : "#e8d7ae", "#c9a227", 452 / 688)),
    }
  }, [chargees, catalogue, secours])
}
