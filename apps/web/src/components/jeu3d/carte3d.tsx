"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  AdditiveBlending,
  CanvasTexture,
  ExtrudeGeometry,
  NormalBlending,
  RepeatWrapping,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  type Texture,
  Vector3,
} from "three"
import type { Pose } from "./disposition"

const geometries = new Map<string, ShapeGeometry>()
const tranches = new Map<string, ExtrudeGeometry>()
export const EPAISSEUR_RELATIVE = 0.004

function forme(largeur: number, hauteur: number, rayon: number) {
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
  return s
}

export function geometrieTranche(largeur: number, hauteur: number, epaisseur: number, rayon = Math.min(largeur, hauteur) * 0.06) {
  const cle = `${largeur.toFixed(3)}:${hauteur.toFixed(3)}:${epaisseur.toFixed(4)}:${rayon.toFixed(3)}`
  let geo = tranches.get(cle)
  if (!geo) {
    geo = new ExtrudeGeometry(forme(largeur, hauteur, rayon), { depth: epaisseur, bevelEnabled: false, curveSegments: 6 })
    tranches.set(cle, geo)
  }
  return geo
}

const cadres = new Map<string, ShapeGeometry>()

function geometrieCadre(largeur: number, hauteur: number, ecart: number, epaisseur: number) {
  const cle = `${largeur.toFixed(3)}:${hauteur.toFixed(3)}:${ecart.toFixed(3)}:${epaisseur.toFixed(3)}`
  let geo = cadres.get(cle)
  if (!geo) {
    const rayon = Math.min(largeur, hauteur) * 0.06
    const exterieur = forme(largeur + 2 * (ecart + epaisseur), hauteur + 2 * (ecart + epaisseur), rayon + ecart + epaisseur)
    exterieur.holes.push(forme(largeur + 2 * ecart, hauteur + 2 * ecart, rayon + ecart))
    geo = new ShapeGeometry(exterieur, 8)
    cadres.set(cle, geo)
  }
  return geo
}

export function geometrieCarte(largeur: number, hauteur: number, rayon = Math.min(largeur, hauteur) * 0.06) {
  const cle = `${largeur.toFixed(3)}:${hauteur.toFixed(3)}:${rayon.toFixed(3)}`
  let geo = geometries.get(cle)
  if (!geo) {
    const x = -largeur / 2
    const y = -hauteur / 2
    geo = new ShapeGeometry(forme(largeur, hauteur, rayon), 6)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / largeur, (pos.getY(i) - y) / hauteur)
    uv.needsUpdate = true
    geometries.set(cle, geo)
  }
  return geo
}

function textureScintille() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.42, "rgba(255,255,255,0)")
  grad.addColorStop(0.5, "rgba(255,250,230,0.8)")
  grad.addColorStop(0.58, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 2 + Math.random() * 4
    g.fillStyle = "rgba(255,255,255,0.9)"
    g.fillRect(x - r, y - 0.6, r * 2, 1.2)
    g.fillRect(x - 0.6, y - r, 1.2, r * 2)
  }
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping
  return t
}

let refletTexture: CanvasTexture | null = null
function textureReflet() {
  if (refletTexture) return refletTexture
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 256, 256, 0)
  grad.addColorStop(0.25, "rgba(255,255,255,0)")
  grad.addColorStop(0.42, "rgba(255,245,220,0.3)")
  grad.addColorStop(0.5, "rgba(255,255,255,0.6)")
  grad.addColorStop(0.53, "rgba(255,255,255,0.2)")
  grad.addColorStop(0.6, "rgba(255,245,220,0.35)")
  grad.addColorStop(0.75, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new CanvasTexture(c)
  t.repeat.set(0.6, 0.6)
  t.center.set(0.5, 0.5)
  refletTexture = t
  return t
}

let ombreTexture: CanvasTexture | null = null
function textureOmbre() {
  if (!ombreTexture) {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64)
    grad.addColorStop(0, "rgba(0,0,0,0.55)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    ombreTexture = new CanvasTexture(c)
  }
  return ombreTexture
}

