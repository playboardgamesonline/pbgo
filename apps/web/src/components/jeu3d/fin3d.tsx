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
  NormalBlending,
  SRGBColorSpace,
  type ShaderMaterial,
  type Texture,
  TextureLoader,
  Vector2,
} from "three"
import { useControls } from "leva"
import { useJeu } from "../jeu/contexte"
import { boutonCopie, onglet } from "./onglets-debug"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { CARTE_H, colonneX, PAS, TAPIS_L, TAPIS_P, type ZoneDomaine } from "./disposition"
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
  couleurLumiere: "#ffc247",
  intensiteLumiere: 0.55,
  couleurDisgrace: "#021414",
  intensiteDisgrace: 0.7,
  fondu: 1.6,
  couverture: 1,
  largeur: 1,
  bordLateral: 0.02,
  pulsation: 0.08,
  vitesse: 1.2,
  tailleFleche: 1.15,
  obscurite: 0.6,
  obscuriteTableau: 0.4,
  forceGagnant: 0.4,
  tapisEclaire: true,
  margeTapis: 0.8,
  taillePoints: 0.75,
  couleurPositif: "#ffd35c",
  couleurNegatif: "#ff5a5a",
  couleurNul: "#a8b0b2",
}

type CleFin = keyof typeof REGLAGES_FIN
const LABELS_FIN: Record<CleFin, [string, string, number?, number?, number?]> = {
  couleurLumiere: ["Familles du tapis", "couleur lumière"],
  intensiteLumiere: ["Familles du tapis", "intensité lumière", 0, 2, 0.01],
  couleurDisgrace: ["Familles du tapis", "couleur disgrâce"],
  intensiteDisgrace: ["Familles du tapis", "intensité disgrâce", 0, 2, 0.01],
  fondu: ["Familles du tapis", "fondu (exposant)", 0.2, 6, 0.05],
  couverture: ["Familles du tapis", "couverture en hauteur", 0.1, 1.5, 0.01],
  largeur: ["Familles du tapis", "largeur (× colonne)", 0.5, 1.2, 0.01],
  bordLateral: ["Familles du tapis", "douceur des côtés", 0, 0.5, 0.005],
  pulsation: ["Familles du tapis", "pulsation", 0, 0.5, 0.01],
  vitesse: ["Familles du tapis", "vitesse pulsation", 0, 5, 0.05],
  tailleFleche: ["Familles du tapis", "taille flèches", 0.3, 3, 0.05],
  obscurite: ["Éclairage", "obscurité", 0, 1, 0.01],
  obscuriteTableau: ["Éclairage", "obscurité (tableau)", 0, 1, 0.01],
  forceGagnant: ["Éclairage", "lumière du vainqueur", 0, 2, 0.01],
  tapisEclaire: ["Éclairage", "tapis éclairé"],
  margeTapis: ["Éclairage", "fondu autour du tapis", 0.05, 3, 0.05],
  taillePoints: ["Points des piles", "taille", 0.3, 2, 0.05],
  couleurPositif: ["Points des piles", "couleur positif"],
  couleurNegatif: ["Points des piles", "couleur négatif"],
  couleurNul: ["Points des piles", "couleur nul"],
}

function useReglagesFin(dossier: string) {
  const [, forcer] = useState(0)
  const cles = (Object.keys(LABELS_FIN) as CleFin[]).filter((c) => LABELS_FIN[c][0] === dossier)
  const schema = Object.fromEntries(
    cles.map((cle) => {
      const [, label, min, max, step] = LABELS_FIN[cle]
      const onChange = (v: never) => {
        ;(REGLAGES_FIN as Record<CleFin, unknown>)[cle] = v
        forcer((n) => n + 1)
      }
      return [cle, { value: REGLAGES_FIN[cle], label, min, max, step, onChange }]
    }),
  )
  const nom = `Fin · ${dossier.toLowerCase()}`
  useControls(nom, { ...schema, ...boutonCopie("SCENE", nom) } as never, { collapsed: true }, onglet("SCENE"))
}

export function ReglagesFin() {
  useReglagesFin("Familles du tapis")
  useReglagesFin("Éclairage")
  useReglagesFin("Points des piles")
  return null
}

