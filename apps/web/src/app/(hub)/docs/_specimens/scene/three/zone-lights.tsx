"use client"

import { Aura, type AuraLook, type CameraSettings, LightBand, type SurfaceProps } from "@pbgo/table"
import { RestingCards, Stage } from "./parts"

// Two lights the table draws on its surface: a glow round a zone, and a band of light that lies on the table and fades away from one end. The cards lie where they were dropped, some inside the zone and one in the light band.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 15, fov: 34, targetX: 0, targetZ: 0.2 }

/** A table that is neither dark nor light, so that a glow shows on it and a dark band does too */
const TABLE: SurfaceProps = { color: "#1b4047", layers: [{ kind: "lattice", line: "#235058", diamonds: 3, width: 2.5 }], light: { center: "#2a5d65" } }

/** The colours of the glow the specimen offers: its colour, and the brighter one its rim and stars turn to */
export const AURA_COLORS = {
  gold: { label: "Gold", color: "#ffc247", bright: "#fff5c7" },
  blue: { label: "Blue", color: "#4fa3ff", bright: "#d6ebff" },
  rose: { label: "Rose", color: "#ff6fa8", bright: "#ffd9e8" },
} as const
export type AuraColor = keyof typeof AURA_COLORS

export type ZoneLightsKnobs = { strength: number; color: AuraColor; stars: number; speed: number; light: boolean; dark: boolean; pulse: number; fade: number }

export function ZoneLightsScene({ strength, color, stars, speed, light, dark, pulse, fade }: ZoneLightsKnobs) {
  const look: Partial<AuraLook> = { stars, speed }
  const { color: glow, bright } = AURA_COLORS[color]
  return (
    <Stage id="scene-zone-lights" camera={CAMERA} playIntro={false} surface={TABLE}>
      <RestingCards />
      {/* The glow goes round the zone the first two cards lie in */}
      <Aura size={{ width: 5.6, depth: 2.9 }} frame={{ x: -3.15, z: 0.1 }} strength={strength} color={glow} bright={bright} look={look} />
      {/* A light band runs away from the viewer from its bright end, and a dark one toward them from the far side */}
      <LightBand frame={{ x: 3.7, z: 2.3 }} width={1.5} length={4.2} color="#ffe8a3" edge="#ffffff" strength={light ? 0.85 : 0} pulse={pulse} fade={fade} />
      <LightBand frame={{ x: 6.1, z: -2.1, yaw: Math.PI }} width={1.5} length={4.2} color="#000000" strength={dark ? 0.85 : 0} pulse={pulse} fade={fade} additive={false} />
    </Stage>
  )
}
