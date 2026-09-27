"use client"

import type { Famille, Resultats, VueJoueur } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef, useState } from "react"
import { CanvasTexture, type Group, type Mesh, SRGBColorSpace, type ShaderMaterial, Vector2 } from "three"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { Aura } from "./aura"
import { colonneX, PAS, TAPIS_P, type ZoneDomaine } from "./disposition"
import type { EtatFin } from "./fin"
import { TexteTable } from "./texte-table"

const FAMILLES_TABLE = ORDRE_TAPIS.filter((c): c is Famille => c !== "reine")
const HOLO = { couleur: "#fff4dc", relief: "#8a6a3a", aura: "rgba(255,236,190,0.9)", graisse: 800 }

function Apparition({ children, position, flotte = 0.06 }: { children: React.ReactNode; position: [number, number, number]; flotte?: number }) {
  const ref = useRef<Group>(null)
  const [phase] = useState(() => Math.random() * Math.PI * 2)
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    easing.damp3(g.scale, [1, 1, 1], 0.18, dt)
    g.position.y = position[1] + Math.sin(clock.elapsedTime * 1.8 + phase) * flotte
  })
  return (
    <group ref={ref} position={position} scale={0.001}>
      {children}
    </group>
  )
}

let rond: CanvasTexture | null = null
function fondRond() {
  if (!rond) {
    const c = document.createElement("canvas")
    c.width = c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.55, "rgba(255,255,255,0.8)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    rond = new CanvasTexture(c)
  }
  return rond
}

type Signe = "plus" | "moins" | "egal"
const signes = new Map<Signe, CanvasTexture>()

function textureSigne(signe: Signe) {
  let t = signes.get(signe)
  if (!t) {
    const c = document.createElement("canvas")
    c.width = c.height = 256
    const g = c.getContext("2d")!
    const barres: [number, number, number, number][] =
      signe === "plus"
        ? [
            [48, 104, 160, 48],
            [104, 48, 48, 160],
          ]
        : signe === "moins"
          ? [[48, 104, 160, 48]]
          : [
              [48, 72, 160, 44],
              [48, 140, 160, 44],
            ]
    const tracer = () => {
      g.beginPath()
      for (const [x, y, l, h] of barres) g.roundRect(x, y, l, h, 9)
    }
    g.lineJoin = "round"
    g.shadowColor = "rgba(0,0,0,0.45)"
    g.shadowBlur = 16
    g.shadowOffsetY = 6
    tracer()
    g.lineWidth = 22
    g.strokeStyle = "#fbf6ea"
    g.stroke()
    g.shadowColor = "transparent"
    tracer()
    g.fillStyle = "#fbf6ea"
    g.fill()
    tracer()
    g.fillStyle = "#2f2f33"
    g.fill()
    t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    signes.set(signe, t)
  }
  return t
}

function Signe({ signe, position }: { signe: Signe; position: [number, number, number] }) {
  const [texture] = useState(() => textureSigne(signe))
  return (
    <Apparition position={position} flotte={0}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[1.15, 1.15]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Apparition>
  )
}

export function ResolutionFamilles({ resultats, fin }: { resultats: Resultats; fin: EtatFin }) {
  return (
    <>
      {FAMILLES_TABLE.slice(0, fin.familles).map((f) => {
        const s = resultats.statuts[f]
        const x = colonneX(f)
        const lumiere = s.statut === "lumiere"
        const disgrace = s.statut === "disgrace"
        return (
          <group key={f}>
            {(lumiere || disgrace) && (
              <Aura
                largeur={PAS * 0.85}
                profondeur={TAPIS_P * 0.75}
                position={[x, 0.07, 0]}
                lacet={0}
                force={lumiere ? 0.45 : 0.9}
                couleur={lumiere ? "#ffc247" : "#021414"}
                clair={lumiere ? "#fff5c7" : "#1d6b62"}
                additif={lumiere}
              />
            )}
            <Signe
              signe={lumiere ? "plus" : disgrace ? "moins" : "egal"}
              position={[x, 0.1, lumiere ? -TAPIS_P / 2 + 0.15 : disgrace ? TAPIS_P / 2 - 0.15 : 0]}
            />
          </group>
        )
      })}
    </>
  )
}

