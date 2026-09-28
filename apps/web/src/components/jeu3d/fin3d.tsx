"use client"

import type { Famille, Resultats, VueJoueur } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef, useState } from "react"
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  type Group,
  type Mesh,
  SRGBColorSpace,
  type ShaderMaterial,
  type Texture,
  TextureLoader,
  Vector2,
} from "three"
import { useJeu } from "../jeu/contexte"
import { useReglages, useVersionReglages } from "./reglages"
import { ORDRE_TAPIS } from "@/lib/catalogue"
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

export const REGLAGES_FIN = {
  tailleFleche: 1.15,
  forceGagnant: 0.4,
  taillePoints: 0.75,
  couleurPositif: "#ffd35c",
  couleurNegatif: "#ff5a5a",
  couleurNul: "#a8b0b2",
  relief: true,
  couleurOmbre: "#000000",
  opaciteOmbre: 0.75,
  flouOmbre: 14,
  decalageOmbre: 8,
}

export const REGLAGES_LIGNES = {
  apercu: false,
  longueur: 0.86,
  epaisseur: 0.05,
  lueur: 0.22,
  finExtremites: 0.25,
  decalage: 0.03,
  hauteur: 0.07,
  couleurLumiere: "#ffd35c",
  intensiteLumiere: 1.4,
  couleurDisgrace: "#ff4a3d",
  intensiteDisgrace: 1.1,
  pulsation: 0.18,
  vitesse: 1.6,
}

export function ReglagesFin() {
  useReglages(
    "Mat Lines",
    REGLAGES_LIGNES,
    {
      apercu: "preview on all families",
      longueur: ["length (× column)", 0.1, 1.2, 0.01],
      epaisseur: ["core thickness", 0, 0.4, 0.005],
      lueur: ["glow width", 0.01, 1, 0.01],
      finExtremites: ["end fade", 0, 0.5, 0.01],
      decalage: ["offset from edge", -0.5, 0.5, 0.005],
      hauteur: ["height", 0.02, 0.5, 0.005],
      couleurLumiere: "light color",
      intensiteLumiere: ["light intensity", 0, 4, 0.05],
      couleurDisgrace: "disgrace color",
      intensiteDisgrace: ["disgrace intensity", 0, 4, 0.05],
      pulsation: ["pulse", 0, 1, 0.01],
      vitesse: ["pulse speed", 0, 8, 0.05],
    },
    { ordre: 9 },
  )
  useReglages("End · Mat Arrows", REGLAGES_FIN, { tailleFleche: ["arrow size", 0.3, 3, 0.05] } as never, { ordre: 11 })
  useReglages("End · Winner", REGLAGES_FIN, { forceGagnant: ["winner aura", 0, 2, 0.01] } as never, { ordre: 12 })
  useReglages(
    "End · Pile Points",
    REGLAGES_FIN,
    {
      taillePoints: ["size", 0.3, 2, 0.05],
      couleurPositif: "positive color",
      couleurNegatif: "negative color",
      couleurNul: "zero color",
      relief: "relief",
      couleurOmbre: "drop shadow color",
      opaciteOmbre: ["drop shadow opacity", 0, 1, 0.01],
      flouOmbre: ["drop shadow blur", 0, 60, 1],
      decalageOmbre: ["drop shadow offset", -30, 30, 1],
    } as never,
    { ordre: 13 },
  )
  return null
}

const vertexLigne = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragmentLigne = /* glsl */ `
uniform vec3 uCouleur;
uniform float uForce;
uniform float uEpaisseur;
uniform float uLueur;
uniform float uFin;
uniform vec2 uTaille;
varying vec2 vUv;
void main() {
  float y = abs(vUv.y - 0.5) * uTaille.y;
  float d = max(y - uEpaisseur * 0.5, 0.0);
  float a = exp(-d * d / max(uLueur * uLueur * 0.25, 0.0001));
  float coeur = 1.0 - smoothstep(0.0, uEpaisseur * 0.5 + 0.001, y);
  float x = min(vUv.x, 1.0 - vUv.x);
  a *= uFin > 0.0 ? smoothstep(0.0, uFin, x) : 1.0;
  vec3 c = mix(uCouleur, vec3(1.0), coeur * 0.6);
  gl_FragColor = vec4(c * a * uForce, a * uForce);
}`

function LigneFamille({ x, lumiere }: { x: number; lumiere: boolean }) {
  const ref = useRef<Mesh>(null)
  const materiau = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({
    uCouleur: { value: new Color() },
    uForce: { value: 0 },
    uEpaisseur: { value: 0.05 },
    uLueur: { value: 0.2 },
    uFin: { value: 0.25 },
    uTaille: { value: new Vector2(1, 1) },
  }))
  useFrame(({ clock }, dt) => {
    const r = REGLAGES_LIGNES
    const m = ref.current
    const mat = materiau.current
    if (!m || !mat) return
    const u = mat.uniforms
    const longueur = PAS * r.longueur
    const largeur = r.epaisseur + r.lueur * 2
    m.scale.set(longueur, largeur, 1)
    const bord = TAPIS_P / 2 + r.decalage
    m.position.set(x, r.hauteur, lumiere ? -bord : bord)
    ;(u.uTaille.value as Vector2).set(longueur, largeur)
    ;(u.uCouleur.value as Color).set(lumiere ? r.couleurLumiere : r.couleurDisgrace)
    u.uEpaisseur.value = r.epaisseur
    u.uLueur.value = r.lueur
    u.uFin.value = r.finExtremites
    const cible = (lumiere ? r.intensiteLumiere : r.intensiteDisgrace) * (1 + Math.sin(clock.elapsedTime * r.vitesse) * r.pulsation)
    easing.damp(u.uForce, "value", cible, 0.25, dt)
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} raycast={() => null} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materiau}
        vertexShader={vertexLigne}
        fragmentShader={fragmentLigne}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}

