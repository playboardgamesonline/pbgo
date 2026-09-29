"use client"

import { type VisibleCard, FAMILIES, type Mission, ROLES } from "@courtisans/engine"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from "three"
import { DEFAULT_CATALOG, type ClientCatalog, cardKey } from "@/lib/catalog"
import { DEFAULT_MISSION_IMAGES } from "@/lib/default-missions"

function textTexture(text: string, bg: string, ink: string, ratio: number) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = Math.round(512 * ratio)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = ink
  ctx.textAlign = "center"
  ctx.font = "bold 40px Georgia, serif"
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    if (ctx.measureText(`${line} ${word}`).width > 440) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * 48))
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

const BADGES = [
  { pattern: /en disgrâce|fallen from grace/i, bg: "#002C37", ink: "#CF9400" },
  { pattern: /dans la lumière|en lumière|esteemed/i, bg: "#EFE8CD", ink: "#B38200" },
]
const BADGE_PATTERN = new RegExp(BADGES.map((b) => b.pattern.source).join("|"), "gi")

type Piece = { text: string; badge?: (typeof BADGES)[number] }

function cutOut(text: string): Piece[] {
  const pieces: Piece[] = []
  let rest = 0
  const words = (t: string) =>
    t
      .split(/\s+/)
      .filter(Boolean)
      .forEach((m) => pieces.push({ text: m }))
  for (const r of text.matchAll(BADGE_PATTERN)) {
    words(text.slice(rest, r.index))
    pieces.push({ text: r[0], badge: BADGES.find((b) => b.pattern.test(r[0])) })
    rest = r.index + r[0].length
  }
  words(text.slice(rest))
  return pieces
}

const margin = (size: number) => size * 0.32

function width(ctx: CanvasRenderingContext2D, line: Piece[], size: number) {
  const space = ctx.measureText(" ").width
  return line.reduce((l, m, i) => l + ctx.measureText(m.text).width + (m.badge ? margin(size) * 2 : 0) + (i ? space : 0), 0)
}

function twoLines(ctx: CanvasRenderingContext2D, pieces: Piece[], size: number): Piece[][] {
  if (pieces.length < 2) return [pieces]
  let best: Piece[][] = [pieces]
  let minWidth = Number.POSITIVE_INFINITY
  for (let i = 1; i < pieces.length; i++) {
    const lines = [pieces.slice(0, i), pieces.slice(i)]
    const l = Math.max(...lines.map((x) => width(ctx, x, size)))
    if (l < minWidth) {
      minWidth = l
      best = lines
    }
  }
  return best
}

function drawLine(ctx: CanvasRenderingContext2D, line: Piece[], centerX: number, y: number, size: number) {
  const space = ctx.measureText(" ").width
  let x = centerX - width(ctx, line, size) / 2
  ctx.textAlign = "left"
  for (const m of line) {
    const w = ctx.measureText(m.text).width
    if (m.badge) {
      const h = size * 1.12
      const l = w + margin(size) * 2
      ctx.beginPath()
      ctx.roundRect(x, y - h / 2, l, h, size * 0.24)
      ctx.fillStyle = m.badge.bg
      ctx.fill()
      ctx.lineWidth = Math.max(2, size * 0.045)
      ctx.strokeStyle = m.badge.ink
      ctx.stroke()
      ctx.fillStyle = m.badge.ink
      ctx.fillText(m.text, x + margin(size), y + size * 0.02)
      x += l + space
    } else {
      ctx.fillStyle = "#141414"
      ctx.fillText(m.text, x, y)
      x += w + space
    }
  }
}

const FONT = '"Alegreya Variable", "Alegreya", Georgia, serif'