export function Compteurs({
  vue,
  resultats,
  fin,
  zones,
  gagnants,
}: {
  vue: VueJoueur
  resultats: Resultats
  fin: EtatFin
  zones: Map<string, ZoneDomaine>
  gagnants: string[]
}) {
  if (fin.pile === 0 && !fin.missions) return null
  return (
    <>
      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        const r = resultats.joueurs.find((x) => x.joueurId === j.id)
        if (!zone || !r) return null
        if (fin.noir && !gagnants.includes(j.id)) return null
        const piles = r.detail.slice(0, fin.pile)
        const total = piles.reduce((s, d) => s + d.points, 0) + (fin.missions ? r.missions.reduce((s, m) => s + m.points, 0) : 0)
        return (
          <Apparition key={j.id} position={[zone.centre.x, 1.8, zone.centre.z]} flotte={0}>
            <mesh rotation-x={-Math.PI / 2} position-y={-0.02} raycast={() => null}>
              <circleGeometry args={[1.25, 48]} />
              <meshBasicMaterial map={fondRond()} color="#02151a" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
            </mesh>
            <TexteTable texte={`${total}`} style={{ ...HOLO, espacement: "4px" }} hauteur={1.5} position={[0, 0, 0]} />
          </Apparition>
        )
      })}
    </>
  )
}

const vertex = /* glsl */ `
varying vec3 vMonde;
void main() {
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMonde = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`

const fragment = /* glsl */ `
uniform float uNoir;
uniform float uTrou;
uniform vec2 uCentre1;
uniform vec2 uCentre2;
uniform vec2 uAxes;
uniform float uDeux;
varying vec3 vMonde;
float trou(vec2 c) {
  vec2 d = (vMonde.xz - c) / uAxes;
  return 1.0 - smoothstep(0.75, 1.25, length(d));
}
void main() {
  float lumiere = max(trou(uCentre1), uDeux * trou(uCentre2)) * uTrou;
  gl_FragColor = vec4(0.004, 0.02, 0.025, uNoir * (1.0 - lumiere));
}`

export function Projecteur({ fin, centres, axes }: { fin: EtatFin; centres: Vector2[]; axes: Vector2 }) {
  const materiau = useRef<ShaderMaterial>(null)
  const maille = useRef<Mesh>(null)
  const [uniforms] = useState(() => ({
    uNoir: { value: 0 },
    uTrou: { value: 0 },
    uCentre1: { value: new Vector2() },
    uCentre2: { value: new Vector2() },
    uAxes: { value: new Vector2(4, 3) },
    uDeux: { value: 0 },
  }))
  useFrame((_, dt) => {
    const m = materiau.current
    if (!m) return
    const u = m.uniforms
    easing.damp(u.uNoir, "value", fin.noir ? (fin.tableau ? 0.5 : 0.82) : 0, 0.5, dt)
    easing.damp(u.uTrou, "value", fin.projecteur ? 1 : 0, 0.6, dt)
    ;(u.uCentre1.value as Vector2).copy(centres[0] ?? new Vector2())
    ;(u.uCentre2.value as Vector2).copy(centres[1] ?? new Vector2(999, 999))
    u.uDeux.value = centres.length > 1 ? 1 : 0
    ;(u.uAxes.value as Vector2).copy(axes)
    if (maille.current) maille.current.visible = u.uNoir.value > 0.005
  })
  return (
    <mesh ref={maille} rotation-x={-Math.PI / 2} position-y={0.9} raycast={() => null} visible={false} renderOrder={5}>
      <planeGeometry args={[90, 70]} />
      <shaderMaterial ref={materiau} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  )
}

export function useCentresGagnants(gagnants: string[], zones: Map<string, ZoneDomaine>) {
  return useMemo(() => {
    const centres = gagnants.map((id) => zones.get(id)).filter((z): z is ZoneDomaine => !!z)
    const axes = new Vector2(
      Math.max(...centres.map((z) => (Math.abs(Math.sin(z.lacet)) > 0.5 ? z.profondeur : z.largeur) / 2 + 1), 3),
      Math.max(...centres.map((z) => (Math.abs(Math.sin(z.lacet)) > 0.5 ? z.largeur : z.profondeur) / 2 + 1), 2.5),
    )
    return { centres: centres.map((z) => new Vector2(z.centre.x, z.centre.z)), zonesGagnantes: centres, axes }
  }, [gagnants, zones])
}
