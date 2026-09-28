"use client"

import { type CarteVisible, FAMILLES, type Mission, ROLES } from "@courtisans/engine"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from "three"
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

const BADGES = [
  { motif: /en disgrâce|fallen from grace/i, fond: "#002C37", encre: "#CF9400" },
  { motif: /dans la lumière|en lumière|esteemed/i, fond: "#EFE8CD", encre: "#B38200" },
]
const MOTIF_BADGES = new RegExp(BADGES.map((b) => b.motif.source).join("|"), "gi")

type Morceau = { texte: string; badge?: (typeof BADGES)[number] }

function decouper(texte: string): Morceau[] {
  const morceaux: Morceau[] = []
  let reste = 0
  const mots = (t: string) =>
    t
      .split(/\s+/)
      .filter(Boolean)
      .forEach((m) => morceaux.push({ texte: m }))
  for (const r of texte.matchAll(MOTIF_BADGES)) {
    mots(texte.slice(reste, r.index))
    morceaux.push({ texte: r[0], badge: BADGES.find((b) => b.motif.test(r[0])) })
    reste = r.index + r[0].length
  }
  mots(texte.slice(reste))
  return morceaux
}

const marge = (taille: number) => taille * 0.32

function largeur(ctx: CanvasRenderingContext2D, ligne: Morceau[], taille: number) {
  const espace = ctx.measureText(" ").width
  return ligne.reduce((l, m, i) => l + ctx.measureText(m.texte).width + (m.badge ? marge(taille) * 2 : 0) + (i ? espace : 0), 0)
}

function deuxLignes(ctx: CanvasRenderingContext2D, morceaux: Morceau[], taille: number): Morceau[][] {
  if (morceaux.length < 2) return [morceaux]
  let meilleur: Morceau[][] = [morceaux]
  let largeurMin = Number.POSITIVE_INFINITY
  for (let i = 1; i < morceaux.length; i++) {
    const lignes = [morceaux.slice(0, i), morceaux.slice(i)]
    const l = Math.max(...lignes.map((x) => largeur(ctx, x, taille)))
    if (l < largeurMin) {
      largeurMin = l
      meilleur = lignes
    }
  }
  return meilleur
}

function dessinerLigne(ctx: CanvasRenderingContext2D, ligne: Morceau[], centreX: number, y: number, taille: number) {
  const espace = ctx.measureText(" ").width
  let x = centreX - largeur(ctx, ligne, taille) / 2
  ctx.textAlign = "left"
  for (const m of ligne) {
    const w = ctx.measureText(m.texte).width
    if (m.badge) {
      const h = taille * 1.12
      const l = w + marge(taille) * 2
      ctx.beginPath()
      ctx.roundRect(x, y - h / 2, l, h, taille * 0.24)
      ctx.fillStyle = m.badge.fond
      ctx.fill()
      ctx.lineWidth = Math.max(2, taille * 0.045)
      ctx.strokeStyle = m.badge.encre
      ctx.stroke()
      ctx.fillStyle = m.badge.encre
      ctx.fillText(m.texte, x + marge(taille), y + taille * 0.02)
      x += l + espace
    } else {
      ctx.fillStyle = "#141414"
      ctx.fillText(m.texte, x, y)
      x += w + espace
    }
  }
}

const POLICE = '"Alegreya Variable", "Alegreya", Georgia, serif'

