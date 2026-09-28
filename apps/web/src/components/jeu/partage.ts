"use client"

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

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, l, h, r)
}

export async function imagePartage(lignes: LignePartage[], code: string): Promise<Blob> {
  await document.fonts?.load(`700 40px ${POLICE}`).catch(() => null)
  const scene = document.querySelector<HTMLCanvasElement>("#scene-3d canvas")
  const W = 1800
  const H = 1000
  const panneau = 640
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#0e3940"
  ctx.fillRect(0, 0, W, H)

  if (scene) {
    const zone = W - panneau
    const ratio = Math.max(zone / scene.width, H / scene.height)
    const l = scene.width * ratio
    const h = scene.height * ratio
    ctx.drawImage(scene, (zone - l) / 2, (H - h) / 2, l, h)
  }
  const degrade = ctx.createLinearGradient(W - panneau - 120, 0, W - panneau, 0)
  degrade.addColorStop(0, "rgba(11,34,49,0)")
  degrade.addColorStop(1, "rgba(11,34,49,0.97)")
  ctx.fillStyle = degrade
  ctx.fillRect(W - panneau - 120, 0, 120, H)
  ctx.fillStyle = "rgba(11,34,49,0.97)"
  ctx.fillRect(W - panneau, 0, panneau, H)

  const x0 = W - panneau + 56
  const largeur = panneau - 112
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#f3ecd6"
  ctx.font = `700 46px ${POLICE}`
  ctx.fillText("COURTISANS ONLINE", x0, 100)
  ctx.fillStyle = "rgba(243,236,214,0.55)"
  ctx.font = `500 24px ${POLICE}`
  ctx.fillText(`Banquet ${code} · ${new Date().toLocaleDateString("fr-FR")}`, x0, 138)

  let y = 190
  for (const j of lignes) {
    const hauteur = j.vainqueur ? 150 : 118
    arrondi(ctx, x0 - 18, y, largeur + 36, hauteur, 18)
    ctx.fillStyle = j.vainqueur ? "rgba(242,193,78,0.16)" : "rgba(255,255,255,0.05)"
    ctx.fill()
    if (j.vainqueur) {
      ctx.strokeStyle = "rgba(242,193,78,0.7)"
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = "rgba(243,236,214,0.5)"
    ctx.font = `600 26px ${POLICE}`
    ctx.fillText(`${j.rang}.`, x0, y + 50)
    ctx.fillStyle = j.couleur
    ctx.font = `800 ${j.vainqueur ? 40 : 32}px ${POLICE}`
    ctx.fillText(j.pseudo.toUpperCase(), x0 + 44, y + 52)
    ctx.textAlign = "right"
    ctx.fillStyle = j.vainqueur ? "#ffd35c" : "#f3ecd6"
    ctx.font = `800 ${j.vainqueur ? 48 : 38}px ${POLICE}`
    ctx.fillText(`${j.total}`, x0 + largeur, y + 54)
    ctx.textAlign = "left"
    ctx.fillStyle = "rgba(243,236,214,0.7)"
    ctx.font = `500 22px ${POLICE}`
    ctx.fillText(
      `Domaine ${j.domaine >= 0 ? "+" : ""}${j.domaine} · Missions +${j.missions} (${j.missionsReussies}/2)`,
      x0 + 44,
      y + (j.vainqueur ? 92 : 84),
    )
    let fx = x0 + 44
    const fy = y + (j.vainqueur ? 106 : 96)
    for (const f of j.familles) {
      ctx.fillStyle = f.couleur
      arrondi(ctx, fx, fy, 50, 26, 8)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = `700 18px ${POLICE}`
      ctx.textAlign = "center"
      ctx.fillText(`${f.points > 0 ? "+" : ""}${f.points}`, fx + 25, fy + 19)
      ctx.textAlign = "left"
      fx += 58
    }
    y += hauteur + 18
  }
  ctx.fillStyle = "rgba(243,236,214,0.45)"
  ctx.font = `500 20px ${POLICE}`
  ctx.fillText(window.location.host, x0, H - 40)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("capture"))), "image/png"))
}

export async function partagerResultat(lignes: LignePartage[], code: string, texte: string) {
  const blob = await imagePartage(lignes, code)
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
