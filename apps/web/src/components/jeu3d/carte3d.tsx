"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { type Group, Shape, ShapeGeometry, type Texture, Vector3 } from "three"
import type { Pose } from "./disposition"

const geometries = new Map<string, ShapeGeometry>()

export function geometrieCarte(largeur: number, hauteur: number, rayon = Math.min(largeur, hauteur) * 0.06) {
  const cle = `${largeur.toFixed(3)}:${hauteur.toFixed(3)}:${rayon.toFixed(3)}`
  let geo = geometries.get(cle)
  if (!geo) {
    const x = -largeur / 2
    const y = -hauteur / 2
    const s = new Shape()
    s.moveTo(x + rayon, y)
    s.lineTo(x + largeur - rayon, y)
    s.quadraticCurveTo(x + largeur, y, x + largeur, y + rayon)
    s.lineTo(x + largeur, y + hauteur - rayon)
    s.quadraticCurveTo(x + largeur, y + hauteur, x + largeur - rayon, y + hauteur)
    s.lineTo(x + rayon, y + hauteur)
    s.quadraticCurveTo(x, y + hauteur, x, y + hauteur - rayon)
    s.lineTo(x, y + rayon)
    s.quadraticCurveTo(x, y, x + rayon, y)
    geo = new ShapeGeometry(s, 6)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / largeur, (pos.getY(i) - y) / hauteur)
    uv.needsUpdate = true
    geometries.set(cle, geo)
  }
  return geo
}

const COULEURS_LUEUR = { or: "#f2c14e", rouge: "#ff4d4d", blanc: "#ffffff" } as const
export type Lueur = keyof typeof COULEURS_LUEUR

type Props = {
  cible: Pose
  depart?: Pose | null
  recto: Texture
  verso: Texture
  largeur: number
  hauteur: number
  lueur?: Lueur | null
  arc?: number
  vitesse?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onSurvol?: (survol: boolean) => void
}

const cibleTmp = new Vector3()
const echelleTmp = new Vector3()

export function Carte3D({ cible, depart, recto, verso, largeur, hauteur, lueur, arc = 0.3, vitesse = 0.16, onClick, onSurvol }: Props) {
  const ref = useRef<Group>(null)
  const geo = useMemo(() => geometrieCarte(largeur, hauteur), [largeur, hauteur])
  const geoLueur = useMemo(() => geometrieCarte(largeur + 0.14, hauteur + 0.14), [largeur, hauteur])
  const [survol, setSurvol] = useState(false)
  useCursor(survol && !!onClick)

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const p = depart ?? cible
    g.position.copy(p.position)
    g.quaternion.copy(p.quaternion)
    g.scale.setScalar(p.echelle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const reste = g.position.distanceTo(cible.position)
    cibleTmp.copy(cible.position)
    cibleTmp.y += Math.min(reste * arc, 3)
    easing.damp3(g.position, cibleTmp, vitesse, dt)
    easing.dampQ(g.quaternion, cible.quaternion, vitesse, dt)
    easing.damp3(g.scale, echelleTmp.setScalar(cible.echelle), vitesse, dt)
  })

  return (
    <group
      ref={ref}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setSurvol(true)
        onSurvol?.(true)
      }}
      onPointerOut={() => {
        setSurvol(false)
        onSurvol?.(false)
      }}
    >
      <mesh geometry={geo}>
        <meshStandardMaterial map={recto} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh geometry={geo} rotation-y={Math.PI} position-z={-0.004}>
        <meshStandardMaterial map={verso} roughness={0.55} metalness={0.05} />
      </mesh>
      {lueur && (
        <mesh geometry={geoLueur} position-z={-0.002}>
          <meshBasicMaterial color={COULEURS_LUEUR[lueur]} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
