"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { AdditiveBlending, Color, type Mesh, NormalBlending, type ShaderMaterial, Vector2 } from "three"
import type { Spot } from "../layout"
import { AURA, AURA_LOOK, AURA_SHAPE, type AuraLook, auraPlane, tint } from "./zone-light"

export type AuraProps = {
  /** The rectangle the aura goes round, in world units: a zone's width along x and its depth along z. The glow reaches `AURA_SHAPE.reach` past it on every side */
  size: { width: number; depth: number }
  /** Where the zone lies and which way it faces (default: the middle of the table, unturned) */
  frame?: Spot
  /** How high above the table it lies (`AURA.height`): over the zone's own surface and under what stands on it */
  y?: number
  /** How strong it is, 0 and up: 0 draws nothing, 1 is the usual glow. It settles on a new value in a fraction of a second, so a game says what it should be and the aura follows */
  strength: number
  /** The colour of the glow (default a warm gold) */
  color?: string
  /** The brighter colour its rim and its stars turn to (default a pale gold) */
  bright?: string
  /** It adds its light to the table (default), which a light glow needs; false lays it over the table, which a dark one needs */
  additive?: boolean
  /** The look: what is not given is `AURA_LOOK`. It is read on every frame, so a debug panel's knobs (`AURA_FIELDS`) move it live */
  look?: Partial<AuraLook>
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// A glow round a rounded rectangle: a rim that is brightest where a slow wave and a chase of light pass over it, a soft halo that goes out from it, and stars that twinkle along it. All of it is the distance `d` to the rounded rectangle, which is
// negative inside it; the rim and the halo are functions of `d`, the stars lie on a jittered grid and show only near the rim, and the whole plane fades out at its own edge so that it has none.
const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform vec2 uSize;
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uInset;
uniform float uRadius;
uniform float uEdge;
uniform float uHalo;
uniform float uStars;
uniform float uDensity;
uniform float uStarSize;
uniform float uSpeed;
varying vec2 vUv;

float box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 c) {
  return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
}

float star(vec2 q) {
  float thin = 0.035;
  float arms = max(0.0, 1.0 - abs(q.x) / thin - abs(q.y) * 1.6) + max(0.0, 1.0 - abs(q.y) / thin - abs(q.x) * 1.6);
  vec2 r = vec2(q.x + q.y, q.x - q.y) * 0.7071;
  float diagonal = (max(0.0, 1.0 - abs(r.x) / thin - abs(r.y) * 3.2) + max(0.0, 1.0 - abs(r.y) / thin - abs(r.x) * 3.2)) * 0.45;
  float core = exp(-dot(q, q) * 900.0);
  return arms + diagonal + core;
}

void main() {
  float t = uTime * uSpeed;
  vec2 p = (vUv - 0.5) * uSize;
  float d = box(p, uSize * 0.5 - uInset, uRadius);
  float rim = exp(-abs(d) * 7.0) * uEdge;
  float halo = (exp(-max(d, 0.0) * 2.2) * (1.0 - smoothstep(-0.8, 0.35, d)) * 0.35 + exp(-max(d, 0.0) * 3.0) * 0.25) * uHalo;
  float wave = 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.6) * 2.4 - t * 2.2);
  float angle = atan(p.y, p.x);
  float chase = pow(0.5 + 0.5 * sin(angle * 3.0 - t * 1.6), 10.0);

  vec2 g = p * uDensity;
  vec2 cell = floor(g);
  float h = hash(cell);
  vec2 jitter = vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5;
  vec2 q = (fract(g) - 0.5 - jitter * 0.5) / max(uStarSize, 0.05);
  float twinkle = pow(0.5 + 0.5 * sin(t * (1.5 + h * 2.5) + h * 40.0), 8.0);
  float presence = step(0.45, h) * (1.0 - smoothstep(-0.2, 0.9, abs(d + 0.1)));
  float sparkle = star(q * 2.4) * twinkle * presence * uStars;

  vec3 tone = mix(uColor, uLight, clamp(rim * (0.6 + 0.15 * wave) + chase * rim * 0.25 + sparkle, 0.0, 1.0));
  float a = (rim * (0.72 + 0.1 * wave + chase * 0.12) + halo * (0.65 + 0.08 * wave) + sparkle * 0.7) * uStrength;
  vec2 edgeUv = min(vUv, 1.0 - vUv);
  a *= smoothstep(0.0, 0.18, edgeUv.x) * smoothstep(0.0, 0.18, edgeUv.y);
  gl_FragColor = vec4(tone, a);
}`

/**
 * A glow round a zone of the table: a rim of light with a slow wave and a chase of light going round it, a soft halo going out from it and stars that twinkle along it, in the colour a game gives. It says that a place is where something can be done, or that
 * it won: it lies flat on the table, draws no clicks, and fades in and out as its `strength` changes. It is drawn on a plane `AURA_SHAPE.reach` bigger than the zone on every side, which is as far as the glow goes, and never past it.
 *
 * Everything moves with the clock; a visitor who asks for less motion gets the glow still, at its strength at once. The look is a game's to tune (`look`, `AURA_FIELDS`), and the colour is the game's own: the table has none.
 */
export function Aura({ size, frame, y = AURA.height, strength, color = "#ffc247", bright = "#fff5c7", additive = true, look }: AuraProps) {
  const reduced = usePrefersReducedMotion()
  const plane = auraPlane(size)
  const mesh = useRef<Mesh>(null)
  const material = useRef<ShaderMaterial>(null)
  // What the shader reads, moved every frame through the material
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uSize: { value: new Vector2(1, 1) },
    uColor: { value: new Color() },
    uLight: { value: new Color() },
    uInset: { value: AURA_SHAPE.reach + AURA_SHAPE.inset },
    uRadius: { value: AURA_SHAPE.radius },
    uEdge: { value: AURA_LOOK.edge },
    uHalo: { value: AURA_LOOK.halo },
    uStars: { value: AURA_LOOK.stars },
    uDensity: { value: AURA_LOOK.density },
    uStarSize: { value: AURA_LOOK.size },
    uSpeed: { value: AURA_LOOK.speed },
  }))
  useFrame(({ clock }, dt) => {
    const m = material.current
    if (!m) return
    const u = m.uniforms
    const l = { ...AURA_LOOK, ...look }
    u.uTime!.value = clock.elapsedTime
    ;(u.uSize!.value as Vector2).set(plane.width, plane.depth)
    tint(u.uColor!.value as Color, color)
    tint(u.uLight!.value as Color, bright)
    u.uEdge!.value = l.edge
    u.uHalo!.value = l.halo
    u.uStars!.value = l.stars
    u.uDensity!.value = l.density
    u.uStarSize!.value = l.size
    u.uSpeed!.value = reduced ? 0 : l.speed
    const target = strength * l.intensity
    if (reduced) u.uStrength!.value = target
    else easing.damp(u.uStrength as { value: number }, "value", target, AURA.settle, dt)
    if (mesh.current) mesh.current.visible = u.uStrength!.value > AURA.hidden
  })
  return (
    <mesh ref={mesh} position={[frame?.x ?? 0, y, frame?.z ?? 0]} rotation={[-Math.PI / 2, 0, frame?.yaw ?? 0]} raycast={() => null} visible={false}>
      <planeGeometry args={[plane.width, plane.depth]} />
      <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} transparent depthWrite={false} blending={additive ? AdditiveBlending : NormalBlending} />
    </mesh>
  )
}
