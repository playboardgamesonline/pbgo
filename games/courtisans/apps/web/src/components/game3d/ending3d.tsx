"use client"

import type { Family, CourtisansResults, PlayerView } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  CanvasTexture,
  Color,
  type Group,
  type Mesh,
  SRGBColorSpace,
  Vector2,
} from "three"
import { useCourtisans } from "../game/context"
import { useSettings, useSettingsVersion } from "./settings"
import { MAT_ORDER } from "@/lib/catalog"
import { CARD_H, columnX, STEP, MAT_D, type DomainZone } from "./layout"
import { WINNER_AURA_SETTINGS, AURA_FIELDS } from "./aura"
import { Column } from "./column"
import type { EndingState } from "./ending"
import { TableText } from "./table-text"

const TABLE_FAMILIES = MAT_ORDER.filter((c): c is Family => c !== "queen")
const HOLO = { color: "#fff4dc", relief: "#8a6a3a", aura: "rgba(255,236,190,0.9)", fontWeight: 800 }

function Appear({ children, position, floating = 0.06 }: { children: React.ReactNode; position: [number, number, number]; floating?: number }) {
  const ref = useRef<Group>(null)
  const [phase] = useState(() => Math.random() * Math.PI * 2)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    easing.damp3(g.scale, [1, 1, 1], 0.18, dt)
    g.position.y = position[1] + Math.sin(clock.elapsedTime * 1.8 + phase) * floating
  })
  return (
    <group ref={ref} position={position} scale={0.001}>
      {children}
    </group>
  )
}

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
    <Appear position={position} floating={0}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Appear>
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

export const LINE_SETTINGS = {
  preview: false,
  width: 0.96,
  logLength: 2.1,
  elevation: 0.07,
  fade: 1.6,
  lightColor: "#ffe8a3",
  lightEdge: "#ffffff",
  lightIntensity: 0.85,
  disgraceColor: "#000000",
  disgraceEdge: "#000000",
  disgraceIntensity: 0.85,
  pulse: 0.15,
  speed: 1.6,
}

