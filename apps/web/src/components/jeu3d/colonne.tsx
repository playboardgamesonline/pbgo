"use client"

import { useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { jouerSon } from "@/lib/son"
import { AdditiveBlending, Color, NormalBlending, type ShaderMaterial } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragment = /* glsl */ `
uniform float uForce;
uniform float uTemps;
uniform vec3 uCouleur;
uniform vec3 uBord;
varying vec2 vUv;
void main() {
  float fondu = pow(1.0 - vUv.y, 1.6);
  float x = abs(vUv.x - 0.5) * 2.0;
  float cotes = 1.0 - smoothstep(0.9, 1.0, x);
  float bord = smoothstep(0.8, 0.95, x) * cotes;
  float a = (0.55 + bord * 0.25) * cotes * fondu * uForce;
  vec3 c = mix(uCouleur, uBord, bord);
  gl_FragColor = vec4(c, a);
}`

export function Colonne({
  x,
  z,
  largeur,
  longueur,
  sens,
  couleur,
  bord,
  additif,
  onClick,
}: {
  x: number
  z: number
  largeur: number
  longueur: number
  sens: 1 | -1
  couleur: string
  bord: string
  additif: boolean
  onClick: () => void
}) {
  const materiau = useRef<ShaderMaterial>(null)
  const [survol, setSurvol] = useState(false)
  useCursor(survol)
  const [uniforms] = useState(() => ({ uForce: { value: 0 }, uTemps: { value: 0 }, uCouleur: { value: new Color() }, uBord: { value: new Color() } }))
  useFrame(({ clock }, dt) => {
    const m = materiau.current
    if (!m) return
    m.uniforms.uTemps.value = clock.elapsedTime
    ;(m.uniforms.uCouleur.value as Color).set(couleur)
    ;(m.uniforms.uBord.value as Color).set(bord)
    easing.damp(m.uniforms.uForce, "value", survol ? 1.2 : 0.85, 0.15, dt)
  })
  return (
    <mesh
      position={[x, 0.07, z + (sens * longueur) / 2]}
      rotation={[-Math.PI / 2, 0, sens === 1 ? Math.PI : 0]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setSurvol(true)
        jouerSon("survol", { volume: 0.7 })
      }}
      onPointerOut={() => setSurvol(false)}
    >
      <planeGeometry args={[largeur, longueur]} />
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