async function composeMission(image: Texture, text: string): Promise<Texture> {
  await document.fonts?.load(`600 40px ${FONT}`).catch(() => null)
  const source = image.image as CanvasImageSource & {
    width: number
    height: number
  }
  const canvas = document.createElement("canvas")
  canvas.width = 1376
  canvas.height = 904
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const maxWidth = canvas.width * 0.6
  let size = 58
  const pieces = cutOut(text)
  ctx.font = `600 ${size}px ${FONT}`
  let lines = twoLines(ctx, pieces, size)
  while (size > 30 && Math.max(...lines.map((l) => width(ctx, l, size))) > maxWidth) {
    size -= 2
    ctx.font = `600 ${size}px ${FONT}`
    lines = twoLines(ctx, pieces, size)
  }
  ctx.textBaseline = "middle"
  const lineHeight = size * (pieces.some((m) => m.badge) ? 1.32 : 1.15)
  const center = canvas.height * 0.705
  lines.forEach((l, i) => drawLine(ctx, l, canvas.width / 2, center + (i - (lines.length - 1) / 2) * lineHeight, size))
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

const composed = new WeakMap<Texture, Map<string, Promise<Texture>>>()
function composedMission(image: Texture, text: string) {
  let byText = composed.get(image)
  if (!byText) composed.set(image, (byText = new Map()))
  let promise = byText.get(text)
  if (!promise) {
    promise = composeMission(image, text).catch(() => image)
    byText.set(text, promise)
  }
  return promise
}

const loader = new TextureLoader().setCrossOrigin("anonymous")
const cache = new Map<string, Promise<Texture>>()

function load(url: string): Promise<Texture> {
  let promise = cache.get(url)
  if (!promise) {
    promise = loader.loadAsync(url).then((t) => {
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 8
      return t
    })
    promise.catch(() => cache.delete(url))
    cache.set(url, promise)
  }
  return promise
}

async function loadWithFallback(urls: (string | null | undefined)[]): Promise<Texture | null> {
  for (const url of urls) {
    if (!url) continue
    try {
      return await load(url)
    } catch {
      console.warn(`Image indisponible, essai suivant : ${url}`)
    }
  }
  return null
}

export type Textures = {
  face: (card: VisibleCard) => Texture
  back: Texture
  mat: Texture
  cloth: Texture | null
  mission: (m: Mission) => Texture
  missionBack: (m: Mission) => Texture
}

type Source = {
  key: string
  urls: (string | null | undefined)[]
  text?: string
}

export function useTextures(catalog: ClientCatalog, missions: Mission[]): Textures {
  const d = DEFAULT_CATALOG
  const sources = useMemo<Source[]>(() => {
    const list: Source[] = [
      { key: "mat", urls: [catalog.matUrl, d.matUrl] },
      { key: "tissu", urls: [catalog.clothUrl, d.clothUrl] },
      { key: "dos", urls: [catalog.courtierBackUrl, d.courtierBackUrl] },
      {
        key: "whiteBack",
        urls: [catalog.whiteMissionBackUrl, d.whiteMissionBackUrl],
      },
      {
        key: "blueBack",
        urls: [catalog.blueMissionBackUrl, d.blueMissionBackUrl],
      },
    ]
    for (const f of FAMILIES)
      for (const r of [null, ...ROLES]) {
        const key = cardKey(f, r)
        list.push({
          key: `face:${key}`,
          urls: [catalog.cards[key], d.cards[key]],
        })
      }
    for (const m of missions)
      list.push({
        key: `mission:${m.id}`,
        urls: [catalog.missions[m.id], DEFAULT_MISSION_IMAGES[m.id]],
        text: m.text,
      })
    return list
  }, [catalog, missions, d])

  const [loaded, setLoaded] = useState<Record<string, Texture>>({})

  useEffect(() => {
    let active = true
    for (const { key, urls, text } of sources) {
      loadWithFallback(urls)
        .then((t) => (t && text ? composedMission(t, text) : t))
        .then((t) => {
          if (t && key === "tissu") {
            t.wrapS = t.wrapT = RepeatWrapping
            t.needsUpdate = true
          }
          return t
        })
        .then((t) => {
          if (active && t) setLoaded((c) => (c[key] === t ? c : { ...c, [key]: t }))
        })
    }
    return () => {
      active = false
    }
  }, [sources])

  const [fallbackUrl] = useState(() => new Map<string, Texture>())

  return useMemo(() => {
    const fallback = (key: string, create: () => Texture) => {
      if (!fallbackUrl.has(key)) fallbackUrl.set(key, create())
      return fallbackUrl.get(key)!
    }
    const back = loaded.back ?? fallback("dos", () => textTexture("★", "#10363c", "#d9a93f", 890 / 472))
    return {
      mat: loaded.mat ?? fallback("mat", () => textTexture("", "#1b3f45", "#fff", 579 / 2362)),
      back,
      cloth: loaded.cloth ?? null,
      face: (c) => {
        if (!c.family) return back
        const key = cardKey(c.family, c.role)
        return loaded[`face:${key}`] ?? fallback(key, () => textTexture("", catalog.families[c.family!].color, "#fff", 890 / 472))
      },
      mission: (m) =>
        loaded[`mission:${m.id}`] ??
        fallback(`m:${m.id}`, () =>
          textTexture(m.text, m.color === "blue" ? "#0d5c63" : "#efe1bf", m.color === "blue" ? "#fff" : "#10363c", 452 / 688),
        ),
      missionBack: (m) =>
        (m.color === "blue" ? loaded.blueBack : loaded.whiteBack) ??
        fallback(`dm:${m.color}`, () => textTexture("★", m.color === "blue" ? "#0d3b43" : "#e8d7ae", "#c9a227", 452 / 688)),
    }
  }, [loaded, catalog, fallbackUrl])
}
