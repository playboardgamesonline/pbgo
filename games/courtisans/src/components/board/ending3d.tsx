"use client"

import type { CourtisansResults, PlayerView } from "@courtisans/engine"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, Color, SRGBColorSpace, Vector2 } from "three"
import { useCourtisans } from "../game/context"
import { Appear, type AuraLook, AURA_FIELDS, AURA_LOOK, Picture, TableText, useSettings, useSettingsVersion } from "@pbgo/table"
import { columnX, MAT_D, type DomainZone, TABLE_FAMILIES } from "./layout"
import type { EndingState } from "./ending"
import { LETTERING_FONT } from "./font"

/** How the aura of the winners looks: the table's own look, which the End · Winner folder of the debug panel edits */
export const WINNER_AURA: AuraLook = { ...AURA_LOOK }
const HOLO = { color: "#fff4dc", relief: "#8a6a3a", aura: "rgba(255,236,190,0.9)", weight: 800 }

/** How a sign, an arrow or a number comes onto the table at the end: it lands on its place from a little above it while it fades in */
const LAND = { drop: 0.5, duration: 0.45 }

let rond: CanvasTexture | null = null
function roundBg() {
  if (!rond) {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.55, "rgba(255,255,255,0.8)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    rond = new CanvasTexture(c)
  }
  return rond
}

type Sign = "plus" | "minus" | "equal" | "cross"
const signs = new Map<Sign, CanvasTexture>()

function signTexture(sign: Sign) {
  let t = signs.get(sign)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = 256
    const g = c.getContext("2d")!
    const bars: [number, number, number, number][] =
      sign === "plus"
        ? [
            [48, 104, 160, 48],
            [104, 48, 48, 160],
          ]
        : sign === "minus"
          ? [[48, 104, 160, 48]]
          : [
              [48, 72, 160, 44],
              [48, 140, 160, 44],
            ]
    const trace = () => {
      g.beginPath()
      if (sign === "cross") {
        for (const angle of [Math.PI / 4, -Math.PI / 4]) {
          g.save()
          g.translate(128, 128)
          g.rotate(angle)
          g.roundRect(-80, -24, 160, 48, 9)
          g.restore()
        }
        return
      }
      for (const [x, y, l, h] of bars) g.roundRect(x, y, l, h, 9)
    }
    g.lineJoin = "round"
    g.shadowColor = "rgba(0,0,0,0.45)"
    g.shadowBlur = 16
    g.shadowOffsetY = 6
    trace()
    g.lineWidth = 22
    g.strokeStyle = "#fbf6ea"
    g.stroke()
    g.shadowColor = "transparent"
    trace()
    g.fillStyle = "#fbf6ea"
    g.fill()
    trace()
    g.fillStyle = "#2f2f33"
    g.fill()
    t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    signs.set(sign, t)
  }
  return t
}

function Sign({ sign, position, size = 1.15 }: { sign: Sign; position: [number, number, number]; size?: number }) {
  const [texture] = useState(() => signTexture(sign))
  return (
    <group position={position}>
      <Appear {...LAND}>
        <Picture texture={texture} width={size} aspect={1} />
      </Appear>
    </group>
  )
}

export const ENDING_SETTINGS = {
  arrowSize: 1.5,
  winnerStrength: 0.4,
  pointsSize: 0.75,
  positiveColor: "#ffd35c",
  negativeColor: "#ff5a5a",
  zeroColor: "#a8b0b2",
  relief: true,
  shadowColor: "#000000",
  shadowOpacity: 0.05,
  shadowBlur: 2,
  shadowOffset: 2,
  counterBackdrop: 0,
  counterShadow: 0.3,
  counterShadowBlur: 14,
  counterShadowOffset: 5,
  counterHeight: 1.1,
}