export function LignesTapis({ resultats, fin }: { resultats: Resultats | null; fin: EtatFin | null }) {
  useVersionReglages()
  if (REGLAGES_LIGNES.apercu)
    return (
      <>
        {FAMILLES_TABLE.map((f) => (
          <group key={f}>
            <LigneFamille x={colonneX(f)} lumiere />
            <LigneFamille x={colonneX(f)} lumiere={false} />
          </group>
        ))}
      </>
    )
  if (!resultats || !fin) return null
  return (
    <>
      {FAMILLES_TABLE.slice(0, fin.familles).map((f) => {
        const s = resultats.statuts[f].statut
        if (s === "neutre") return null
        return <LigneFamille key={f} x={colonneX(f)} lumiere={s === "lumiere"} />
      })}
    </>
  )
}

const textures = new Map<string, Texture>()
function textureUrl(url: string) {
  let t = textures.get(url)
  if (!t) {
    t = new TextureLoader().load(url)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    textures.set(url, t)
  }
  return t
}

function Fleche({ url, position }: { url: string; position: [number, number, number] }) {
  const [texture] = useState(() => textureUrl(url))
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (ref.current) ref.current.scale.setScalar(REGLAGES_FIN.tailleFleche)
  })
  return (
    <Apparition position={position} flotte={0}>
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={4} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </Apparition>
  )
}

export function ResolutionFamilles({ resultats, fin }: { resultats: Resultats; fin: EtatFin }) {
  const { catalogue } = useJeu()
  return (
    <>
      {FAMILLES_TABLE.slice(0, fin.familles).map((f) => {
        const s = resultats.statuts[f]
        const x = colonneX(f)
        const lumiere = s.statut === "lumiere"
        const disgrace = s.statut === "disgrace"
        return (
          <group key={f}>
            {lumiere || disgrace ? (
              <Fleche
                url={lumiere ? catalogue.flecheHautUrl : catalogue.flecheBasUrl}
                position={[x, 0.1, lumiere ? -TAPIS_P / 2 + 0.2 : TAPIS_P / 2 - 0.2]}
              />
            ) : (
              <Signe signe="egal" position={[x, 0.1, 0]} />
            )}
          </group>
        )
      })}
    </>
  )
}

function ombreRgba() {
  const c = new Color(REGLAGES_FIN.couleurOmbre)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${REGLAGES_FIN.opaciteOmbre})`
}

export function PointsPiles({ vue, resultats, fin, zones }: { vue: VueJoueur; resultats: Resultats; fin: EtatFin; zones: Map<string, ZoneDomaine> }) {
  useVersionReglages()
  if (fin.pile === 0) return null
  return (
    <group renderOrder={7}>
      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        const r = resultats.joueurs.find((x) => x.joueurId === j.id)
        if (!zone || !r) return null
        return zone.piles.slice(0, fin.pile).map((pile, i) => {
          if (!pile.famille) return null
          const points = r.detail.find((d) => d.famille === pile.famille)?.points ?? 0
          const couleur = points > 0 ? REGLAGES_FIN.couleurPositif : points < 0 ? REGLAGES_FIN.couleurNegatif : REGLAGES_FIN.couleurNul
          return (
            <group key={`${j.id}-${i}`} position={pile.position}>
              <Apparition position={[0, 0, 0]} flotte={0}>
                <TexteTable
                  texte={points > 0 ? `+${points}` : points < 0 ? `−${-points}` : "+0"}
                  style={{
                    couleur,
                    relief: REGLAGES_FIN.relief ? "#1a1a1a" : undefined,
                    graisse: 800,
                    ombre: `${ombreRgba()}|${REGLAGES_FIN.flouOmbre}|${REGLAGES_FIN.decalageOmbre}`,
                  }}
                  hauteur={REGLAGES_FIN.taillePoints}
                  position={[0, 0, 0]}
                  ordre={7}
                />
              </Apparition>
            </group>
          )
        })
      })}
    </group>
  )
}

export function Compteurs({ vue, resultats, fin, zones }: { vue: VueJoueur; resultats: Resultats; fin: EtatFin; zones: Map<string, ZoneDomaine> }) {
  if (fin.pile === 0 && !fin.missions) return null
  return (
    <>
      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        const r = resultats.joueurs.find((x) => x.joueurId === j.id)
        if (!zone || !r) return null
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
