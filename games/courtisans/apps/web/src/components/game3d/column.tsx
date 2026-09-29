"use client"

import { useCursor } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { playSound } from "@pgo/core/lib/sound"
import { AdditiveBlending, Color, NormalBlending, type ShaderMaterial } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragment = /* glsl */ `
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uEdge;
uniform float uFade;
varying vec2 vUv;
void main() {
  float fondu = pow(1.0 - vUv.y, uFade);
  float x = abs(vUv.x - 0.5) * 2.0;
  float cotes = 1.0 - smoothstep(0.9, 1.0, x);
  float bord = smoothstep(0.8, 0.95, x) * cotes;
  float a = (0.55 + bord * 0.25) * cotes * fondu * uStrength;
  vec3 c = mix(uColor, uEdge, bord);
  gl_FragColor = vec4(c, a);
}`

export function Column({
  x,
  z,
  width,
  logLength,
  dir,
  color,
  edge,
  additive,
  onClick,
  strength,
  fade = 1.6,
  elevation = 0.07,
}: {
  x: number
  z: number
  width: number
  logLength: number
  dir: 1 | -1
  color: string
  edge: string
  additive: boolean
  onClick?: () => void
  strength?: (time: number) => number
  fade?: number
  elevation?: number
}) {
  const material = useRef<ShaderMaterial>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const [uniforms] = useState(() => ({ uStrength: { value: 0 }, uTime: { value: 0 }, uColor: { value: new Color() }, uEdge: { value: new Color() }, uFade: { value: 1.6 } }))
  useFrame(({ clock }, dt) => {
    const m = material.current
    if (!m) return
    m.uniforms.uTime.value = clock.elapsedTime
    ;(m.uniforms.uColor.value as Color).set(color)
    ;(m.uniforms.uEdge.value as Color).set(edge)
    m.uniforms.uFade.value = fade
    easing.damp(m.uniforms.uStrength, "value", (strength ? strength(clock.elapsedTime) : 0.85) * (hover ? 1.4 : 1), 0.15, dt)
  })
  return (
    <mesh
      position={[x, elevation, z + (dir * logLength) / 2]}
      rotation={[-Math.PI / 2, 0, dir === 1 ? Math.PI : 0]}
      raycast={onClick ? undefined : () => null}
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation()
          onClick()
        })
      }
      onPointerOver={
        onClick &&
        ((e) => {
          e.stopPropagation()
          setHover(true)
          playSound("hover", { volume: 0.7 })
        })
      }
      onPointerOut={onClick && (() => setHover(false))}
    >
      <planeGeometry args={[width, logLength]} />
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