const vertexRect = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragmentRect = /* glsl */ `
uniform vec3 uCouleur;
uniform float uForce;
uniform float uFondu;
uniform float uBord;
uniform float uHaut;
varying vec2 vUv;
void main() {
  float v = uHaut > 0.5 ? vUv.y : 1.0 - vUv.y;
  float g = pow(clamp(v, 0.0, 1.0), uFondu);
  float c = min(vUv.x, 1.0 - vUv.x);
  float cotes = uBord > 0.0 ? smoothstep(0.0, uBord, c) : 1.0;
  gl_FragColor = vec4(uCouleur, g * cotes * uForce);
}`

function RectangleFamille({ x, lumiere }: { x: number; lumiere: boolean }) {
  const ref = useRef<Mesh>(null)
  const materiau = useRef<ShaderMaterial>(null)
  const [uniforms] = useState(() => ({
    uCouleur: { value: new Color() },
    uForce: { value: 0 },
    uFondu: { value: 1.6 },
    uBord: { value: 0.02 },
    uHaut: { value: lumiere ? 1 : 0 },
  }))
  useFrame(({ clock }, dt) => {
    const r = REGLAGES_FIN
    const m = ref.current
    const mat = materiau.current
    if (!m || !mat) return
    const u = mat.uniforms
    m.scale.set(PAS * r.largeur, TAPIS_P * r.couverture, 1)
    ;(u.uCouleur.value as Color).set(lumiere ? r.couleurLumiere : r.couleurDisgrace)
    u.uFondu.value = r.fondu
    u.uBord.value = r.bordLateral
    const cible = (lumiere ? r.intensiteLumiere : r.intensiteDisgrace) * (1 + Math.sin(clock.elapsedTime * r.vitesse) * r.pulsation)
    easing.damp(u.uForce, "value", cible, 0.25, dt)
  })
  return (
    <mesh ref={ref} position={[x, 0.065, 0]} rotation-x={-Math.PI / 2} raycast={() => null} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materiau}
        vertexShader={vertexRect}
        fragmentShader={fragmentRect}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={lumiere ? AdditiveBlending : NormalBlending}
      />
    </mesh>
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
            {(lumiere || disgrace) && <RectangleFamille x={x} lumiere={lumiere} />}
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

export function PointsPiles({ vue, resultats, fin, zones }: { vue: VueJoueur; resultats: Resultats; fin: EtatFin; zones: Map<string, ZoneDomaine> }) {
  const [, forcer] = useState(0)
  useFrame(() => {
    if (REGLAGES_FIN.taillePoints !== tailleVue.current) {
      tailleVue.current = REGLAGES_FIN.taillePoints
      forcer((n) => n + 1)
    }
  })
  const tailleVue = useRef(REGLAGES_FIN.taillePoints)
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
                  style={{ couleur, relief: "#1a1a1a", aura: "rgba(0,0,0,0.55)", graisse: 800 }}
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
uniform vec2 uTapis;
uniform float uMargeTapis;
uniform float uTapisOn;
varying vec3 vMonde;
float trou(vec2 c) {
  vec2 d = (vMonde.xz - c) / uAxes;
  return 1.0 - smoothstep(0.75, 1.25, length(d));
}
void main() {
  vec2 q = abs(vMonde.xz) - uTapis;
  float dTapis = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float tapis = (1.0 - smoothstep(0.0, uMargeTapis, dTapis)) * uTapisOn;
  float lumiere = max(max(trou(uCentre1), uDeux * trou(uCentre2)) * uTrou, tapis);
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
    uTapis: { value: new Vector2(TAPIS_L / 2 + 0.3, TAPIS_P / 2 + CARTE_H + 1.2) },
    uMargeTapis: { value: 0.8 },
    uTapisOn: { value: 1 },
  }))
  useFrame((_, dt) => {
    const m = materiau.current
    if (!m) return
    const u = m.uniforms
    easing.damp(u.uNoir, "value", fin.noir ? (fin.tableau ? REGLAGES_FIN.obscuriteTableau : REGLAGES_FIN.obscurite) : 0, 0.5, dt)
    u.uMargeTapis.value = REGLAGES_FIN.margeTapis
    easing.damp(u.uTapisOn, "value", REGLAGES_FIN.tapisEclaire ? 1 : 0, 0.3, dt)
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
