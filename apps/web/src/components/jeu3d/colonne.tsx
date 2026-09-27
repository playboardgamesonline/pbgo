"use client"

import { useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
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
  float fondu = pow(1.0 - vUv.y, 1.4);
  float x = abs(vUv.x - 0.5) * 2.0;
  float bord = smoothstep(0.86, 0.97, x) * (1.0 - smoothstep(0.97, 1.0, x));
  float coeur = 1.0 - smoothstep(0.0, 1.0, x);
  float onde = 0.85 + 0.15 * sin(vUv.y * 9.0 - uTemps * 2.4);
  float a = (coeur * 0.45 + bord * 0.9) * fondu * onde * uForce;
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
    easing.damp(m.uniforms.uForce, "value", survol ? 1.35 : 0.85, 0.15, dt)
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