export function EndingSettings() {
  useSettings("End · Mat Arrows", ENDING_SETTINGS, { arrowSize: ["arrow size", 0.3, 3, 0.05] } as never, { order: 11 })
  useSettings("End · Winner", ENDING_SETTINGS, { winnerStrength: ["winner aura", 0, 2, 0.01] } as never, { order: 12 })
  useSettings("End · Winner", WINNER_AURA, AURA_FIELDS, { order: 12 })
  useSettings(
    "End · Pile Points",
    ENDING_SETTINGS,
    {
      pointsSize: ["size", 0.3, 2, 0.05],
      positiveColor: "positive color",
      negativeColor: "negative color",
      zeroColor: "zero color",
      relief: "relief",
      shadowColor: "drop shadow color",
      shadowOpacity: ["drop shadow opacity", 0, 1, 0.01],
      shadowBlur: ["drop shadow blur", 0, 60, 1],
      shadowOffset: ["drop shadow offset", -30, 30, 1],
    } as never,
    { order: 13 },
  )
  useSettings(
    "End · Counter",
    ENDING_SETTINGS,
    {
      counterBackdrop: ["dark disc opacity", 0, 1, 0.01],
      counterShadow: ["text shadow opacity", 0, 1, 0.01],
      counterShadowBlur: ["text shadow blur", 0, 60, 1],
      counterShadowOffset: ["text shadow offset", -30, 30, 1],
      counterHeight: ["height", 0, 3, 0.05],
    } as never,
    { order: 13 },
  )
  return null
}

const arrows = new Map<"up" | "down", CanvasTexture>()

/** Arrow drawn on a canvas (nothing to load: always visible). Up = light (bright), down = disgrace (dark). */
function arrowTexture(direction: "up" | "down") {
  let t = arrows.get(direction)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = 256
    const g = c.getContext("2d")!
    g.translate(128, 128)
    if (direction === "down") g.scale(1, -1)
    g.beginPath()
    g.moveTo(0, -104)
    g.lineTo(86, -8)
    g.lineTo(34, -8)
    g.lineTo(34, 100)
    g.lineTo(-34, 100)
    g.lineTo(-34, -8)
    g.lineTo(-86, -8)
    g.closePath()
    g.lineJoin = "round"
    g.shadowColor = "rgba(0,0,0,0.3)"
    g.shadowBlur = 6
    g.shadowOffsetY = 2
    g.lineWidth = 16
    g.strokeStyle = "#cf9400"
    g.stroke()
    g.shadowColor = "transparent"
    g.fillStyle = direction === "up" ? "#efe8cd" : "#002c37"
    g.fill()
    t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    arrows.set(direction, t)
  }
  return t
}

const arrowImages = new Map<string, CanvasTexture>()

/** Rasterizes the pictogram (SVG or Sanity image) into a canvas: the size is set before drawing, otherwise an SVG without dimensions shows nothing. */
function loadArrow(url: string, onReady: (t: CanvasTexture) => void) {
  const cached = arrowImages.get(url)
  if (cached) return onReady(cached)
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.onload = () => {
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1)
    const c = document.createElement("canvas")
    c.width = 512
    c.height = Math.max(1, Math.round(512 / ratio))
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    arrowImages.set(url, t)
    onReady(t)
  }
  img.src = url
}

/** Arrow of the column: pictogram of the catalog (Sanity, SVG); the drawn arrow is shown while it loads, when the catalog has none and if it fails. */
function Arrow({ direction, url, position }: { direction: "up" | "down"; url?: string | null; position: [number, number, number] }) {
  const [texture, setTexture] = useState<CanvasTexture>(() => arrowTexture(direction))
  useEffect(() => {
    if (url) loadArrow(url, setTexture)
  }, [url])
  return (
    <group position={position}>
      <Appear {...LAND}>
        <Picture texture={texture} width={ENDING_SETTINGS.arrowSize} aspect={1} />
      </Appear>
    </group>
  )
}

export function FamilyResolution({ results, ending }: { results: CourtisansResults; ending: EndingState }) {
  const { catalog } = useCourtisans()
  useSettingsVersion()
  return (
    <>
      {TABLE_FAMILIES.slice(0, ending.families).map((f) => {
        const s = results.statuses[f]
        const x = columnX(f)
        const light = s.status === "light"
        const disgrace = s.status === "disgrace"
        return (
          <group key={f}>
            {light || disgrace ? (
              <Arrow direction={light ? "up" : "down"} url={light ? catalog.arrowUpUrl : catalog.arrowDownUrl} position={[x, 0.12, light ? -MAT_D / 2 + 0.05 : MAT_D / 2 - 0.05]} />
            ) : (
              <Sign sign="equal" position={[x, 0.1, 0]} />
            )}
          </group>
        )
      })}
    </>
  )
}

