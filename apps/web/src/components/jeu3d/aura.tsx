"use client"

import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useRef, useState } from "react"
import { AdditiveBlending, type Mesh, type ShaderMaterial, Vector2 } from "three"

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragment = /* glsl */ `
uniform float uTemps;
uniform float uForce;
uniform vec2 uTaille;
varying vec2 vUv;

float boite(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * uTaille;
  float d = boite(p, uTaille * 0.5 - 0.85, 0.35);
  float bord = exp(-abs(d) * 7.0);
  float halo = exp(-max(d, 0.0) * 2.2) * smoothstep(0.35, -0.8, d) * 0.35 + exp(-max(d, 0.0) * 3.0) * 0.25;
  float onde = 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.6) * 2.4 - uTemps * 2.2);
  float angle = atan(p.y, p.x);
  float course = pow(0.5 + 0.5 * sin(angle * 3.0 - uTemps * 1.6), 10.0);
  float eclat = pow(0.5 + 0.5 * sin(p.x * 7.0 + uTemps * 3.1) * sin(p.y * 6.0 - uTemps * 2.3), 18.0) * smoothstep(0.2, -0.6, d);
  vec3 or = vec3(1.0, 0.76, 0.28);
  vec3 clair = vec3(1.0, 0.96, 0.78);
  vec3 couleur = mix(or, clair, clamp(bord * onde + course * bord + eclat, 0.0, 1.0));
  float a = (bord * (0.55 + 0.45 * onde + course * 0.8) + halo * (0.6 + 0.4 * onde) + eclat * 0.6) * uForce;
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
}: {
  largeur: number
  profondeur: number
  position: [number, number, number]
  lacet: number
  force: number
}) {
  const ref = useRef<Mesh>(null)
  const materiau = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({ uTemps: { value: 0 }, uForce: { value: 0 }, uTaille: { value: new Vector2(1, 1) } }))
  useFrame(({ clock }, dt) => {
    const m = materiau.current
    if (!m) return
    const u = m.uniforms
    u.uTemps.value = clock.elapsedTime
    ;(u.uTaille.value as Vector2).set(largeur + 1.6, profondeur + 1.6)
    easing.damp(u.uForce, "value", force, 0.18, dt)
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
        blending={AdditiveBlending}
      />
    </mesh>
  )
}
