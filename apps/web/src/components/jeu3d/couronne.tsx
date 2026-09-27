"use client"

import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef } from "react"
import { type Group, Vector2 } from "three"

const OR = { color: "#f2c14e", metalness: 0.85, roughness: 0.28, emissive: "#6b4a10", emissiveIntensity: 0.35 }
const POINTES = 7

export function Couronne3D({ visible, taille = 0.72 }: { visible: boolean; taille?: number }) {
  const ref = useRef<Group>(null)
  const profil = useMemo(
    () => [new Vector2(0.92, 0), new Vector2(1, 0.04), new Vector2(1, 0.34), new Vector2(0.94, 0.4), new Vector2(0.9, 0.36), new Vector2(0.9, 0.05)],
    [],
  )
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    const s = visible ? taille : 0.0001
    easing.damp3(g.scale, [s, s, s], 0.25, dt)
    g.rotation.y = t * 0.9
    g.rotation.z = Math.sin(t * 1.3) * 0.12
    g.rotation.x = 0.35 + Math.cos(t * 1.1) * 0.08
    g.position.y = 0.7 + Math.sin(t * 2) * 0.12
    g.visible = g.scale.x > 0.001
  })
  return (
    <group ref={ref} scale={0.0001}>
      <pointLight position={[0, 1.6, 1.2]} intensity={6} distance={6} color="#fff1c9" />
      <mesh>
        <latheGeometry args={[profil, 48]} />
        <meshStandardMaterial {...OR} side={2} />
      </mesh>
      {Array.from({ length: POINTES }, (_, i) => {
        const a = (i / POINTES) * Math.PI * 2
        return (
          <group key={i} position={[Math.cos(a) * 0.95, 0.38, Math.sin(a) * 0.95]} rotation-y={-a}>
            <mesh position-y={0.28}>
              <coneGeometry args={[0.2, 0.56, 4]} />
              <meshStandardMaterial {...OR} />
            </mesh>
            <mesh position-y={0.62}>
              <sphereGeometry args={[0.08, 16, 12]} />
              <meshStandardMaterial color="#fff6dc" metalness={0.3} roughness={0.2} emissive="#fff0c0" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      })}
      {Array.from({ length: POINTES }, (_, i) => {
        const a = ((i + 0.5) / POINTES) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0]} rotation-y={-a + Math.PI / 2}>
            <octahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color={i % 2 ? "#5fd0c8" : "#d2415e"} metalness={0.2} roughness={0.1} emissive={i % 2 ? "#0d5a55" : "#5a0d1f"} />
          </mesh>
        )
      })}
    </group>
  )
}
