"use client"

import type { CarteVisible, Mission, VueJoueur } from "@courtisans/engine"
import { Html, useCursor } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, Euler, type Mesh, type MeshBasicMaterial, Quaternion, Vector3 } from "three"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { useJeu } from "../jeu/contexte"
import { useInteraction } from "../jeu/interaction"
import { Pseudo } from "../jeu/pseudo"
import { Carte3D, geometrieCarte } from "./carte3d"
import {
  CARTE_H,
  CARTE_L,
  DOMAINE_ECHELLE,
  FACE_BAS,
  MISSION_H,
  MISSION_L,
  MISSIONS_POS,
  PIOCHE,
  type Pose,
  TAPIS_L,
  TAPIS_P,
  type ZoneDomaine,
  colonneDe,
  disposerDomaine,
  colonneX,
  poseDessusPioche,
  poseTable,
  type Siege,
  sieges,
} from "./disposition"
import { type Textures, useTextures } from "./textures"

type Placee = { carte: CarteVisible; pose: Pose; joueurId?: string }

function disposer(vue: VueJoueur, places: Map<string, Siege>) {
  const map = new Map<string, Placee>()
  const rangs = new Map<string, number>()
  const zones = new Map<string, ZoneDomaine>()
  for (const { carte, niveau } of vue.table) {
    const col = colonneDe(carte)
    const cle = `${col}:${niveau}`
    const rang = rangs.get(cle) ?? 0
    rangs.set(cle, rang + 1)
    map.set(carte.id, { carte, pose: poseTable(col, niveau, rang) })
  }
  for (const j of vue.joueurs) {
    const siege = places.get(j.id)
    if (!siege) continue
    const { poses, zone } = disposerDomaine(siege, j.domaine)
    zones.set(j.id, zone)
    for (const carte of j.domaine) map.set(carte.id, { carte, pose: poses.get(carte.id)!, joueurId: j.id })
  }
  return { map, rangs, zones }
}

const poseSiege = (zone: ZoneDomaine): Pose => ({
  position: new Vector3(zone.centre.x, 1.6, zone.centre.z),
  quaternion: FACE_BAS.clone(),
  echelle: DOMAINE_ECHELLE,
})

type Transitoire = {
  id: string
  carte: CarteVisible | null
  depart: Pose
  cible: Pose
}

function CameraRig() {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const k = Math.max(1, 1.78 / (size.width / size.height))
    camera.position.set(0, 23 * k, 13.5 * k)
    camera.lookAt(0, 0, -0.6)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function useFrameTexture(creer: () => CanvasTexture) {
  const [texture] = useState(creer)
  return texture
}

function lueurTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 120)
  grad.addColorStop(0, "rgba(255,214,120,0.34)")
  grad.addColorStop(0.75, "rgba(255,200,100,0.16)")
  grad.addColorStop(1, "rgba(255,200,100,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

function vignetteTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256)
  grad.addColorStop(0, "#1d5a60")
  grad.addColorStop(0.6, "#12424a")
  grad.addColorStop(1, "#0a2a30")
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  return new CanvasTexture(c)
}

function Table({ tex }: { tex: Textures }) {
  const vignette = useFrameTexture(vignetteTexture)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[80, 60]} />
        <meshBasicMaterial map={vignette} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[TAPIS_L + 0.3, TAPIS_P + 0.3]} />
        <meshBasicMaterial color="#d9a93f" toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <planeGeometry args={[TAPIS_L, TAPIS_P]} />
        <meshBasicMaterial map={tex.tapis} toneMapped={false} />
      </mesh>
    </group>
  )
}

