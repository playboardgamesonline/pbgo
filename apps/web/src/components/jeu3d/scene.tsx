"use client"

import type { CarteVisible, Mission, VueJoueur } from "@courtisans/engine"
import { useCursor } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, Euler, type Mesh, type MeshBasicMaterial, Quaternion, Vector3 } from "three"
import { useJeu } from "../jeu/contexte"
import { useInteraction } from "../jeu/interaction"
import { aGlisse, deplacerCamera, recentrerCamera, setGlisse, vueCamera, zoomerCamera } from "./camera"
import { Carte3D, geometrieCarte } from "./carte3d"
import { type StyleTexte, TexteTable } from "./texte-table"
import {
  CARTE_H,
  CARTE_L,
  DOMAINE_ECHELLE,
  FACE_BAS,
  MISSION_H,
  MISSION_L,
  PIOCHE,
  type Pose,
  TAPIS_L,
  TAPIS_P,
  type ZoneDomaine,
  colonneDe,
  cleGroupe,
  disposerDomaine,
  poseDessusPioche,
  poseTable,
  type Siege,
  sieges,
} from "./disposition"
import { type Textures, useTextures } from "./textures"

type Placee = { carte: CarteVisible; pose: Pose; joueurId?: string }

function disposer(vue: VueJoueur, places: Map<string, Siege>, deplie: string | null = null) {
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
    const { poses, zone } = disposerDomaine(siege, j.domaine, deplie?.startsWith(`${j.id}:`) ? deplie.slice(j.id.length + 1) : null)
    zones.set(j.id, zone)
    for (const carte of j.domaine) map.set(carte.id, { carte, pose: poses.get(carte.id)!, joueurId: j.id })
  }
  return { map, rangs, zones }
}

const poseSiege = (zone: ZoneDomaine): Pose => ({
  position: new Vector3(zone.etiquette.x, 3.5, zone.etiquette.z),
  quaternion: new Quaternion().setFromEuler(new Euler(0, zone.lacetEtiquette, 0)).multiply(FACE_BAS),
  echelle: DOMAINE_ECHELLE * 0.7,
})

type Transitoire = {
  id: string
  carte: CarteVisible | null
  depart: Pose
  cible: Pose
}

const CIBLE_CAMERA = new Vector3(0, 0, -0.62)

function CameraRig() {
  const { camera, size, gl } = useThree()
  const courant = useRef({ lacet: 0, inclinaison: 0, zoom: 1 })

  useEffect(() => {
    const el = gl.domElement
    let depart: { x: number; y: number } | null = null
    let dernier = { x: 0, y: 0 }
    const bas = (e: PointerEvent) => {
      setGlisse(false)
      depart = { x: e.clientX, y: e.clientY }
      dernier = depart
    }
    const bouge = (e: PointerEvent) => {
      if (!depart || e.buttons === 0) return
      if (!aGlisse() && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 6) return
      setGlisse(true)
      deplacerCamera(-(e.clientX - dernier.x) * 0.004, (e.clientY - dernier.y) * 0.004)
      dernier = { x: e.clientX, y: e.clientY }
    }
    const haut = () => {
      depart = null
    }
    const molette = (e: WheelEvent) => {
      e.preventDefault()
      zoomerCamera(Math.exp(e.deltaY * 0.0012))
    }
    const double = () => {
      if (!aGlisse()) recentrerCamera()
    }
    const menu = (e: Event) => e.preventDefault()
    el.addEventListener("pointerdown", bas)
    window.addEventListener("pointermove", bouge)
    window.addEventListener("pointerup", haut)
    el.addEventListener("wheel", molette, { passive: false })
    el.addEventListener("dblclick", double)
    el.addEventListener("contextmenu", menu)
    return () => {
      el.removeEventListener("pointerdown", bas)
      window.removeEventListener("pointermove", bouge)
      window.removeEventListener("pointerup", haut)
      el.removeEventListener("wheel", molette)
      el.removeEventListener("dblclick", double)
      el.removeEventListener("contextmenu", menu)
    }
  }, [gl])

  useFrame(({ pointer }, dt) => {
    const c = courant.current
    easing.damp(c, "lacet", vueCamera.lacet, 0.22, dt)
    easing.damp(c, "inclinaison", vueCamera.inclinaison, 0.22, dt)
    easing.damp(c, "zoom", vueCamera.zoom, 0.18, dt)
    const k = Math.max(1, 1.6 / (size.width / size.height))
    const lacet = c.lacet + pointer.x * 0.035
    const inclinaison = c.inclinaison + 0.035 + pointer.y * 0.025
    const r = 29.2 * k * c.zoom
    camera.position.set(
      CIBLE_CAMERA.x + r * Math.sin(inclinaison) * Math.sin(lacet),
      r * Math.cos(inclinaison),
      CIBLE_CAMERA.z + r * Math.sin(inclinaison) * Math.cos(lacet),
    )
    camera.up.set(-Math.sin(lacet), 0, -Math.cos(lacet))
    camera.lookAt(CIBLE_CAMERA)
  })
  return null
}

