"use client"

import type { CarteVisible, Mission, VueJoueur } from "@courtisans/engine"
import { Html, useCursor } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AdditiveBlending, CanvasTexture, Euler, type Mesh, type MeshBasicMaterial, Object3D, Quaternion, type SpotLight, Vector3 } from "three"
import { ORDRE_TAPIS } from "@/lib/catalogue"
import { cn } from "@/lib/utils"
import { useJeu } from "../jeu/contexte"
import { useInteraction } from "../jeu/interaction"
import { Carte3D, geometrieCarte } from "./carte3d"
import {
  CARTE_H,
  CARTE_L,
  DOMAINE_ECHELLE,
  DOMAINE_ZONE,
  FACE_BAS,
  FACE_HAUT,
  MISSION_H,
  MISSION_L,
  MISSIONS_POS,
  PIOCHE,
  type Pose,
  TAPIS_L,
  TAPIS_P,
  centreDomaine,
  colonneDe,
  colonneX,
  poseDessusPioche,
  poseTable,
  posesDomaine,
  sieges,
} from "./disposition"
import { type Textures, useTextures } from "./textures"

type Placee = { carte: CarteVisible; pose: Pose }

function disposer(vue: VueJoueur, places: Map<string, Vector3>) {
  const map = new Map<string, Placee>()
  const rangs = new Map<string, number>()
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
    const poses = posesDomaine(siege, j.domaine)
    for (const carte of j.domaine) map.set(carte.id, { carte, pose: poses.get(carte.id)! })
  }
  return { map, rangs }
}

const poseSiege = (siege: Vector3): Pose => ({ position: new Vector3(siege.x, 1.6, siege.z + 1.2), quaternion: FACE_BAS.clone(), echelle: DOMAINE_ECHELLE })

type Transitoire = { id: string; carte: CarteVisible | null; depart: Pose; cible: Pose }

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
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, "rgba(255,160,70,0.45)")
  grad.addColorStop(0.5, "rgba(255,140,60,0.14)")
  grad.addColorStop(1, "rgba(255,130,50,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new CanvasTexture(c)
}

function vignetteTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256)
  grad.addColorStop(0, "#12474e")
  grad.addColorStop(1, "#061a1e")
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
        <meshStandardMaterial map={vignette} roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[TAPIS_L + 0.3, TAPIS_P + 0.3]} />
        <meshStandardMaterial color="#b8860b" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <planeGeometry args={[TAPIS_L, TAPIS_P]} />
        <meshStandardMaterial map={tex.tapis} roughness={0.8} />
      </mesh>
    </group>
  )
}

function LumiereTour({ cible }: { cible: Vector3 | null }) {
  const spot = useRef<SpotLight>(null)
  const disque = useRef<Mesh>(null)
  const texture = useFrameTexture(lueurTexture)
  const [cibleObjet] = useState(() => new Object3D())
  const visee = useRef(new Vector3(0, 0, 0))

  useFrame((_, dt) => {
    if (cible) visee.current.copy(cible)
    easing.damp3(cibleObjet.position, visee.current, 0.35, dt)
    if (spot.current) {
      spot.current.target = cibleObjet
      easing.damp3(spot.current.position, [visee.current.x, 11, visee.current.z + 3], 0.35, dt)
      easing.damp(spot.current, "intensity", cible ? 420 : 0, 0.3, dt)
    }
    if (disque.current) {
      disque.current.position.set(cibleObjet.position.x, 0.02, cibleObjet.position.z)
      easing.damp(disque.current.material as MeshBasicMaterial, "opacity", cible ? 1 : 0, 0.3, dt)
    }
  })

  return (
    <>
      <primitive object={cibleObjet} />
      <spotLight ref={spot} angle={0.42} penumbra={0.8} distance={40} decay={2} color="#ffd89a" />
      <mesh ref={disque} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={texture} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
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
      {label && (
        <Html zIndexRange={[10, 0]} center position={[0, 0, 0.05]} className="pointer-events-none">
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-primary">{label}</span>
        </Html>
      )}
    </group>
  )
}