function LumiereTour({ cible }: { cible: Vector3 | null }) {
  const disque = useRef<Mesh>(null)
  const texture = useFrameTexture(lueurTexture)
  const visee = useRef(new Vector3(0, 0, 0))
  const position = useRef(new Vector3(0, 0.015, 0))

  useFrame((_, dt) => {
    if (cible) visee.current.set(cible.x, 0.015, cible.z)
    easing.damp3(position.current, visee.current, 0.35, dt)
    if (disque.current) {
      disque.current.position.copy(position.current)
      easing.damp(disque.current.material as MeshBasicMaterial, "opacity", cible ? 1 : 0, 0.3, dt)
    }
  })

  return (
    <mesh ref={disque} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[9, 9]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Voile({ actif }: { actif: boolean }) {
  const ref = useRef<Mesh>(null)
  const { camera } = useThree()
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.position.copy(camera.localToWorld(new Vector3(0, 0, -5)))
    ref.current.quaternion.copy(camera.quaternion)
    const m = ref.current.material as MeshBasicMaterial
    easing.damp(m, "opacity", actif ? 0.6 : 0, 0.2, dt)
    ref.current.visible = m.opacity > 0.01
  })
  return (
    <mesh ref={ref} renderOrder={10}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#020b0d" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function ZoneCliquable({ zone, onClick }: { zone: ZoneDomaine; onClick: () => void }) {
  const [survol, setSurvol] = useState(false)
  useCursor(survol)
  return (
    <mesh
      position={[zone.centre.x, 0.2, zone.centre.z]}
      rotation={[-Math.PI / 2, 0, zone.lacet]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setSurvol(true)
      }}
      onPointerOut={() => setSurvol(false)}
    >
      <planeGeometry args={[zone.largeur, zone.profondeur + 0.8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Cible({ largeur, hauteur, pose, label, onClick }: { largeur: number; hauteur: number; pose: Pose; label?: string; onClick: () => void }) {
  const ref = useRef<Mesh>(null)
  const [survol, setSurvol] = useState(false)
  useCursor(survol)
  const geo = useMemo(() => geometrieCarte(largeur, hauteur), [largeur, hauteur])
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as MeshBasicMaterial).opacity = (survol ? 0.5 : 0.2) + Math.sin(clock.elapsedTime * 4) * 0.07
  })
  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <mesh
        ref={ref}
        geometry={geo}
        position-z={0.02}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setSurvol(true)
        }}
        onPointerOut={() => setSurvol(false)}
      >
        <meshBasicMaterial color="#f2c14e" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Html zIndexRange={[10, 0]} center position={[0, 0, 0.05]} className="pointer-events-none">
        <span className={cn("rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-primary", !label && "hidden")}>
          {label}
        </span>
      </Html>
    </group>
  )
}

function Ephemere({ item, tex, onFin }: { item: Transitoire; tex: Textures; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Carte3D
      cible={item.cible}
      depart={item.depart}
      recto={item.carte ? tex.face(item.carte) : tex.dos}
      verso={tex.dos}
      largeur={CARTE_L}
      hauteur={CARTE_H}
      vitesse={0.12}
    />
  )
}

function Etiquette({
  position,
  children,
  actif,
  visible = true,
  onClick,
}: {
  position: [number, number, number]
  children: React.ReactNode
  actif?: boolean
  visible?: boolean
  onClick?: () => void
}) {
  return (
    <Html zIndexRange={[10, 0]} center position={position} className="pointer-events-none select-none">
      <span
        onClick={onClick}
        className={cn(
          "block font-display text-sm whitespace-nowrap transition-all duration-500 [text-shadow:0_1px_4px_rgb(0_0_0/90%)]",
          !visible && "opacity-0",
          actif ? "text-lg text-primary [text-shadow:0_0_14px_rgb(242_193_78/80%)]" : "text-foreground/85",
          onClick && visible && "pointer-events-auto cursor-pointer text-lg text-primary [text-shadow:0_0_12px_rgb(242_193_78/90%)]",
        )}
      >
        {children}
      </span>
    </Html>
  )
}