function useFrameTexture(creer: () => CanvasTexture) {
  const [texture] = useState(creer)
  return texture
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
      <mesh position-y={0.03}>
        <boxGeometry args={[TAPIS_L, 0.06, TAPIS_P]} />
        <meshBasicMaterial attach="material-0" color="#0b1d22" toneMapped={false} />
        <meshBasicMaterial attach="material-1" color="#0b1d22" toneMapped={false} />
        <meshBasicMaterial attach="material-2" map={tex.tapis} toneMapped={false} />
        <meshBasicMaterial attach="material-3" color="#0b1d22" toneMapped={false} />
        <meshBasicMaterial attach="material-4" color="#0b1d22" toneMapped={false} />
        <meshBasicMaterial attach="material-5" color="#0b1d22" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Voile({ actif, opacite }: { actif: boolean; opacite: number }) {
  const ref = useRef<Mesh>(null)
  const { camera } = useThree()
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.position.copy(camera.localToWorld(new Vector3(0, 0, -5)))
    ref.current.quaternion.copy(camera.quaternion)
    const m = ref.current.material as MeshBasicMaterial
    easing.damp(m, "opacity", actif ? opacite : 0, 0.2, dt)
    ref.current.visible = m.opacity > 0.01
  })
  return (
    <mesh ref={ref} renderOrder={10}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#020b0d" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function FondDomaine({ zone, jouable, survol }: { zone: ZoneDomaine; jouable: boolean; survol: boolean }) {
  const ref = useRef<MeshBasicMaterial>(null)
  const geo = useMemo(() => geometrieCarte(zone.largeur, zone.profondeur, 0.35), [zone.largeur, zone.profondeur])
  useFrame(({ clock }, dt) => {
    const m = ref.current
    if (!m) return
    const cible = jouable ? (survol ? 0.55 : 0.3 + Math.sin(clock.elapsedTime * 3.2) * 0.1) : 0.05
    easing.damp(m, "opacity", cible, 0.12, dt)
    easing.dampC(m.color, jouable ? "#ffd766" : "#ffffff", 0.2, dt)
  })
  return (
    <mesh geometry={geo} position={zone.centre} rotation={[-Math.PI / 2, 0, zone.lacet]} raycast={() => null}>
      <meshBasicMaterial ref={ref} color="#ffffff" transparent opacity={0.05} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Badge({
  zone,
  texte,
  style,
  onClick,
  onSurvol,
}: {
  zone: ZoneDomaine
  texte: string
  style: StyleTexte
  onClick?: () => void
  onSurvol?: (s: boolean) => void
}) {
  return (
    <group position={zone.etiquette} rotation-y={zone.lacetEtiquette}>
      <TexteTable texte={texte} style={style} hauteur={0.62} position={[0, 0, -0.45]} onClick={onClick} onSurvol={onSurvol} />
    </group>
  )
}

function ZoneCliquable({ zone, onClick, onSurvol }: { zone: ZoneDomaine; onClick: () => void; onSurvol: (s: boolean) => void }) {
  const [survol, setSurvol] = useState(false)
  useCursor(survol)
  return (
    <mesh
      position={[zone.centre.x, 0.016, zone.centre.z]}
      rotation={[-Math.PI / 2, 0, zone.lacet]}
      onClick={(e) => {
        e.stopPropagation()
        if (!aGlisse()) onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setSurvol(true)
        onSurvol(true)
      }}
      onPointerOut={() => {
        setSurvol(false)
        onSurvol(false)
      }}
    >
      <planeGeometry args={[zone.largeur, zone.profondeur + 0.8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Cible({ largeur, hauteur, pose, onClick }: { largeur: number; hauteur: number; pose: Pose; onClick: () => void }) {
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
          if (!aGlisse()) onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setSurvol(true)
        }}
        onPointerOut={() => setSurvol(false)}
      >
        <meshBasicMaterial color="#f2c14e" transparent depthWrite={false} toneMapped={false} />
      </mesh>
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

const D_MAIN = 6
const ENCRE = { couleur: "rgba(4,32,36,0.45)" }
const ESPACEMENT = "18px"
const QUAT_TMP = new Quaternion()
const EULER_TMP = new Euler()

function Monde({ intro, missionFocus, onMission }: { intro: boolean; missionFocus: string | null; onMission: (id: string) => void }) {
  const { vue, catalogue, pseudo, couleur } = useJeu()
  const it = useInteraction()
  const missions = useMemo(() => vue.moi?.missions ?? [], [vue.moi?.missions])
  const tex = useTextures(catalogue, missions)
  const places = useMemo(() => sieges(vue), [vue])
  const [deplie, setDeplie] = useState<string | null>(null)
  const fermeture = useRef<ReturnType<typeof setTimeout> | null>(null)
  const survolGroupe = (cle: string, actif: boolean) => {
    if (fermeture.current) clearTimeout(fermeture.current)
    if (actif) setDeplie(cle)
    else fermeture.current = setTimeout(() => setDeplie((d) => (d === cle ? null : d)), 180)
  }
  const { map: plateau, rangs, zones } = useMemo(() => disposer(vue, places, deplie), [vue, places, deplie])
  const main = vue.moi?.main ?? []
  const moiId = vue.moi?.id

  const [precedente, setPrecedente] = useState(vue)
  const [departs, setDeparts] = useState<Map<string, Pose>>(new Map())
  const [transitoires, setTransitoires] = useState<Transitoire[]>([])

  const [posesCamera] = useState(() => new Map<string, Pose>())

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
        if (e.type === "carteJouee" && e.joueurId === moiId) {
          const p = posesCamera.get(e.carte.id)
          if (p) nouveaux.set(e.carte.id, { position: p.position.clone(), quaternion: p.quaternion.clone(), echelle: p.echelle })
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
  const [survolJoueur, setSurvolJoueur] = useState<string | null>(null)
  const poseCamera = (id: string) => {
    let p = posesCamera.get(id)
    if (!p) {
      p = { position: new Vector3(), quaternion: new Quaternion(), echelle: 1 }
      posesCamera.set(id, p)
    }
    return p
  }

  const selectionId = it.selection?.id
  useFrame(({ pointer }) => {
    const proj = camera.projectionMatrix.elements
    const h = D_MAIN / proj[5]
    const w = D_MAIN / proj[0]
    const hauteur = h * 0.66
    const echelle = hauteur / CARTE_H
    const largeur = CARTE_L * echelle
    const pas = largeur * 0.9
    const n = main.length
    const inclinaison = -0.1
    const centreMain = -w - largeur * 0.02 + largeur / 2 + ((n - 1) * pas) / 2
    main.forEach((c, i) => {
      const t = i - (n - 1) / 2
      const leve = c.id === selectionId ? hauteur * 0.24 : c.id === survol ? hauteur * 0.08 : 0
      const local = new Vector3(
        centreMain + t * pas,
        -h + hauteur / 7 + t * pas * Math.sin(inclinaison) - Math.abs(t) * hauteur * 0.02 + leve,
        -D_MAIN + (c.id === selectionId ? 0.15 : 0) + i * 0.01,
      )
      const p = poseCamera(c.id)
      p.position.copy(camera.localToWorld(local))
      p.quaternion.copy(camera.quaternion).multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, inclinaison - t * 0.05)))
      p.echelle = echelle
    })
    const mL = Math.min(w * 0.36, h * 0.8)
    const mH = (mL * MISSION_H) / MISSION_L
    missions.forEach((m, i) => {
      const p = poseCamera(`mission:${m.id}`)
      if (intro || missionFocus === m.id) {
        const d = intro ? 4.4 : 3.6
        const k = d / 8
        const x = intro ? (i - 0.5) * (MISSION_L + 0.3) * k : 0
        p.position.copy(camera.localToWorld(new Vector3(x, 0.3 * k, -d)))
        p.quaternion.copy(camera.quaternion)
        if (!intro) p.quaternion.multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(-pointer.y * 0.45, pointer.x * 0.6, 0)))
        p.echelle = intro ? k : 1.4 * k
      } else {
        const survolee = survol === `mission:${m.id}`
        const machoire = i === 0 ? 0.28 : -0.05
        const bras = -mL * 0.44
        const pivotX = w - mL * 0.03
        const pivotY = -h + mH * 0.55
        const x = pivotX + Math.cos(machoire) * bras
        const y = pivotY - Math.sin(machoire) * bras + (i === 0 ? mH * 0.16 : -mH * 0.08) + (survolee ? mH * 0.05 : 0)
        p.position.copy(camera.localToWorld(new Vector3(x, y, -D_MAIN + 0.05 + (i === 0 ? 0 : 0.02))))
        p.quaternion.copy(camera.quaternion).multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, -machoire)))
        p.echelle = (mL / MISSION_L) * (survol === `mission:${m.id}` ? 1.05 : 1)
      }
    })
  })

  const actif = vue.phase === "jeu" ? vue.joueurActifId : null

  const discret = intro || !!missionFocus
  const colCible = it.selection && it.peutJouer("table") ? (it.selection.role === "espion" ? "reine" : it.selection.famille) : null
  const candidats = new Set(it.assassinat?.candidats ?? [])
  const domaineCible = (joueurId: string) => !!it.selection && !it.assassinat && it.peutJouer(joueurId === moiId ? "domaine" : "domaineAdverse")
  const jouerDomaine = (joueurId: string) => it.jouer({ zone: "domaine", joueurId })

  return (
    <>
      <CameraRig />
      <Table tex={tex} />

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
            lueur={candidat ? "rouge" : null}
            onSurvol={
              joueurId
                ? (s) => {
                    survolGroupe(`${joueurId}:${cleGroupe(carte)}`, s)
                    if (cibleDomaine) setSurvolJoueur(s ? joueurId : null)
                  }
                : undefined
            }
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
          vitesse={intro || missionFocus ? 0.14 : 0.05}
          reflet={missionFocus === m.id}
          onSurvol={(s) => setSurvol(s ? `mission:${m.id}` : null)}
          onClick={(e) => {
            e.stopPropagation()
            onMission(m.id)
          }}
        />
      ))}
      <Voile actif={discret} opacite={missionFocus ? 0.8 : 0.6} />

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
      <TexteTable texte={String(vue.nombreCartesPioche)} style={ENCRE} hauteur={0.55} position={[PIOCHE.x, 0.04, PIOCHE.z + CARTE_H / 2 + 0.6]} />

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return <FondDomaine key={`fond-${j.id}`} zone={zone} jouable={domaineCible(j.id)} survol={survolJoueur === j.id} />
      })}

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || j.id === moiId) return null
        return (
          <Badge
            key={j.id}
            zone={zone}
            texte={pseudo(j.id).toUpperCase()}
            style={
              survolJoueur === j.id && domaineCible(j.id)
                ? { couleur: couleur(j.id), lueur: couleur(j.id), espacement: ESPACEMENT }
                : j.id === actif
                  ? { couleur: couleur(j.id), espacement: ESPACEMENT }
                  : { ...ENCRE, espacement: ESPACEMENT }
            }
            onClick={domaineCible(j.id) ? () => jouerDomaine(j.id) : undefined}
            onSurvol={domaineCible(j.id) ? (s) => setSurvolJoueur(s ? j.id : null) : undefined}
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
            onClick={() => it.jouer({ zone: "table", niveau })}
          />
        ))}

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || !domaineCible(j.id)) return null
        return <ZoneCliquable key={j.id} zone={zone} onClick={() => jouerDomaine(j.id)} onSurvol={(s) => setSurvolJoueur(s ? j.id : null)} />
      })}
    </>
  )
}

export default function Scene3D(props: { intro: boolean; missionFocus: string | null; onMission: (id: string) => void; onVide: () => void }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 38, near: 0.1, far: 200, position: [0, 23, 13.5] }} onPointerMissed={() => !aGlisse() && props.onVide()}>
      <Suspense fallback={null}>
        <Monde intro={props.intro} missionFocus={props.missionFocus} onMission={props.onMission} />
      </Suspense>
    </Canvas>
  )
}