async function composerMission(image: Texture, texte: string): Promise<Texture> {
  await document.fonts?.load(`600 40px ${POLICE}`).catch(() => null)
  const source = image.image as CanvasImageSource & {
    width: number
    height: number
  }
  const canvas = document.createElement("canvas")
  canvas.width = 1376
  canvas.height = 904
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const largeurMax = canvas.width * 0.6
  let taille = 58
  const morceaux = decouper(texte)
  ctx.font = `600 ${taille}px ${POLICE}`
  let lignes = deuxLignes(ctx, morceaux, taille)
  while (taille > 30 && Math.max(...lignes.map((l) => largeur(ctx, l, taille))) > largeurMax) {
    taille -= 2
    ctx.font = `600 ${taille}px ${POLICE}`
    lignes = deuxLignes(ctx, morceaux, taille)
  }
  ctx.textBaseline = "middle"
  const interligne = taille * (morceaux.some((m) => m.badge) ? 1.32 : 1.15)
  const centre = canvas.height * 0.705
  lignes.forEach((l, i) => dessinerLigne(ctx, l, canvas.width / 2, centre + (i - (lignes.length - 1) / 2) * interligne, taille))
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

const composees = new WeakMap<Texture, Map<string, Promise<Texture>>>()
function missionComposee(image: Texture, texte: string) {
  let parTexte = composees.get(image)
  if (!parTexte) composees.set(image, (parTexte = new Map()))
  let promesse = parTexte.get(texte)
  if (!promesse) {
    promesse = composerMission(image, texte).catch(() => image)
    parTexte.set(texte, promesse)
  }
  return promesse
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
  tissu: Texture | null
  mission: (m: Mission) => Texture
  dosMission: (m: Mission) => Texture
}

type Source = {
  cle: string
  urls: (string | null | undefined)[]
  texte?: string
}

export function useTextures(catalogue: CatalogueClient, missions: Mission[]): Textures {
  const d = CATALOGUE_PAR_DEFAUT
  const sources = useMemo<Source[]>(() => {
    const liste: Source[] = [
      { cle: "tapis", urls: [catalogue.tapisUrl, d.tapisUrl] },
      { cle: "tissu", urls: [catalogue.tissuUrl, d.tissuUrl] },
      { cle: "dos", urls: [catalogue.dosCourtisanUrl, d.dosCourtisanUrl] },
      {
        cle: "dosBlanche",
        urls: [catalogue.dosMissionBlancheUrl, d.dosMissionBlancheUrl],
      },
      {
        cle: "dosBleue",
        urls: [catalogue.dosMissionBleueUrl, d.dosMissionBleueUrl],
      },
    ]
    for (const f of FAMILLES)
      for (const r of [null, ...ROLES]) {
        const cle = cleCarte(f, r)
        liste.push({
          cle: `face:${cle}`,
          urls: [catalogue.cartes[cle], d.cartes[cle]],
        })
      }
    for (const m of missions)
      liste.push({
        cle: `mission:${m.id}`,
        urls: [catalogue.missions[m.id], IMAGES_MISSIONS_PAR_DEFAUT[m.id]],
        texte: m.texte,
      })
    return liste
  }, [catalogue, missions, d])

  const [chargees, setChargees] = useState<Record<string, Texture>>({})

  useEffect(() => {
    let actif = true
    for (const { cle, urls, texte } of sources) {
      chargerAvecSecours(urls)
        .then((t) => (t && texte ? missionComposee(t, texte) : t))
        .then((t) => {
          if (t && cle === "tissu") {
            t.wrapS = t.wrapT = RepeatWrapping
            t.needsUpdate = true
          }
          return t
        })
        .then((t) => {
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
      tissu: chargees.tissu ?? null,
      face: (c) => {
        if (!c.famille) return dos
        const cle = cleCarte(c.famille, c.role)
        return chargees[`face:${cle}`] ?? deSecours(cle, () => textureTexte("", catalogue.familles[c.famille!].couleur, "#fff", 890 / 472))
      },
      mission: (m) =>
        chargees[`mission:${m.id}`] ??
        deSecours(`m:${m.id}`, () =>
          textureTexte(m.texte, m.couleur === "bleue" ? "#0d5c63" : "#efe1bf", m.couleur === "bleue" ? "#fff" : "#10363c", 452 / 688),
        ),
      dosMission: (m) =>
        (m.couleur === "bleue" ? chargees.dosBleue : chargees.dosBlanche) ??
        deSecours(`dm:${m.couleur}`, () => textureTexte("★", m.couleur === "bleue" ? "#0d3b43" : "#e8d7ae", "#c9a227", 452 / 688)),
    }
  }, [chargees, catalogue, secours])
}