function Ephemere({ item, tex, onFin }: { item: Transitoire; tex: Textures; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Carte3D cible={item.cible} depart={item.depart} recto={item.carte ? tex.face(item.carte) : tex.dos} verso={tex.dos} largeur={CARTE_L} hauteur={CARTE_H} vitesse={0.12} />
}

function Etiquette({ position, children, actif }: { position: [number, number, number]; children: React.ReactNode; actif?: boolean }) {
  return (
    <Html zIndexRange={[10, 0]} center position={position} className="pointer-events-none select-none">
      <span
        className={cn(
          "font-display text-sm whitespace-nowrap transition-all duration-500 [text-shadow:0_1px_4px_rgb(0_0_0/90%)]",
          actif ? "text-lg text-primary [text-shadow:0_0_14px_rgb(242_193_78/80%)]" : "text-foreground/85",
        )}
      >
        {children}
      </span>
    </Html>
  )
}

const D_MAIN = 6
const QUAT_TMP = new Quaternion()
const EULER_TMP = new Euler()

function Monde({ intro, missionFocus, onMission }: { intro: boolean; missionFocus: string | null; onMission: (id: string) => void }) {
  const { vue, catalogue, pseudo } = useJeu()
  const it = useInteraction()
  const missions = useMemo(() => vue.moi?.missions ?? [], [vue.moi?.missions])
  const tex = useTextures(catalogue, missions)
  const places = useMemo(() => sieges(vue), [vue])
  const { map: plateau, rangs } = useMemo(() => disposer(vue, places), [vue, places])
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
          const siege = places.get(e.joueurId)
          if (siege) nouveaux.set(e.carte.id, poseSiege(siege))
        }
        if (e.type === "carteEliminee") {
          const p = avant.get(e.carte.id)
          if (p) {
            const cible = { position: p.pose.position.clone().add(new Vector3(0, 6, -2)), quaternion: p.pose.quaternion.clone(), echelle: 0.2 }
            ajouts.push({ id: `x-${precedente.journal.length + n}`, carte: p.carte, depart: p.pose, cible })
          }
        }
        if (e.type === "pioche" && e.joueurId !== moiId) {
          const siege = places.get(e.joueurId)
          if (siege) for (let i = 0; i < e.nombre; i++) ajouts.push({ id: `p-${precedente.journal.length + n}-${i}`, carte: null, depart: poseDessusPioche(precedente.nombreCartesPioche - i), cible: poseSiege(siege) })
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
    const hauteur = h * 0.6
    const echelle = hauteur / CARTE_H
    const largeur = CARTE_L * echelle
    main.forEach((c, i) => {
      const n = main.length
      const t = i - (n - 1) / 2
      const leve = c.id === selectionId ? 0.34 : c.id === survol ? 0.14 : 0
      const local = new Vector3(t * largeur * 0.95, -h + hauteur / 6 - Math.abs(t) * 0.07 + leve, -D_MAIN + (c.id === selectionId ? 0.15 : 0) + i * 0.01)
      const p = poseCamera(c.id)
      p.position.copy(camera.localToWorld(local))
      p.quaternion.copy(camera.quaternion).multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, -t * 0.12)))
      p.echelle = echelle
    })
    missions.forEach((m, i) => {
      const p = poseCamera(`mission:${m.id}`)
      if (intro || missionFocus === m.id) {
        const x = intro ? (i - 0.5) * (MISSION_L + 0.3) : 0
        p.position.copy(camera.localToWorld(new Vector3(x, intro ? 0.6 : 0.5, intro ? -8 : -5.4)))
        p.quaternion.copy(camera.quaternion)
        p.echelle = 1
      } else {
        p.position.set(MISSIONS_POS.x, 0.03, MISSIONS_POS.z + i * (MISSION_H + 0.3))
        p.quaternion.copy(FACE_BAS)
        p.echelle = 1
      }
    })
  })

  const actif = vue.phase === "jeu" ? vue.joueurActifId : null
  const lumiere = actif ? (actif === moiId ? new Vector3(-3.5, 0, 6.2) : centreDomaine(places.get(actif) ?? new Vector3())) : null

  const discret = intro || !!missionFocus
  const colCible = it.selection && it.peutJouer("table") ? (it.selection.role === "espion" ? "reine" : it.selection.famille) : null
  const candidats = new Set(it.assassinat?.candidats ?? [])

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 14, 8]} intensity={1.1} />
      <hemisphereLight args={["#fff4dc", "#0b2a30", 0.35]} />
      <LumiereTour cible={lumiere} />
      <Table tex={tex} />

      {!discret && ORDRE_TAPIS.map((col) => {
        const haut = vue.table.filter((p) => p.niveau === "haut" && colonneDe(p.carte) === col).reduce((s, p) => s + (p.carte.role === "noble" ? 2 : 1), 0)
        const bas = vue.table.filter((p) => p.niveau === "bas" && colonneDe(p.carte) === col).reduce((s, p) => s + (p.carte.role === "noble" ? 2 : 1), 0)
        if (!haut && !bas) return null
        return (
          <Html key={col} zIndexRange={[10, 0]} center position={[colonneX(col), 0.05, TAPIS_P / 2 - 0.18]} className="pointer-events-none">
            <span className="rounded-full bg-black/65 px-1.5 text-[10px] leading-4 whitespace-nowrap text-white tabular-nums">
              ▲{haut} ▼{bas}
            </span>
          </Html>
        )
      })}

      {[...plateau.values()].map(({ carte, pose }) => {
        const candidat = candidats.has(carte.id)
        return (
          <Carte3D
            key={carte.id}
            cible={pose}
            depart={departs.get(carte.id)}
            recto={tex.face(carte)}
            verso={tex.dos}
            largeur={CARTE_L}
            hauteur={CARTE_H}
            lueur={candidat ? "rouge" : null}
            onClick={
              candidat
                ? (e) => {
                    e.stopPropagation()
                    it.eliminer(carte.id)
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
      {missions.length > 0 && !discret && (
        <Etiquette position={[MISSIONS_POS.x, 0.05, MISSIONS_POS.z - MISSION_H / 2 - 0.45]}>Mes missions</Etiquette>
      )}

      {transitoires.map((t) => (
        <Ephemere key={t.id} item={t} tex={tex} onFin={() => setTransitoires((l) => l.filter((x) => x.id !== t.id))} />
      ))}

      <group position={[PIOCHE.x, 0, PIOCHE.z]}>
        {vue.nombreCartesPioche > 0 && (
          <mesh position-y={(vue.nombreCartesPioche * 0.006) / 2}>
            <boxGeometry args={[CARTE_L * 0.98, vue.nombreCartesPioche * 0.006, CARTE_H * 0.98]} />
            <meshStandardMaterial color="#e9dfc6" roughness={0.9} />
          </mesh>
        )}
      </group>
      {vue.nombreCartesPioche > 0 && (
        <Carte3D cible={poseDessusPioche(vue.nombreCartesPioche)} recto={tex.dos} verso={tex.dos} largeur={CARTE_L} hauteur={CARTE_H} />
      )}
      {!discret && <Etiquette position={[PIOCHE.x, 0.05, PIOCHE.z + CARTE_H / 2 + 0.4]}>Pioche · {vue.nombreCartesPioche}</Etiquette>}

      {!discret && vue.joueurs.map((j) => {
        const siege = places.get(j.id)
        if (!siege) return null
        return (
          <Etiquette key={j.id} position={[siege.x, 0.05, siege.z]} actif={j.id === actif}>
            {j.id === moiId ? `${pseudo(j.id)} (toi)` : pseudo(j.id)}
          </Etiquette>
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

      {it.selection &&
        vue.joueurs.map((j) => {
          const siege = places.get(j.id)
          if (!siege || !it.peutJouer(j.id === moiId ? "domaine" : "domaineAdverse")) return null
          return (
            <Cible
              key={j.id}
              largeur={DOMAINE_ZONE.largeur}
              hauteur={DOMAINE_ZONE.profondeur}
              pose={{ position: centreDomaine(siege), quaternion: FACE_HAUT.clone(), echelle: 1 }}
              onClick={() => it.jouer({ zone: "domaine", joueurId: j.id })}
            />
          )
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
