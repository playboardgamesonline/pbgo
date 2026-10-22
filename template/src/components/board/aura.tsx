"use client"

import { useFrame } from "@react-three/fiber"
import type { Field } from "./settings"
import { easing } from "maath"
import { useRef, useState } from "react"
import { AdditiveBlending, Color, type Mesh, NormalBlending, type ShaderMaterial, Vector2 } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const AURA_DEFAULTS = { intensity: 1, edge: 1, halo: 1, stars: 0.5, density: 2.2, size: 1, speed: 0.4 }
export type AuraSettings = typeof AURA_DEFAULTS
export const ZONE_AURA_SETTINGS: AuraSettings = { ...AURA_DEFAULTS }
export const WINNER_AURA_SETTINGS: AuraSettings = { ...AURA_DEFAULTS }

export const AURA_FIELDS = {
  edge: ["aura edge", 0, 2, 0.05],
  halo: ["aura halo", 0, 2, 0.05],
  stars: ["aura stars", 0, 3, 0.05],
  density: ["aura star density", 0.5, 6, 0.1],
  size: ["aura star size", 0.3, 3, 0.05],
  speed: ["aura speed", 0, 3, 0.05],
} satisfies Partial<Record<keyof AuraSettings, Field>>

const fragment = /* glsl */ `
uniform float uTime;
uniform float uForce;
uniform vec2 uSize;
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uEdge;
uniform float uHalo;
uniform float uStars;
uniform float uDensity;
uniform float uStarSize;
uniform float uSpeed;
varying vec2 vUv;

float boite(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 c) {
  return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
}

float etoile(vec2 q) {
  float fin = 0.035;
  float bras = max(0.0, 1.0 - abs(q.x) / fin - abs(q.y) * 1.6) + max(0.0, 1.0 - abs(q.y) / fin - abs(q.x) * 1.6);
  vec2 r = vec2(q.x + q.y, q.x - q.y) * 0.7071;
  float diag = (max(0.0, 1.0 - abs(r.x) / fin - abs(r.y) * 3.2) + max(0.0, 1.0 - abs(r.y) / fin - abs(r.x) * 3.2)) * 0.45;
  float coeur = exp(-dot(q, q) * 900.0);
  return bras + diag + coeur;
}

void main() {
  float t = uTime * uSpeed;
  vec2 p = (vUv - 0.5) * uSize;
  float d = boite(p, uSize * 0.5 - 0.85, 0.35);
  float bord = exp(-abs(d) * 7.0) * uEdge;
  float halo = (exp(-max(d, 0.0) * 2.2) * smoothstep(0.35, -0.8, d) * 0.35 + exp(-max(d, 0.0) * 3.0) * 0.25) * uHalo;
  float onde = 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.6) * 2.4 - t * 2.2);
  float angle = atan(p.y, p.x);
  float course = pow(0.5 + 0.5 * sin(angle * 3.0 - t * 1.6), 10.0);

  vec2 g = p * uDensity;
  vec2 cellule = floor(g);
  float h = hash(cellule);
  vec2 decalage = vec2(hash(cellule + 7.1), hash(cellule + 3.3)) - 0.5;
  vec2 q = (fract(g) - 0.5 - decalage * 0.5) / max(uStarSize, 0.05);
  float scintille = pow(0.5 + 0.5 * sin(t * (1.5 + h * 2.5) + h * 40.0), 8.0);
  float presence = step(0.45, h) * smoothstep(0.9, -0.2, abs(d + 0.1));
  float eclat = etoile(q * 2.4) * scintille * presence * uStars;

  vec3 couleur = mix(uColor, uLight, clamp(bord * (0.6 + 0.15 * onde) + course * bord * 0.25 + eclat, 0.0, 1.0));
  float a = (bord * (0.72 + 0.1 * onde + course * 0.12) + halo * (0.65 + 0.08 * onde) + eclat * 0.7) * uForce;
  vec2 bordUv = min(vUv, 1.0 - vUv);
  a *= smoothstep(0.0, 0.18, bordUv.x) * smoothstep(0.0, 0.18, bordUv.y);
  gl_FragColor = vec4(couleur, a);
}`

export function Aura({
  width,
  depth,
  position,
  yaw,
  force,
  color = "#ffc247",
  light = "#fff5c7",
  additive = true,
  settings = ZONE_AURA_SETTINGS,
}: {
  width: number
  depth: number
  position: [number, number, number]
  yaw: number
  force: number | (() => number)
  color?: string
  light?: string
  additive?: boolean
  settings?: AuraSettings
}) {
  const ref = useRef<Mesh>(null)
  const material = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uForce: { value: 0 },
    uSize: { value: new Vector2(1, 1) },
    uColor: { value: new Color() },
    uLight: { value: new Color() },
    uEdge: { value: 1 },
    uHalo: { value: 1 },
    uStars: { value: 1 },
    uDensity: { value: 2.2 },
    uStarSize: { value: 1 },
    uSpeed: { value: 1 },
  }))
  useFrame(({ clock }, dt) => {
    const m = material.current
    if (!m) return
    const u = m.uniforms
    u.uTime.value = clock.elapsedTime
    ;(u.uSize.value as Vector2).set(width + 1.6, depth + 1.6)
    ;(u.uColor.value as Color).set(color)
    ;(u.uLight.value as Color).set(light)
    const r = settings
    u.uEdge.value = r.edge
    u.uHalo.value = r.halo
    u.uStars.value = r.stars
    u.uDensity.value = r.density
    u.uStarSize.value = r.size
    u.uSpeed.value = r.speed
    easing.damp(u.uForce, "value", (typeof force === "function" ? force() : force) * r.intensity, 0.18, dt)
    if (ref.current) ref.current.visible = u.uForce.value > 0.01
  })
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, yaw]} raycast={() => null} visible={false}>
      <planeGeometry args={[width + 1.6, depth + 1.6]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={additive ? AdditiveBlending : NormalBlending}
      />
    </mesh>
  )
}
