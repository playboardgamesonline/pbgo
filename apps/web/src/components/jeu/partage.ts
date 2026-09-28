"use client"

import { photographierPartie } from "../jeu3d/photo"

export type LignePartage = {
  rang: number
  pseudo: string
  couleur: string
  total: number
  domaine: number
  missions: number
  missionsReussies: number
  familles: { couleur: string; points: number }[]
  vainqueur: boolean
}

const POLICE = '"Alegreya Variable", "Alegreya", Georgia, serif'

function chargerImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function teinter(img: HTMLImageElement, couleur: string, hauteur: number) {
  const largeur = Math.round((img.width / img.height) * hauteur)
  const c = document.createElement("canvas")
  c.width = largeur
  c.height = hauteur
  const ctx = c.getContext("2d")!
  ctx.drawImage(img, 0, 0, largeur, hauteur)
  ctx.globalCompositeOperation = "source-in"
  ctx.fillStyle = couleur
  ctx.fillRect(0, 0, largeur, hauteur)
  return c
}

function eclaircir(hex: string, t: number) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  const m = (v: number) => Math.round(v + (255 - v) * t)
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`
}

function espacer(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`
}

export async function imagePartage(lignes: LignePartage[], code: string, photo: HTMLCanvasElement | null): Promise<Blob> {
  await Promise.all([document.fonts?.load(`800 72px ${POLICE}`).catch(() => null), document.fonts?.load(`500 28px ${POLICE}`).catch(() => null)])
  const W = 1600
  const H = 1200
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#0e3940"
  ctx.fillRect(0, 0, W, H)

  const source = photo ?? document.querySelector<HTMLCanvasElement>("#scene-3d canvas")
  if (source) {
    const ratio = Math.max(W / source.width, H / source.height)
    const l = source.width * ratio
    const h = source.height * ratio
    ctx.drawImage(source, (W - l) / 2, (H - h) / 2, l, h)
  }

  const haut = ctx.createLinearGradient(0, 0, 0, 300)
  haut.addColorStop(0, "rgba(3,14,20,0.94)")
  haut.addColorStop(0.55, "rgba(3,14,20,0.7)")
  haut.addColorStop(1, "rgba(3,14,20,0)")
  ctx.fillStyle = haut
  ctx.fillRect(0, 0, W, 300)
  const bas = ctx.createLinearGradient(0, H - 240, 0, H)
  bas.addColorStop(0, "rgba(3,14,20,0)")
  bas.addColorStop(0.6, "rgba(3,14,20,0.82)")
  bas.addColorStop(1, "rgba(3,14,20,0.95)")
  ctx.fillStyle = bas
  ctx.fillRect(0, H - 240, W, 240)

  const gagnants = lignes.filter((j) => j.vainqueur)
  const autres = lignes.filter((j) => !j.vainqueur)
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  const couronne = await chargerImage("/pictograms/PICTOGRAM_NOBLE.webp")
  if (couronne) {
    const t = teinter(couronne, "#f2c14e", 54)
    ctx.save()
    ctx.shadowColor = "rgba(255,200,80,0.8)"
    ctx.shadowBlur = 24
    ctx.drawImage(t, (W - t.width) / 2, 26)
    ctx.restore()
  }

  const noms = gagnants.map((g) => g.pseudo.toUpperCase()).join(" & ")
  ctx.save()
  ctx.font = `800 76px ${POLICE}`
  espacer(ctx, 10)
  ctx.shadowColor = "rgba(0,0,0,0.7)"
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.fillStyle = eclaircir(gagnants[0]?.couleur ?? "#ffd35c", 0.25)
  ctx.fillText(noms, W / 2, 150)
  ctx.restore()

  ctx.fillStyle = "rgba(243,236,214,0.85)"
  ctx.font = `500 30px ${POLICE}`
  espacer(ctx, 2)
  ctx.fillText(`${gagnants[0]?.total ?? 0} points · Favori de la cour`, W / 2, 194)

  if (autres.length) {
    const pas = Math.min(360, (W - 160) / autres.length)
    const x0 = W / 2 - (pas * (autres.length - 1)) / 2
    autres.forEach((j, i) => {
      const x = x0 + pas * i
      ctx.font = `500 22px ${POLICE}`
      espacer(ctx, 1)
      ctx.fillStyle = "rgba(243,236,214,0.55)"
      ctx.fillText(`${j.rang}.`, x, H - 118)
      ctx.font = `800 32px ${POLICE}`
      espacer(ctx, 4)
      ctx.fillStyle = eclaircir(j.couleur, 0.35)
      ctx.fillText(j.pseudo.toUpperCase(), x, H - 80)
      ctx.font = `600 24px ${POLICE}`
      espacer(ctx, 1)
      ctx.fillStyle = "rgba(243,236,214,0.8)"
      ctx.fillText(`${j.total} pts`, x, H - 48)
    })
  }

  ctx.font = `600 18px ${POLICE}`
  espacer(ctx, 3)
  ctx.fillStyle = "rgba(243,236,214,0.45)"
  ctx.textAlign = "left"
  ctx.fillText("COURTISANS ONLINE", 36, H - 20)
  ctx.textAlign = "right"
  ctx.fillText(`BANQUET ${code} · ${window.location.host} · ${new Date().toLocaleDateString("fr-FR")}`, W - 36, H - 20)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("capture"))), "image/png"))
}

export async function partagerResultat(lignes: LignePartage[], code: string, texte: string) {
  const blob = await imagePartage(lignes, code, photographierPartie(1600, 1200))
  const fichier = new File([blob], `courtisans-${code}.png`, { type: "image/png" })
  if (navigator.canShare?.({ files: [fichier] })) {
    await navigator.share({ files: [fichier], title: "Courtisans Online", text: texte })
    return "partage"
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fichier.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return "telecharge"
}
