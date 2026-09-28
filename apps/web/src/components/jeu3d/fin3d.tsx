"use client"

import type { Famille, Resultats, VueJoueur } from "@courtisans/engine"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useMemo, useRef, useState } from "react"
import {
  CanvasTexture,
  Color,
  type Group,
  type Mesh,
  SRGBColorSpace,
  type Texture,
  Vector2,
} from "three"
import { useJeu } from "../jeu/contexte"
import { useReglages, useVersionReglages } from "./reglages"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { CARTE_H, colonneX, PAS, TAPIS_P, type ZoneDomaine } from "./disposition"
import { Colonne } from "./colonne"
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
  largeur: 0.96,
  longueur: 2.1,
  hauteur: 0.07,
  fondu: 1.6,
  couleurLumiere: "#ffe8a3",
  bordLumiere: "#ffffff",
  intensiteLumiere: 0.85,
  couleurDisgrace: "#000000",
  bordDisgrace: "#000000",
  intensiteDisgrace: 0.85,
  pulsation: 0.15,
  vitesse: 1.6,
}

export function ReglagesFin() {
  useReglages(
    "End · Mat Lines",
    REGLAGES_LIGNES,
    {
      apercu: "preview on all families",
      largeur: ["width (× column)", 0.1, 1.5, 0.01],
      longueur: ["length (× card height)", 0.2, 5, 0.05],
      hauteur: ["height", 0.02, 0.5, 0.005],
      fondu: ["fade curve", 0.2, 5, 0.05],
      couleurLumiere: "light color",
      bordLumiere: "light edge color",
      intensiteLumiere: ["light intensity", 0, 3, 0.01],
      couleurDisgrace: "disgrace color",
      bordDisgrace: "disgrace edge color",
      intensiteDisgrace: ["disgrace intensity", 0, 3, 0.01],
      pulsation: ["pulse", 0, 1, 0.01],
      vitesse: ["pulse speed", 0, 8, 0.05],
    },
    { ordre: 9, ferme: false },
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

function LigneFamille({ x, lumiere }: { x: number; lumiere: boolean }) {
  const r = REGLAGES_LIGNES
  return (
    <Colonne
      x={x}
      z={lumiere ? -TAPIS_P / 2 : TAPIS_P / 2}
      sens={lumiere ? -1 : 1}
      largeur={PAS * r.largeur}
      longueur={CARTE_H * r.longueur}
      hauteur={r.hauteur}
      fondu={r.fondu}
      couleur={lumiere ? r.couleurLumiere : r.couleurDisgrace}
      bord={lumiere ? r.bordLumiere : r.bordDisgrace}
      additif={lumiere}
      force={(t) =>
        (lumiere ? REGLAGES_LIGNES.intensiteLumiere : REGLAGES_LIGNES.intensiteDisgrace) *
        (1 + Math.sin(t * REGLAGES_LIGNES.vitesse) * REGLAGES_LIGNES.pulsation)
      }
    />
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
    const toile = document.createElement("canvas")
    toile.width = toile.height = 4
    const texture = new CanvasTexture(toile)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const l = img.naturalWidth || 512
      const h = img.naturalHeight || 512
      const k = 512 / Math.max(l, h)
      toile.width = Math.round(l * k)
      toile.height = Math.round(h * k)
      toile.getContext("2d")!.drawImage(img, 0, 0, toile.width, toile.height)
      texture.dispose()
      texture.needsUpdate = true
    }
    img.src = url
    t = texture
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