const halos = new Map<string, CanvasTexture>()

function textureHalo(largeur: number, hauteur: number, marge: number) {
  const cle = `${largeur.toFixed(2)}:${hauteur.toFixed(2)}:${marge.toFixed(2)}`
  let t = halos.get(cle)
  if (!t) {
    const echelle = 160 / (largeur + 2 * marge)
    const c = document.createElement("canvas")
    c.width = Math.round((largeur + 2 * marge) * echelle)
    c.height = Math.round((hauteur + 2 * marge) * echelle)
    const g = c.getContext("2d")!
    g.shadowColor = "white"
    g.shadowBlur = marge * echelle * 0.9
    g.fillStyle = "white"
    const r = Math.min(largeur, hauteur) * 0.06 * echelle
    g.beginPath()
    g.roundRect(marge * echelle, marge * echelle, largeur * echelle, hauteur * echelle, r)
    g.fill()
    g.fill()
    t = new CanvasTexture(c)
    halos.set(cle, t)
  }
  return t
}

const COULEURS_LUEUR = {
  or: "#f2c14e",
  selection: "#ffffff",
  rouge: "#ff4d4d",
  blanc: "#ffffff",
} as const
export type Lueur = keyof typeof COULEURS_LUEUR

export const REGLAGES_CARTE = {
  couleurAssassin: "#ff4d4d",
  haloAssassin: 0.75,
  pulsationAssassin: 0.06,
  contourAssassin: true,
  couleurOr: "#f2c14e",
  haloOr: 0.35,
  pulsationOr: 0.03,
  scintillement: 0.55,
  vitesseScintillement: 0.35,
  vitessePulsation: 1.6,
  couleurSelection: "#ffffff",
  opaciteCadre: 0.75,
  pulsationCadre: 0.2,
  respirationCadre: 0.012,
  vitesseCadre: 3,
  reflet: 0.5,
  mouvementReflet: 0.45,
  ombre: 1,
  dureeVol: 1.35,
  hauteurVol: 1,
}

type Props = {
  cible: Pose
  depart?: Pose | null
  recto: Texture
  verso: Texture
  largeur: number
  hauteur: number
  lueur?: Lueur | null
  vitesse?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onSurvol?: (survol: boolean) => void
  reflet?: boolean
  auDessus?: boolean
  sansOmbre?: boolean
  intensiteReflet?: number
  onArrivee?: () => void
}

const cibleTmp = new Vector3()
const echelleTmp = new Vector3()
const normaleTmp = new Vector3()
const p1 = new Vector3()
const p2 = new Vector3()
const qTmp = new Quaternion()
const HAUT = new Vector3(0, 1, 0)

type Vol = { t: number; duree: number; p0: Vector3; q0: Quaternion; s0: number; elan: number; sens: number }

const douceur = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

function bezier(out: Vector3, a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number) {
  const m = 1 - t
  return out
    .copy(a)
    .multiplyScalar(m * m * m)
    .addScaledVector(b, 3 * m * m * t)
    .addScaledVector(c, 3 * m * t * t)
    .addScaledVector(d, t * t * t)
}

