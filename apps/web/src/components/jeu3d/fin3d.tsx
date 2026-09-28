"use client"

import type { Famille, Resultats, VueJoueur } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef, useState } from "react"
import { CanvasTexture, type Group, type Mesh, SRGBColorSpace, type Texture, TextureLoader, Vector2 } from "three"
import { useControls } from "leva"
import { useJeu } from "../jeu/contexte"
import { boutonCopie, onglet } from "./onglets-debug"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { colonneX, TAPIS_P, type ZoneDomaine } from "./disposition"
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
}

type CleFin = keyof typeof REGLAGES_FIN
const LABELS_FIN: Record<CleFin, [string, string, number?, number?, number?]> = {
  tailleFleche: ["Familles du tapis", "taille flèches", 0.3, 3, 0.05],
  forceGagnant: ["Vainqueur", "aura du vainqueur", 0, 2, 0.01],
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
  useReglagesFin("Vainqueur")
  useReglagesFin("Points des piles")
  return null
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