function EtiquetteJoueur({
  position,
  nom,
  couleur,
  moi,
  actif,
  visible,
  onClick,
}: {
  position: [number, number, number]
  nom: string
  couleur: string
  moi: boolean
  actif: boolean
  visible: boolean
  onClick?: () => void
}) {
  return (
    <Html zIndexRange={[10, 0]} center position={position} className="pointer-events-none select-none">
      <span
        onClick={onClick}
        className={cn(
          "block rounded-full px-2 text-lg transition-all duration-500",
          !visible && "opacity-0",
          actif && "scale-125",
          onClick && visible && "pointer-events-auto cursor-pointer bg-primary/25 shadow-[0_0_18px_6px_rgb(242_193_78/45%)]",
        )}
      >
        <Pseudo nom={nom} couleur={couleur} />
        {moi && <span className="ml-1 text-sm font-semibold text-white/80 [text-shadow:0_1px_3px_rgb(0_0_0/90%)]">(toi)</span>}
      </span>
    </Html>
  )
}

const D_MAIN = 6
const QUAT_TMP = new Quaternion()
const EULER_TMP = new Euler()

function Monde({ intro, missionFocus, onMission }: { intro: boolean; missionFocus: string | null; onMission: (id: string) => void }) {
  const { vue, catalogue, pseudo, couleur } = useJeu()
  const it = useInteraction()
  const missions = useMemo(() => vue.moi?.missions ?? [], [vue.moi?.missions])
  const tex = useTextures(catalogue, missions)
  const places = useMemo(() => sieges(vue), [vue])
  const { map: plateau, rangs, zones } = useMemo(() => disposer(vue, places), [vue, places])
  const main = vue.moi?.main ?? []
  const moiId = vue.moi?.id

  const [precedente, setPrecedente] = useState(vue)
  const [departs, setDeparts] = useState<Map<string, Pose>>(new Map())
  const [transitoires, setTransitoires] = useState<Transitoire[]>([])

  if (precedente !== vue) {
    const nouveaux = new Map<string, Pose>()
    const ajouts: Transitoire[] = []
    if (vue.journal.length >= precedente.journal.length) {
      const avant = disposer(precedente, sieges(precedente)).map
      vue.journal.slice(precedente.journal.length).forEach((e, n) => {
        if (e.type === "carteJouee" && e.joueurId !== moiId) {
          const zone = zones.get(e.joueurId)
          if (zone) nouveaux.set(e.carte.id, poseSiege(zone))
        }
        if (e.type === "carteEliminee") {
          const p = avant.get(e.carte.id)
          if (p) {
            const cible = {
              position: p.pose.position.clone().add(new Vector3(0, 6, -2)),
              quaternion: p.pose.quaternion.clone(),
              echelle: 0.2,
            }
            ajouts.push({
              id: `x-${precedente.journal.length + n}`,
              carte: p.carte,
              depart: p.pose,
              cible,
            })
          }
        }
        if (e.type === "pioche" && e.joueurId !== moiId) {
          const zone = zones.get(e.joueurId)
          if (zone)
            for (let i = 0; i < e.nombre; i++)
              ajouts.push({
                id: `p-${precedente.journal.length + n}-${i}`,
                carte: null,
                depart: poseDessusPioche(precedente.nombreCartesPioche - i),
                cible: poseSiege(zone),
              })
        }
      })
      const avantMain = new Set(precedente.moi?.main.map((c) => c.id))
      for (const c of main) if (!avantMain.has(c.id)) nouveaux.set(c.id, poseDessusPioche(precedente.nombreCartesPioche))
    }
    setDeparts(nouveaux)
    if (ajouts.length) setTransitoires((t) => [...t, ...ajouts])
    setPrecedente(vue)
  }

  const { camera } = useThree()
  const [survol, setSurvol] = useState<string | null>(null)
  const [posesCamera] = useState(() => new Map<string, Pose>())
  const poseCamera = (id: string) => {
    let p = posesCamera.get(id)
    if (!p) {
      p = { position: new Vector3(), quaternion: new Quaternion(), echelle: 1 }
      posesCamera.set(id, p)
    }
    return p
  }

  const selectionId = it.selection?.id
  useFrame(() => {
    const cam = camera as unknown as { fov: number; aspect: number }
    const h = D_MAIN * Math.tan((cam.fov * Math.PI) / 360)
    const hauteur = h * 0.52
    const echelle = hauteur / CARTE_H
    const largeur = CARTE_L * echelle
    main.forEach((c, i) => {
      const n = main.length
      const t = i - (n - 1) / 2
      const leve = c.id === selectionId ? 0.34 : c.id === survol ? 0.14 : 0
      const local = new Vector3(
        (-h * cam.aspect) / 3 + t * largeur * 0.86,
        -h + hauteur / 5 - Math.abs(t) * 0.07 + leve,
        -D_MAIN + (c.id === selectionId ? 0.15 : 0) + i * 0.01,
      )
      const p = poseCamera(c.id)
      p.position.copy(camera.localToWorld(local))
      p.quaternion.copy(camera.quaternion).multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, -t * 0.12)))
      p.echelle = echelle
    })
    missions.forEach((m, i) => {
      const p = poseCamera(`mission:${m.id}`)
      if (intro || missionFocus === m.id) {
        const d = intro ? 4.4 : 3.6
        const k = d / 8
        const x = intro ? (i - 0.5) * (MISSION_L + 0.3) * k : 0
        p.position.copy(camera.localToWorld(new Vector3(x, 0.3 * k, -d)))
        p.quaternion.copy(camera.quaternion)
        p.echelle = intro ? k : 1.4 * k
      } else {
        p.position.set(MISSIONS_POS.x, 0.03, MISSIONS_POS.z + i * (MISSION_H + 0.3))
        p.quaternion.copy(FACE_BAS)
        p.echelle = 1
      }
    })
  })

  const actif = vue.phase === "jeu" ? vue.joueurActifId : null
  const lumiere = actif ? (zones.get(actif)?.centre ?? null) : null

  const discret = intro || !!missionFocus
  const colCible = it.selection && it.peutJouer("table") ? (it.selection.role === "espion" ? "reine" : it.selection.famille) : null
  const candidats = new Set(it.assassinat?.candidats ?? [])
  const domaineCible = (joueurId: string) => !!it.selection && !it.assassinat && it.peutJouer(joueurId === moiId ? "domaine" : "domaineAdverse")
  const jouerDomaine = (joueurId: string) => it.jouer({ zone: "domaine", joueurId })

  return (
    <>
      <CameraRig />
      <LumiereTour cible={lumiere} />
      <Table tex={tex} />

      {ORDRE_TAPIS.map((col) => {
        const haut = vue.table
          .filter((p) => p.niveau === "haut" && colonneDe(p.carte) === col)
          .reduce((s, p) => s + (p.carte.role === "noble" ? 2 : 1), 0)
        const bas = vue.table
          .filter((p) => p.niveau === "bas" && colonneDe(p.carte) === col)
          .reduce((s, p) => s + (p.carte.role === "noble" ? 2 : 1), 0)
        return (
          <Html key={col} zIndexRange={[10, 0]} center position={[colonneX(col), 0.05, TAPIS_P / 2 - 0.18]} className="pointer-events-none">
            <span
              className={cn(
                "rounded-full bg-black/65 px-1.5 text-[10px] leading-4 whitespace-nowrap text-white tabular-nums transition-opacity",
                (discret || (!haut && !bas)) && "opacity-0",
              )}
            >
              ▲{haut} ▼{bas}
            </span>
          </Html>
        )
      })}

      {[...plateau.values()].map(({ carte, pose, joueurId }) => {
        const candidat = candidats.has(carte.id)
        const cibleDomaine = !!joueurId && domaineCible(joueurId)
        return (
          <Carte3D
            key={carte.id}
            cible={pose}
            depart={departs.get(carte.id)}
            recto={tex.face(carte)}
            verso={tex.dos}
            largeur={CARTE_L}
            hauteur={CARTE_H}
            lueur={candidat ? "rouge" : cibleDomaine ? "or" : null}
            onClick={
              candidat
                ? (e) => {
                    e.stopPropagation()
                    it.eliminer(carte.id)
                  }
                : cibleDomaine
                  ? (e) => {
                      e.stopPropagation()
                      jouerDomaine(joueurId)
                    }
                  : undefined
            }
          />
        )
      })}

      {main.map((carte) => {
        const jouable = it.monTour && !it.assassinat && !it.envoi
        return (
          <Carte3D
            key={carte.id}
            cible={poseCamera(carte.id)}
            depart={departs.get(carte.id)}
            recto={tex.face(carte)}
            verso={tex.dos}
            largeur={CARTE_L}
            hauteur={CARTE_H}
            arc={0.15}
            vitesse={0.12}
            lueur={carte.id === selectionId ? "or" : null}
            onSurvol={(s) => setSurvol(s ? carte.id : null)}
            onClick={
              jouable
                ? (e) => {
                    e.stopPropagation()
                    it.selectionner(carte.id === selectionId ? null : carte)
                  }
                : undefined
            }
          />
        )
      })}

      {missions.map((m: Mission) => (
        <Carte3D
          key={m.id}
          cible={poseCamera(`mission:${m.id}`)}
          recto={tex.mission(m)}
          verso={tex.dosMission(m)}
          largeur={MISSION_L}
          hauteur={MISSION_H}
          arc={0.1}
          vitesse={0.14}
          onClick={(e) => {
            e.stopPropagation()
            onMission(m.id)
          }}
        />
      ))}
      <Voile actif={discret} />

      {transitoires.map((t) => (
        <Ephemere key={t.id} item={t} tex={tex} onFin={() => setTransitoires((l) => l.filter((x) => x.id !== t.id))} />
      ))}

      <group position={[PIOCHE.x, 0, PIOCHE.z]}>
        {vue.nombreCartesPioche > 0 && (
          <mesh position-y={(vue.nombreCartesPioche * 0.006) / 2}>
            <boxGeometry args={[CARTE_L * 0.98, vue.nombreCartesPioche * 0.006, CARTE_H * 0.98]} />
            <meshBasicMaterial color="#d8ccae" toneMapped={false} />
          </mesh>
        )}
      </group>
      {vue.nombreCartesPioche > 0 && (
        <Carte3D cible={poseDessusPioche(vue.nombreCartesPioche)} recto={tex.dos} verso={tex.dos} largeur={CARTE_L} hauteur={CARTE_H} />
      )}
      <Etiquette visible={!discret} position={[PIOCHE.x, 0.05, PIOCHE.z + CARTE_H / 2 + 0.4]}>
        Pioche · {vue.nombreCartesPioche}
      </Etiquette>

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return (
          <EtiquetteJoueur
            key={j.id}
            nom={pseudo(j.id)}
            couleur={couleur(j.id)}
            moi={j.id === moiId}
            visible={!discret}
            position={[zone.etiquette.x, zone.etiquette.y, zone.etiquette.z]}
            actif={j.id === actif}
            onClick={domaineCible(j.id) ? () => jouerDomaine(j.id) : undefined}
          />
        )
      })}

      {colCible &&
        (["haut", "bas"] as const).map((niveau) => (
          <Cible
            key={niveau}
            largeur={CARTE_L}
            hauteur={CARTE_H}
            pose={poseTable(colCible, niveau, rangs.get(`${colCible}:${niveau}`) ?? 0)}
            label={discret ? undefined : niveau === "haut" ? "▲ Faveur" : "▼ Défaveur"}
            onClick={() => it.jouer({ zone: "table", niveau })}
          />
        ))}

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || !domaineCible(j.id)) return null
        return <ZoneCliquable key={j.id} zone={zone} onClick={() => jouerDomaine(j.id)} />
      })}
    </>
  )
}

export default function Scene3D(props: { intro: boolean; missionFocus: string | null; onMission: (id: string) => void; onVide: () => void }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 38, near: 0.1, far: 200, position: [0, 23, 13.5] }} onPointerMissed={props.onVide}>
      <Suspense fallback={null}>
        <Monde intro={props.intro} missionFocus={props.missionFocus} onMission={props.onMission} />
      </Suspense>
    </Canvas>
  )
}