export function EndingSettings() {
  useSettings(
    "Mat Lines",
    LINE_SETTINGS,
    {
      preview: "preview on all families",
      width: ["width (× column)", 0.1, 1.5, 0.01],
      logLength: ["length (× card height)", 0.2, 5, 0.05],
      elevation: ["height", 0.02, 0.5, 0.005],
      fade: ["fade curve", 0.2, 5, 0.05],
      lightColor: "light color",
      lightEdge: "light edge color",
      lightIntensity: ["light intensity", 0, 3, 0.01],
      disgraceColor: "disgrace color",
      disgraceEdge: "disgrace edge color",
      disgraceIntensity: ["disgrace intensity", 0, 3, 0.01],
      pulse: ["pulse", 0, 1, 0.01],
      speed: ["pulse speed", 0, 8, 0.05],
    },
    { order: 9, closed: false },
  )
  useSettings("End · Mat Arrows", ENDING_SETTINGS, { arrowSize: ["arrow size", 0.3, 3, 0.05] } as never, { order: 11 })
  useSettings("End · Winner", ENDING_SETTINGS, { winnerStrength: ["winner aura", 0, 2, 0.01] } as never, { order: 12 })
  useSettings("End · Winner", WINNER_AURA_SETTINGS, AURA_FIELDS as never, { order: 12 })
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

export function MatLine({ x, light, onClick }: { x: number; light: boolean; onClick?: () => void }) {
  useSettingsVersion()
  const r = LINE_SETTINGS
  return (
    <Column
      x={x}
      z={light ? -MAT_D / 2 : MAT_D / 2}
      dir={light ? -1 : 1}
      width={STEP * r.width}
      logLength={CARD_H * r.logLength}
      elevation={r.elevation}
      fade={r.fade}
      color={light ? r.lightColor : r.disgraceColor}
      edge={light ? r.lightEdge : r.disgraceEdge}
      additive={light}
      onClick={onClick}
      strength={(t) =>
        (light ? LINE_SETTINGS.lightIntensity : LINE_SETTINGS.disgraceIntensity) *
        (1 + Math.sin(t * LINE_SETTINGS.speed) * LINE_SETTINGS.pulse)
      }
    />
  )
}

export function MatLines({ results, ending }: { results: CourtisansResults | null; ending: EndingState | null }) {
  useSettingsVersion()
  if (LINE_SETTINGS.preview)
    return (
      <>
        {TABLE_FAMILIES.map((f) => (
          <group key={f}>
            <MatLine x={columnX(f)} light />
            <MatLine x={columnX(f)} light={false} />
          </group>
        ))}
      </>
    )
  if (!results || !ending) return null
  return (
    <>
      {TABLE_FAMILIES.slice(0, ending.families).map((f) => {
        const s = results.statuses[f].status
        if (s === "neutral") return null
        return <MatLine key={f} x={columnX(f)} light={s === "light"} />
      })}
    </>
  )
}

const arrows = new Map<"up" | "down", CanvasTexture>()

/** Flèche dessinée en canvas (aucun chargement : toujours visible). Haut = lumière (clair), bas = disgrâce (sombre). */
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

/** Rasterise le pictogramme (SVG ou image Sanity) dans un canvas : la taille est fixée avant le dessin, sinon un SVG sans dimensions n'affiche rien. */
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

/** Flèche de la colonne : pictogramme du catalogue (Sanity, SVG) ; la flèche dessinée sert d'attente et de secours si l'image ne charge pas. */
function Arrow({ direction, url, position }: { direction: "up" | "down"; url?: string; position: [number, number, number] }) {
  const [texture, setTexture] = useState<CanvasTexture>(() => arrowTexture(direction))
  useEffect(() => {
    if (url) loadArrow(url, setTexture)
  }, [url])
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (ref.current) ref.current.scale.setScalar(ENDING_SETTINGS.arrowSize)
  })
  return (
    <Appear position={position} floating={0}>
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Appear>
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
              <Appear position={[0, 0, 0]} floating={0}>
                <TableText
                  text={points > 0 ? `+${points}` : points < 0 ? `−${-points}` : "+0"}
                  style={{
                    color,
                    relief: ENDING_SETTINGS.relief ? "#1a1a1a" : undefined,
                    fontWeight: 800,
                    shadow: `${shadowRgba()}|${ENDING_SETTINGS.shadowBlur}|${ENDING_SETTINGS.shadowOffset}`,
                  }}
                  elevation={ENDING_SETTINGS.pointsSize}
                  position={[0, 0, 0]}
                  order={7}
                />
              </Appear>
            </group>
          )
        })
      })}
    </group>
  )
}

/** Mission réussie : « +3 » doré, comme les points des piles ; ratée : croix grise, comme le signe égal. Fixes (pas de flottement ni de clignotement). */
export function MissionSign({ done, points, position }: { done: boolean; points: number; position: [number, number, number] }) {
  useSettingsVersion()
  if (!done) return <Sign sign="cross" size={1} position={position} />
  return (
    <group position={position}>
      <Appear position={[0, 0, 0]} floating={0}>
        <TableText
          text={`+${points}`}
          style={{
            color: ENDING_SETTINGS.positiveColor,
            relief: ENDING_SETTINGS.relief ? "#1a1a1a" : undefined,
            fontWeight: 800,
            shadow: `${shadowRgba()}|${ENDING_SETTINGS.shadowBlur}|${ENDING_SETTINGS.shadowOffset}`,
          }}
          elevation={ENDING_SETTINGS.pointsSize}
          position={[0, 0, 0]}
          order={8}
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
          <Appear key={j.id} position={[zone.center.x, ENDING_SETTINGS.counterHeight, zone.center.z]} floating={0}>
            {ENDING_SETTINGS.counterBackdrop > 0.01 && (
              <mesh rotation-x={-Math.PI / 2} position-y={-0.02} raycast={() => null}>
                <circleGeometry args={[1.25, 48]} />
                <meshBasicMaterial map={roundBg()} color="#02151a" transparent opacity={ENDING_SETTINGS.counterBackdrop} depthWrite={false} toneMapped={false} />
              </mesh>
            )}
            <TableText
              text={`${total}`}
              style={{ ...HOLO, spacing: "4px", shadow: `rgba(0,0,0,${ENDING_SETTINGS.counterShadow})|${ENDING_SETTINGS.counterShadowBlur}|${ENDING_SETTINGS.counterShadowOffset}` }}
              elevation={1.5}
              position={[0, 0, 0]}
            />
          </Appear>
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
