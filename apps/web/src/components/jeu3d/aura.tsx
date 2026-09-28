"use client"

import { boutonCopie, onglet } from "./onglets-debug"
import { useFrame } from "@react-three/fiber"
import { useControls } from "leva"
import { easing } from "maath"
import { useRef, useState } from "react"
import { AdditiveBlending, Color, type Mesh, NormalBlending, type ShaderMaterial, Vector2 } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

export const REGLAGES_AURA = { intensite: 1, bord: 1, halo: 1, etoiles: 0.5, densite: 2.2, taille: 1, vitesse: 0.4 }

const fragment = /* glsl */ `
uniform float uTemps;
uniform float uForce;
uniform vec2 uTaille;
uniform vec3 uCouleur;
uniform vec3 uClair;
uniform float uBord;
uniform float uHalo;
uniform float uEtoiles;
uniform float uDensite;
uniform float uTailleEtoile;
uniform float uVitesse;
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
  float t = uTemps * uVitesse;
  vec2 p = (vUv - 0.5) * uTaille;
  float d = boite(p, uTaille * 0.5 - 0.85, 0.35);
  float bord = exp(-abs(d) * 7.0) * uBord;
  float halo = (exp(-max(d, 0.0) * 2.2) * smoothstep(0.35, -0.8, d) * 0.35 + exp(-max(d, 0.0) * 3.0) * 0.25) * uHalo;
  float onde = 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.6) * 2.4 - t * 2.2);
  float angle = atan(p.y, p.x);
  float course = pow(0.5 + 0.5 * sin(angle * 3.0 - t * 1.6), 10.0);

  vec2 g = p * uDensite;
  vec2 cellule = floor(g);
  float h = hash(cellule);
  vec2 decalage = vec2(hash(cellule + 7.1), hash(cellule + 3.3)) - 0.5;
  vec2 q = (fract(g) - 0.5 - decalage * 0.5) / max(uTailleEtoile, 0.05);
  float scintille = pow(0.5 + 0.5 * sin(t * (1.5 + h * 2.5) + h * 40.0), 8.0);
  float presence = step(0.45, h) * smoothstep(0.9, -0.2, abs(d + 0.1));
  float eclat = etoile(q * 2.4) * scintille * presence * uEtoiles;

  vec3 couleur = mix(uCouleur, uClair, clamp(bord * (0.6 + 0.15 * onde) + course * bord * 0.25 + eclat, 0.0, 1.0));
  float a = (bord * (0.72 + 0.1 * onde + course * 0.12) + halo * (0.65 + 0.08 * onde) + eclat * 0.7) * uForce;
  vec2 bordUv = min(vUv, 1.0 - vUv);
  a *= smoothstep(0.0, 0.18, bordUv.x) * smoothstep(0.0, 0.18, bordUv.y);
  gl_FragColor = vec4(couleur, a);
}`

export function Aura({
  largeur,
  profondeur,
  position,
  lacet,
  force,
  couleur = "#ffc247",
  clair = "#fff5c7",
  additif = true,
}: {
  largeur: number
  profondeur: number
  position: [number, number, number]
  lacet: number
  force: number | (() => number)
  couleur?: string
  clair?: string
  additif?: boolean
}) {
  const ref = useRef<Mesh>(null)
  const materiau = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({
    uTemps: { value: 0 },
    uForce: { value: 0 },
    uTaille: { value: new Vector2(1, 1) },
    uCouleur: { value: new Color() },
    uClair: { value: new Color() },
    uBord: { value: 1 },
    uHalo: { value: 1 },
    uEtoiles: { value: 1 },
    uDensite: { value: 2.2 },
    uTailleEtoile: { value: 1 },
    uVitesse: { value: 1 },
  }))
  useFrame(({ clock }, dt) => {
    const m = materiau.current
    if (!m) return
    const u = m.uniforms
    u.uTemps.value = clock.elapsedTime
    ;(u.uTaille.value as Vector2).set(largeur + 1.6, profondeur + 1.6)
    ;(u.uCouleur.value as Color).set(couleur)
    ;(u.uClair.value as Color).set(clair)
    const r = REGLAGES_AURA
    u.uBord.value = r.bord
    u.uHalo.value = r.halo
    u.uEtoiles.value = r.etoiles
    u.uDensite.value = r.densite
    u.uTailleEtoile.value = r.taille
    u.uVitesse.value = r.vitesse
    easing.damp(u.uForce, "value", (typeof force === "function" ? force() : force) * r.intensite, 0.18, dt)
    if (ref.current) ref.current.visible = u.uForce.value > 0.01
  })
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, lacet]} raycast={() => null} visible={false}>
      <planeGeometry args={[largeur + 1.6, profondeur + 1.6]} />
      <shaderMaterial
        ref={materiau}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={additif ? AdditiveBlending : NormalBlending}
      />
    </mesh>
  )
}

export function ReglagesAura() {
  useControls(
    "Auras",
    {
      intensite: {
        label: "intensity",
        value: REGLAGES_AURA.intensite,
        min: 0,
        max: 2,
        step: 0.05,
        onChange: (v: number) => (REGLAGES_AURA.intensite = v),
      },
      bord: { label: "edge", value: REGLAGES_AURA.bord, min: 0, max: 2, step: 0.05, onChange: (v: number) => (REGLAGES_AURA.bord = v) },
      halo: { label: "halo", value: REGLAGES_AURA.halo, min: 0, max: 2, step: 0.05, onChange: (v: number) => (REGLAGES_AURA.halo = v) },
      etoiles: { label: "stars", value: REGLAGES_AURA.etoiles, min: 0, max: 3, step: 0.05, onChange: (v: number) => (REGLAGES_AURA.etoiles = v) },
      densite: {
        label: "star density",
        value: REGLAGES_AURA.densite,
        min: 0.5,
        max: 6,
        step: 0.1,
        onChange: (v: number) => (REGLAGES_AURA.densite = v),
      },
      taille: {
        value: REGLAGES_AURA.taille,
        min: 0.3,
        max: 3,
        step: 0.05,
        label: "star size",
        onChange: (v: number) => (REGLAGES_AURA.taille = v),
      },
      vitesse: { label: "speed", value: REGLAGES_AURA.vitesse, min: 0, max: 3, step: 0.05, onChange: (v: number) => (REGLAGES_AURA.vitesse = v) },
      ...boutonCopie("SCENE", "Auras"),
    },
    { collapsed: true, order: 10 },
    onglet("SCENE"),
  )
  return null
}