function shadowRgba() {
  const c = new Color(ENDING_SETTINGS.shadowColor)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${ENDING_SETTINGS.shadowOpacity})`
}

export function PilePoints({ view, results, ending, zones }: { view: PlayerView; results: CourtisansResults; ending: EndingState; zones: Map<string, DomainZone> }) {
  useSettingsVersion()
  if (ending.pile === 0) return null
  return (
    <group renderOrder={7}>
      {view.players.map((j) => {
        const zone = zones.get(j.id)
        const r = results.players.find((x) => x.playerId === j.id)
        if (!zone || !r) return null
        return zone.piles.slice(0, ending.pile).map((pile, i) => {
          if (!pile.family) return null
          const points = r.families.find((d) => d.family === pile.family)?.points ?? 0
          const color = points > 0 ? ENDING_SETTINGS.positiveColor : points < 0 ? ENDING_SETTINGS.negativeColor : ENDING_SETTINGS.zeroColor
          return (
            <group key={`${j.id}-${i}`} position={pile.position}>
              <Appear {...LAND}>
                <TableText
                  text={points > 0 ? `+${points}` : points < 0 ? `−${-points}` : "+0"}
                  style={{
                    color,
                    relief: ENDING_SETTINGS.relief ? "#1a1a1a" : undefined,
                    weight: 800,
                    shadow: `${shadowRgba()}|${ENDING_SETTINGS.shadowBlur}|${ENDING_SETTINGS.shadowOffset}`,
                  }}
                  height={ENDING_SETTINGS.pointsSize}
                  font={LETTERING_FONT}
                  position={[0, 0, 0]}
                  layer={7}
                />
              </Appear>
            </group>
          )
        })
      })}
    </group>
  )
}

/** Mission achieved: golden "+3", like the points of the piles; failed: grey cross, like the equal sign. Static (no floating or blinking). */
export function MissionSign({ done, points, position }: { done: boolean; points: number; position: [number, number, number] }) {
  useSettingsVersion()
  if (!done) return <Sign sign="cross" size={1} position={position} />
  return (
    <group position={position}>
      <Appear {...LAND}>
        <TableText
          text={`+${points}`}
          style={{
            color: ENDING_SETTINGS.positiveColor,
            relief: ENDING_SETTINGS.relief ? "#1a1a1a" : undefined,
            weight: 800,
            shadow: `${shadowRgba()}|${ENDING_SETTINGS.shadowBlur}|${ENDING_SETTINGS.shadowOffset}`,
          }}
          height={ENDING_SETTINGS.pointsSize}
          font={LETTERING_FONT}
          position={[0, 0, 0]}
          layer={8}
        />
      </Appear>
    </group>
  )
}

export function Counters({ view, results, ending, zones }: { view: PlayerView; results: CourtisansResults; ending: EndingState; zones: Map<string, DomainZone> }) {
  useSettingsVersion()
  if (ending.pile === 0 && !ending.missions) return null
  return (
    <>
      {view.players.map((j) => {
        const zone = zones.get(j.id)
        const r = results.players.find((x) => x.playerId === j.id)
        if (!zone || !r) return null
        const piles = r.families.slice(0, ending.pile)
        const total = piles.reduce((s, d) => s + d.points, 0) + (ending.missions ? r.missions.reduce((s, m) => s + m.points, 0) : 0)
        return (
          <group key={j.id} position={[zone.center.x, ENDING_SETTINGS.counterHeight, zone.center.z]}>
            <Appear {...LAND}>
            {ENDING_SETTINGS.counterBackdrop > 0.01 && <Picture texture={roundBg()} width={2.5} aspect={1} lift={-0.02} order={0} color="#02151a" opacity={ENDING_SETTINGS.counterBackdrop} />}
            <TableText
              text={`${total}`}
              style={{ ...HOLO, spacing: "4px", shadow: `rgba(0,0,0,${ENDING_SETTINGS.counterShadow})|${ENDING_SETTINGS.counterShadowBlur}|${ENDING_SETTINGS.counterShadowOffset}` }}
              height={1.5}
              font={LETTERING_FONT}
              position={[0, 0, 0]}
            />
            </Appear>
          </group>
        )
      })}
    </>
  )
}

export function useWinnerCenters(winnerIds: string[], zones: Map<string, DomainZone>) {
  return useMemo(() => {
    const centers = winnerIds.map((id) => zones.get(id)).filter((z): z is DomainZone => !!z)
    const axes = new Vector2(
      Math.max(...centers.map((z) => (Math.abs(Math.sin(z.yaw)) > 0.5 ? z.depth : z.width) / 2 + 1), 3),
      Math.max(...centers.map((z) => (Math.abs(Math.sin(z.yaw)) > 0.5 ? z.width : z.depth) / 2 + 1), 2.5),
    )
    return { centers: centers.map((z) => new Vector2(z.center.x, z.center.z)), winnerZones: centers, axes }
  }, [winnerIds, zones])
}
