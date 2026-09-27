"use client"

import type { Famille, Resultats, VueJoueur } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef, useState } from "react"
import { AdditiveBlending, CanvasTexture, DoubleSide, type Group, type Mesh, type MeshBasicMaterial, type ShaderMaterial, Vector2 } from "three"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { Aura } from "./aura"
import { CARTE_H, colonneX, DECALAGE, PAS, TAPIS_P, type ZoneDomaine } from "./disposition"
import type { EtatFin } from "./fin"
import { TexteTable } from "./texte-table"

const FAMILLES_TABLE = ORDRE_TAPIS.filter((c): c is Famille => c !== "reine")
const HOLO = { couleur: "#fffaf0", bloom: "rgba(255,255,255,0.95)", holo: true, graisse: 800 }

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

let degrade: CanvasTexture | null = null
function textureRayon() {
  if (!degrade) {
    const c = document.createElement("canvas")
    c.width = 4
    c.height = 128
    const g = c.getContext("2d")!
    const grad = g.createLinearGradient(0, 0, 0, 128)
    grad.addColorStop(0, "rgba(255,255,255,0)")
    grad.addColorStop(1, "rgba(255,255,255,1)")
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 128)
    degrade = new CanvasTexture(c)
  }
  return degrade
}

function Rayon({ x }: { x: number }) {
  const ref = useRef<MeshBasicMaterial>(null)
  const [texture] = useState(textureRayon)
  useFrame(({ clock }, dt) => {
    if (ref.current) easing.damp(ref.current, "opacity", 0.16 + Math.sin(clock.elapsedTime * 2.4) * 0.04, 0.4, dt)
  })
  return (
    <mesh position={[x, 2.2, 0]} raycast={() => null}>
      <cylinderGeometry args={[0.35, PAS * 0.55, 4.4, 32, 1, true]} />
      <meshBasicMaterial
        ref={ref}
        map={texture}
        color="#ffd98a"
        transparent
        opacity={0}
        side={DoubleSide}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function ResolutionFamilles({ resultats, fin, rangs }: { resultats: Resultats; fin: EtatFin; rangs: Map<string, number> }) {
  return (
    <>
      {FAMILLES_TABLE.slice(0, fin.familles).map((f) => {
        const s = resultats.statuts[f]
        const x = colonneX(f)
        const haut = rangs.get(`${f}:haut`) ?? 0
        const bas = rangs.get(`${f}:bas`) ?? 0
        const zHaut = -(TAPIS_P / 2 + (haut ? CARTE_H + (haut - 1) * DECALAGE : 0) + 0.55)
        const zBas = TAPIS_P / 2 + (bas ? CARTE_H + (bas - 1) * DECALAGE : 0) + 0.55
        const lumiere = s.statut === "lumiere"
        const disgrace = s.statut === "disgrace"
        return (
          <group key={f}>
            <Apparition position={[x, 0.6, zHaut]}>
              <TexteTable texte={String(s.haut)} style={HOLO} hauteur={0.62} position={[0, 0, 0]} />
            </Apparition>
            <Apparition position={[x, 0.6, zBas]}>
              <TexteTable texte={String(s.bas)} style={HOLO} hauteur={0.62} position={[0, 0, 0]} />
            </Apparition>
            {(lumiere || disgrace) && (
              <Aura
                largeur={PAS * 0.85}
                profondeur={TAPIS_P * 0.75}
                position={[x, 0.07, 0]}
                lacet={0}
                force={lumiere ? 0.7 : 1.5}
                couleur={lumiere ? "#ffc247" : "#021414"}
                clair={lumiere ? "#fff5c7" : "#1d6b62"}
                additif={lumiere}
              />
            )}
            {lumiere && <Rayon x={x} />}
            <Apparition position={[x, 1.1, 0]} flotte={0.1}>
              <TexteTable
                texte={lumiere ? "LUMIÈRE" : disgrace ? "DISGRÂCE" : "ÉGALITÉ"}
                style={{
                  ...HOLO,
                  couleur: lumiere ? "#fff1c4" : disgrace ? "#a9e4d6" : "#e9e4d4",
                  bloom: lumiere ? "#ffd36a" : disgrace ? "#0f5c52" : "#ffffff",
                  espacement: "6px",
                }}
                hauteur={0.24}
                position={[0, 0, 0]}
              />
            </Apparition>
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
          <Apparition key={j.id} position={[zone.centre.x, 1.8, zone.centre.z]} flotte={0.12}>
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
    easing.damp(u.uNoir, "value", fin.noir ? 0.82 : 0, 0.5, dt)
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
