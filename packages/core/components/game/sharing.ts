"use client"

import { captureGamePhoto } from "@pgo/binding-ui"
import { SLUG } from "@pgo/binding"

export type ShareRow = {
  rank: number
  nickname: string
  color: string
  total: number
  winner: boolean
}

const FONT = 'ui-rounded, "Avenir Next", "Nunito", system-ui, sans-serif'

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, y: number, l: number) {
  const h = l * 0.78
  const x = cx - l / 2
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + h * 0.25)
  ctx.lineTo(x + l * 0.27, y + h * 0.55)
  ctx.lineTo(cx, y)
  ctx.lineTo(x + l * 0.73, y + h * 0.55)
  ctx.lineTo(x + l, y + h * 0.25)
  ctx.lineTo(x + l, y + h)
  ctx.closePath()
  ctx.fill()
}

function lighten(hex: string, t: number) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  const m = (v: number) => Math.round(v + (255 - v) * t)
  return `rgb(${m((n >> 16) & 255)}, ${m((n >> 8) & 255)}, ${m(n & 255)})`
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`
}

export async function shareImage(lines: ShareRow[], photo: HTMLCanvasElement | null, title: string): Promise<Blob> {
  await Promise.all([document.fonts?.load(`800 72px ${FONT}`).catch(() => null), document.fonts?.load(`500 28px ${FONT}`).catch(() => null)])
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

  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(W / H, 1)
  const vignette = ctx.createRadialGradient(0, 0, H * 0.22, 0, 0, H * 0.72)
  vignette.addColorStop(0, "rgba(3,14,20,0)")
  vignette.addColorStop(0.55, "rgba(3,14,20,0.18)")
  vignette.addColorStop(1, "rgba(3,14,20,0.72)")
  ctx.fillStyle = vignette
  ctx.fillRect(-W, -H, 2 * W, 2 * H)
  ctx.restore()
  const above = ctx.createLinearGradient(0, 0, 0, 260)
  above.addColorStop(0, "rgba(3,14,20,0.55)")
  above.addColorStop(1, "rgba(3,14,20,0)")
  ctx.fillStyle = above
  ctx.fillRect(0, 0, W, 260)
  const below = ctx.createLinearGradient(0, H - 220, 0, H)
  below.addColorStop(0, "rgba(3,14,20,0)")
  below.addColorStop(1, "rgba(3,14,20,0.6)")
  ctx.fillStyle = below
  ctx.fillRect(0, H - 220, W, 220)

  const winners = lines.filter((j) => j.winner)
  const others = lines.filter((j) => !j.winner)
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  ctx.save()
  ctx.shadowColor = "rgba(255,200,80,0.8)"
  ctx.shadowBlur = 24
  ctx.fillStyle = "#f2c14e"
  drawCrown(ctx, W / 2, 30, 64)
  ctx.restore()

  const names = winners.map((g) => g.nickname.toUpperCase()).join(" & ")
  ctx.save()
  ctx.font = `800 76px ${FONT}`
  setSpacing(ctx, 10)
  ctx.shadowColor = "rgba(0,0,0,0.7)"
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.fillStyle = lighten(winners[0]?.color ?? "#ffd35c", 0.25)
  ctx.fillText(names, W / 2, 150)
  ctx.restore()

  ctx.fillStyle = "rgba(243,236,214,0.85)"
  ctx.font = `500 30px ${FONT}`
  setSpacing(ctx, 2)
  ctx.fillText(`${winners[0]?.total ?? 0} points · Victoire`, W / 2, 194)

  if (others.length) {
    const stride = Math.min(360, (W - 160) / others.length)
    const x0 = W / 2 - (stride * (others.length - 1)) / 2
    others.forEach((j, i) => {
      const x = x0 + stride * i
      ctx.font = `500 22px ${FONT}`
      setSpacing(ctx, 1)
      ctx.fillStyle = "rgba(243,236,214,0.55)"
      ctx.fillText(`${j.rank}.`, x, H - 118)
      ctx.font = `800 32px ${FONT}`
      setSpacing(ctx, 4)
      ctx.fillStyle = lighten(j.color, 0.35)
      ctx.fillText(j.nickname.toUpperCase(), x, H - 80)
      ctx.font = `600 24px ${FONT}`
      setSpacing(ctx, 1)
      ctx.fillStyle = "rgba(243,236,214,0.8)"
      ctx.fillText(`${j.total} pts`, x, H - 48)
    })
  }

  const now = new Date()
  const date = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  ctx.font = `600 18px ${FONT}`
  setSpacing(ctx, 3)
  ctx.fillStyle = "rgba(243,236,214,0.45)"
  ctx.textAlign = "left"
  ctx.fillText(title.toUpperCase(), 36, H - 20)
  ctx.textAlign = "right"
  setSpacing(ctx, 1.5)
  ctx.fillText(`${date} · ${time}`, W - 36, H - 20)

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("capture"))), "image/png"))
}

export async function generateShareImage(lines: ShareRow[], code: string, title: string) {
  const blob = await shareImage(lines, captureGamePhoto(1600, 1200), title)
  return new File([blob], `${SLUG}-${code}.png`, { type: "image/png" })
}

export function canShare(file: File) {
  return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] })
}

export async function shareFile(file: File, text: string, title: string) {
  await navigator.share({ files: [file], title, text })
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function copyImage(file: File) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": file })])
}
