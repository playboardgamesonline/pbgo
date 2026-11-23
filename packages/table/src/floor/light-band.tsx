"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { AdditiveBlending, Color, type Mesh, NormalBlending, type ShaderMaterial } from "three"
import type { Spot } from "../layout"
import { BAND, bandTarget, tint } from "./zone-light"

export type LightBandProps = {
  /** Where the bright end of the band lies and which way it runs from there: along the frame's own -z, which is away from the viewer when it is not turned, so a yaw of half a turn runs it toward the viewer */
  frame: Spot
  /** How wide it is, along the frame's x, in world units */
  width: number
  /** How long it is, from its bright end to the end where it has faded out, in world units */
  length: number
  /** How high above the table it lies (`BAND.height`) */
  y?: number
  /** The colour of the band */
  color: string
  /** The colour of its two sides, a hair brighter or darker than the middle (default `color`) */
  edge?: string
  /** How fast it fades toward its far end: the power of what is left of its length (`BAND.fade`, 1.6); more is a shorter band */
  fade?: number
  /** How strong it is, 0 and up (`BAND.strength`, 0.85): 0 draws nothing, and it settles on a new value in a fraction of a second */
  strength?: number
  /** How much it swells and dims, as a share of its strength (`BAND.pulse`, 0.15), and how fast, in radians a second (`BAND.speed`, 1.6). A visitor who asks for less motion gets it steady */
  pulse?: number
  speed?: number
  /** It adds its light to the table (default), which a light band needs; false lays it over the table, which a dark band needs */
  additive?: boolean
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// A band that is at its fullest at the end it starts from (v = 0) and fades as the power `uFade` of what is left of it, with sides that are cut with a soft border and tinted a little with the edge colour
const FRAGMENT = /* glsl */ `
uniform float uStrength;
uniform vec3 uColor;
uniform vec3 uEdge;
uniform float uFade;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, uFade);
  float x = abs(vUv.x - 0.5) * 2.0;
  float sides = 1.0 - smoothstep(0.9, 1.0, x);
  float rim = smoothstep(0.8, 0.95, x) * sides;
  float a = (0.55 + rim * 0.25) * sides * fade * uStrength;
  gl_FragColor = vec4(mix(uColor, uEdge, rim), a);
}`

/**
 * A band of light lying on the table that is at its fullest at one end and fades away toward the other: the lane a card may be played along, the column of a table that is lit or put out. It says where, with a colour a game gives, and takes no click: a place that
 * can be pressed is a `Hotspot` over it, and the band takes the strength the game says. It swells and dims a little (`pulse`) so it reads as alive, still for a visitor who asks for less motion, and fades in and out as its strength changes.
 */
export function LightBand({ frame, width, length, y = BAND.height, color, edge, fade = BAND.fade, strength = BAND.strength, pulse = BAND.pulse, speed = BAND.speed, additive = true }: LightBandProps) {
  const reduced = usePrefersReducedMotion()
  const mesh = useRef<Mesh>(null)
  const material = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({ uStrength: { value: 0 }, uColor: { value: new Color() }, uEdge: { value: new Color() }, uFade: { value: BAND.fade as number } }))
  useFrame(({ clock }, dt) => {
    const m = material.current
    if (!m) return
    const u = m.uniforms
    tint(u.uColor!.value as Color, color)
    tint(u.uEdge!.value as Color, edge ?? color)
    u.uFade!.value = fade
    const target = bandTarget(strength, clock.elapsedTime, { pulse, speed }, reduced)
    if (reduced) u.uStrength!.value = target
    else easing.damp(u.uStrength as { value: number }, "value", target, BAND.settle, dt)
    if (mesh.current) mesh.current.visible = u.uStrength!.value > BAND.hidden
  })
  return (
    <group position={[frame.x, y, frame.z]} rotation-y={frame.yaw ?? 0}>
      {/* The plane's own y runs along the band: from the bright end at the frame's origin to its far end along -z */}
      <mesh ref={mesh} position-z={-length / 2} rotation-x={-Math.PI / 2} raycast={() => null} visible={false}>
        <planeGeometry args={[width, length]} />
        <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={additive ? AdditiveBlending : NormalBlending} />
      </mesh>
    </group>
  )
}