export function Carte3D({
  cible,
  depart,
  recto,
  verso,
  largeur,
  hauteur,
  lueur,
  vitesse = 0.16,
  onClick,
  onSurvol,
  reflet,
  auDessus,
  sansOmbre,
  intensiteReflet,
  onArrivee,
}: Props) {
  const ref = useRef<Group>(null)
  const epaisseur = largeur * EPAISSEUR_RELATIVE
  const geo = useMemo(() => geometrieCarte(largeur, hauteur), [largeur, hauteur])
  const tranche = useMemo(() => geometrieTranche(largeur, hauteur, epaisseur), [largeur, hauteur, epaisseur])
  const marge = 0.05 / Math.max(cible.echelle, 0.3)
  const geoLueur = useMemo(() => geometrieCarte(largeur + marge, hauteur + marge), [largeur, hauteur, marge])
  const margeHalo = Math.min(largeur, hauteur) * (lueur === "or" ? 0.14 : 0.28)
  const cadreRef = useRef<Mesh>(null)
  const halo = useMemo(() => textureHalo(largeur, hauteur, margeHalo), [largeur, hauteur, margeHalo])
  const haloRef = useRef<MeshBasicMaterial>(null)
  const scintilleRef = useRef<Mesh>(null)
  const [texScintille] = useState(textureScintille)
  const epaisseurContour = 0.03 / Math.max(cible.echelle, 0.3)
  const ecart = 0.07 / Math.max(cible.echelle, 0.3)
  const geoCadre = useMemo(() => geometrieCadre(largeur, hauteur, ecart, epaisseurContour), [largeur, hauteur, ecart, epaisseurContour])
  const [survol, setSurvol] = useState(false)
  const [ombre] = useState(textureOmbre)
  const ombreRef = useRef<Mesh>(null)
  const refletRef = useRef<Mesh>(null)
  const contourRef = useRef<Mesh>(null)
  const [texReflet] = useState(textureReflet)
  const vol = useRef<Vol | null>(null)
  const derniere = useRef(new Vector3())
  useCursor(survol && !!onClick)

  const lancer = (g: Group, delai = 0) => {
    const distance = g.position.distanceTo(cible.position)
    vol.current = {
      t: -delai,
      duree: Math.min(1.6, Math.max(1.05, 0.95 + distance * 0.04)) * REGLAGES_CARTE.dureeVol,
      p0: g.position.clone(),
      q0: g.quaternion.clone(),
      s0: g.scale.x,
      elan: Math.min(5.5, 1.8 + distance * 0.3) * REGLAGES_CARTE.hauteurVol,
      sens: Math.random() < 0.5 ? -1 : 1,
    }
  }

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const p = depart ?? cible
    g.position.copy(p.position)
    g.quaternion.copy(p.quaternion)
    g.scale.setScalar(p.echelle)
    derniere.current.copy(cible.position)
    if (depart) lancer(g, depart.delai ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(({ pointer, clock }, dt) => {
    const R = REGLAGES_CARTE
    const onde = Math.sin(clock.elapsedTime * R.vitessePulsation)
    if (haloRef.current) {
      haloRef.current.opacity = lueur === "rouge" ? R.haloAssassin + onde * R.pulsationAssassin : R.haloOr + onde * R.pulsationOr
      if (lueur === "rouge") haloRef.current.color.set(R.couleurAssassin)
      else if (lueur === "or") haloRef.current.color.set(R.couleurOr)
    }
    if (contourRef.current) {
      contourRef.current.visible = R.contourAssassin
      ;(contourRef.current.material as MeshBasicMaterial).color.set(R.couleurAssassin)
    }
    if (ombreRef.current) (ombreRef.current.material as MeshBasicMaterial).opacity = R.ombre
    const cadre = cadreRef.current
    if (cadre) {
      const t = clock.elapsedTime
      cadre.scale.setScalar(1 + Math.sin(t * R.vitesseCadre) * R.respirationCadre)
      const m = cadre.material as MeshBasicMaterial
      m.opacity = R.opaciteCadre + Math.sin(t * R.vitesseCadre) * R.pulsationCadre
      m.color.set(R.couleurSelection)
    }
    const sc = scintilleRef.current
    if (sc) {
      sc.visible = lueur === "or"
      if (sc.visible) {
        const m = sc.material as MeshBasicMaterial
        if (m.map) m.map.offset.x = ((clock.elapsedTime * R.vitesseScintillement) % 1.6) - 0.8
        m.opacity = R.scintillement
      }
    }
    const r = refletRef.current
    if (r) {
      const m = r.material as MeshBasicMaterial
      easing.damp(m, "opacity", reflet ? (intensiteReflet ?? R.reflet) : 0, 0.3, dt)
      r.visible = m.opacity > 0.01
      if (reflet) {
        easing.damp(texReflet.offset, "x", -pointer.x * R.mouvementReflet, 0.15, dt)
        easing.damp(texReflet.offset, "y", -pointer.y * R.mouvementReflet, 0.15, dt)
      }
    }
    const g = ref.current
    if (!g) return
    if (!vol.current && cible.position.distanceTo(derniere.current) > 4 && g.position.distanceTo(cible.position) > 4) lancer(g)
    derniere.current.copy(cible.position)

    const v = vol.current
    if (v) {
      v.t += dt
      if (v.t >= 0) {
        const u = Math.min(1, v.t / v.duree)
        const e = douceur(u)
        p1.copy(v.p0).addScaledVector(HAUT, v.p0.y > 8 ? 0 : v.elan)
        p2.copy(cible.position).addScaledVector(HAUT, cible.position.y > 8 ? 0 : v.elan * 0.85)
        bezier(g.position, v.p0, p1, p2, cible.position, e)
        g.quaternion.slerpQuaternions(v.q0, cible.quaternion, e).premultiply(qTmp.setFromAxisAngle(HAUT, Math.sin(Math.PI * e) * 0.45 * v.sens))
        g.scale.setScalar((v.s0 + (cible.echelle - v.s0) * e) * (1 + Math.sin(Math.PI * u) * 0.14))
        if (u >= 1) {
          vol.current = null
          onArrivee?.()
        }
      }
    } else {
      cibleTmp.copy(cible.position)
      easing.damp3(g.position, cibleTmp, vitesse, dt)
      easing.dampQ(g.quaternion, cible.quaternion, vitesse, dt)
      easing.damp3(g.scale, echelleTmp.setScalar(cible.echelle), vitesse, dt)
    }
    if (ombreRef.current) {
      const dessus = normaleTmp.set(0, 0, 1).applyQuaternion(g.quaternion).y >= 0
      ombreRef.current.position.z = dessus ? -epaisseur / 2 - 0.012 : epaisseur / 2 + 0.012
    }
  })

  return (
    <group
      ref={ref}
      renderOrder={auDessus ? 20 : 0}
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
      <mesh ref={ombreRef} position={[0.04, -0.07, -0.03]} raycast={() => null} visible={!sansOmbre}>
        <planeGeometry args={[largeur * 1.18, hauteur * 1.1]} />
        <meshBasicMaterial map={ombre} transparent depthWrite={false} />
      </mesh>
      <mesh geometry={geo} position-z={epaisseur / 2 + 0.001}>
        <meshBasicMaterial map={recto} transparent={auDessus} toneMapped={false} />
      </mesh>
      <mesh geometry={tranche} position-z={-epaisseur / 2}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial attach="material-1" color="#d9cba6" transparent={auDessus} toneMapped={false} />
      </mesh>
      <mesh ref={refletRef} geometry={geo} position-z={epaisseur / 2 + 0.003} raycast={() => null} visible={false}>
        <meshBasicMaterial map={texReflet} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geo} rotation-y={Math.PI} position-z={-epaisseur / 2 - 0.001}>
        <meshBasicMaterial map={verso} transparent={auDessus} toneMapped={false} />
      </mesh>
      {lueur && lueur !== "selection" && (
        <mesh position-z={-epaisseur / 2 - 0.006} raycast={() => null}>
          <planeGeometry args={[largeur + 2 * margeHalo, hauteur + 2 * margeHalo]} />
          <meshBasicMaterial
            ref={haloRef}
            map={halo}
            color={COULEURS_LUEUR[lueur]}
            transparent
            depthWrite={false}
            blending={lueur === "rouge" ? NormalBlending : AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh ref={scintilleRef} geometry={geo} position-z={epaisseur / 2 + 0.004} raycast={() => null} visible={false}>
        <meshBasicMaterial map={texScintille} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {lueur === "selection" && (
        <mesh ref={cadreRef} geometry={geoCadre} position-z={epaisseur / 2 + 0.002} raycast={() => null}>
          <meshBasicMaterial color="#ffffff" transparent toneMapped={false} />
        </mesh>
      )}
      {lueur === "rouge" && (
        <mesh ref={contourRef} geometry={geoLueur} position-z={-epaisseur / 2 - 0.003} raycast={() => null}>
          <meshBasicMaterial color={COULEURS_LUEUR.rouge} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
