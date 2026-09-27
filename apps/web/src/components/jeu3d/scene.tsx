"use client"

import type { CarteVisible, Mission, VueJoueur } from "@courtisans/engine"
import { useCursor } from "@react-three/drei"
import { button, useControls } from "leva"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, Color, Euler, type Mesh, type MeshBasicMaterial, type PerspectiveCamera, Quaternion, Vector3 } from "three"
import { useJeu } from "../jeu/contexte"
import { useInteraction } from "../jeu/interaction"
import { Aura, ReglagesAura } from "./aura"
import { Colonne } from "./colonne"
import { Couronne3D } from "./couronne"
import type { EtatFin } from "./fin"
import { Compteurs, Projecteur, ResolutionFamilles, useCentresGagnants } from "./fin3d"
import { textureMotif } from "./motifs"
import { Carte3D, EPAISSEUR_RELATIVE, geometrieCarte, geometrieTranche } from "./carte3d"
import { type StyleTexte, TexteTable } from "./texte-table"
import {
  CARTE_H,
  CARTE_L,
  DOMAINE_ECHELLE,
  EPAISSEUR_PIOCHE,
  FACE_BAS,
  FACE_HAUT,
  MISSION_H,
  MISSION_L,
  PIOCHE,
  type Pose,
  TAPIS_L,
  TAPIS_P,
  PAS,
  colonneX,
  type Colonne as Colonne_,
  type ZoneDomaine,
  colonneDe,
  cleGroupe,
  disposerDomaine,
  poseDessusPioche,
  penche,
  poseTable,
  type Siege,
  sieges,
} from "./disposition"
import { type Textures, useTextures } from "./textures"

type Placee = { carte: CarteVisible; pose: Pose; joueurId?: string }

function disposer(vue: VueJoueur, places: Map<string, Siege>, deplie: string | null = null, fin: EtatFin | null = null) {
  const map = new Map<string, Placee>()
  const rangs = new Map<string, number>()
  const zones = new Map<string, ZoneDomaine>()
  for (const { carte, niveau } of vue.table) {
    const espion = !!fin && carte.role === "espion"
    const col = espion && fin.espionsTable !== "range" ? "reine" : colonneDe(carte)
    const cle = `${col}:${niveau}`
    const rang = rangs.get(cle) ?? 0
    rangs.set(cle, rang + 1)
    const pose = poseTable(col, niveau, rang, carte.id)
    if (espion && fin.espionsTable === "cache") pose.quaternion.copy(penche(carte.id)).multiply(FACE_BAS)
    map.set(carte.id, { carte, pose })
  }
  for (const j of vue.joueurs) {
    const siege = places.get(j.id)
    if (!siege) continue
    const caches = fin && !fin.domaines ? new Set(j.domaine.filter((c) => c.role === "espion").map((c) => c.id)) : null
    const pileLevee = fin && fin.pile > 0 && !fin.missions ? fin.pile - 1 : null
    const { poses, zone } = disposerDomaine(
      siege,
      j.domaine,
      deplie?.startsWith(`${j.id}:`) ? deplie.slice(j.id.length + 1) : null,
      caches,
      pileLevee,
    )
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

export const CAMERA_DEFAUT = { inclinaison: 40, lacet: 0, distance: 37.6, fov: 26.5, cible: { x: 0, y: 0.6 } }

const RAD = Math.PI / 180
const AXE_Y = new Vector3(0, 1, 0)
const VIDE: string[] = []
const CIBLE_TMP = new Vector3()

function CameraRig() {
  const { size } = useThree()
  const [reglage, regler] = useControls("Caméra", () => ({
    inclinaison: { value: CAMERA_DEFAUT.inclinaison, min: 0, max: 85, step: 0.5, label: "inclinaison °" },
    lacet: { value: CAMERA_DEFAUT.lacet, min: -180, max: 180, step: 1, label: "rotation °" },
    distance: { value: CAMERA_DEFAUT.distance, min: 8, max: 70, step: 0.1 },
    fov: { value: CAMERA_DEFAUT.fov, min: 10, max: 100, step: 0.5, label: "fov °" },
    cible: { value: CAMERA_DEFAUT.cible, step: 0.05, label: "cible x / z" },
  }))
  useControls("Caméra", {
    "Copier les valeurs": button((get) => {
      const valeurs = {
        inclinaison: get("Caméra.inclinaison"),
        lacet: get("Caméra.lacet"),
        distance: get("Caméra.distance"),
        fov: get("Caméra.fov"),
        cible: get("Caméra.cible"),
      }
      navigator.clipboard?.writeText(JSON.stringify(valeurs)).catch(() => null)
      console.info("Caméra", valeurs)
    }),
    Réinitialiser: button(() => regler(CAMERA_DEFAUT)),
  })

  useFrame((etat) => {
    const cam = etat.camera as PerspectiveCamera
    const k = Math.max(1, 1.6 / (size.width / size.height))
    const r = reglage.distance * k
    const incl = reglage.inclinaison * RAD
    const lacet = reglage.lacet * RAD
    const cible = CIBLE_TMP.set(reglage.cible.x, 0, reglage.cible.y)
    cam.up.set(0, 1, 0)
    cam.position.set(
      cible.x + r * Math.sin(incl) * Math.sin(lacet),
      Math.max(0.5, r * Math.cos(incl)),
      cible.z + r * Math.sin(incl) * Math.cos(lacet),
    )
    if (incl < 0.001) cam.up.set(-Math.sin(lacet), 0, -Math.cos(lacet))
    cam.lookAt(cible)
    if (cam.fov !== reglage.fov) {
      cam.fov = reglage.fov
      cam.updateProjectionMatrix()
    }
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
  const texMotif = useMemo(() => textureMotif("losanges"), [])
  const { opacite } = useControls("Plateau", { opacite: { value: 0.08, min: 0, max: 1, step: 0.01, label: "opacité motif" } })
  const dessus = useMemo(() => geometrieCarte(TAPIS_L, TAPIS_P, 0.28), [])
  const tranche = useMemo(() => geometrieTranche(TAPIS_L, TAPIS_P, 0.06, 0.28), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <planeGeometry args={[80, 60]} />
        <meshBasicMaterial map={vignette} toneMapped={false} />
      </mesh>
      {texMotif && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.015} raycast={() => null}>
          <planeGeometry args={[80, 60]} />
          <meshBasicMaterial map={texMotif} transparent opacity={opacite} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh geometry={tranche} rotation-x={-Math.PI / 2}>
        <meshBasicMaterial attach="material-0" visible={false} />
        <meshBasicMaterial attach="material-1" color="#0b1d22" toneMapped={false} />
      </mesh>
      <mesh geometry={dessus} rotation-x={-Math.PI / 2} position-y={0.061}>
        <meshBasicMaterial map={tex.tapis} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Pioche({ nombre }: { nombre: number }) {
  const geo = useMemo(() => geometrieTranche(CARTE_L, CARTE_H, CARTE_L * EPAISSEUR_RELATIVE), [])
  const n = Math.min(nombre, 60)
  return (
    <group position={[PIOCHE.x, 0, PIOCHE.z]}>
      {Array.from({ length: Math.max(0, n - 1) }, (_, i) => (
        <group key={i} position-y={0.03 + (i + 1) * EPAISSEUR_PIOCHE} quaternion={penche(`pioche${i + 1}`, 0.04)}>
          <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={-(CARTE_L * EPAISSEUR_RELATIVE) / 2} raycast={() => null}>
            <meshBasicMaterial attach="material-0" color="#123c42" toneMapped={false} />
            <meshBasicMaterial attach="material-1" color={i % 2 ? "#d9cba6" : "#cdbf98"} toneMapped={false} />
          </mesh>
        </group>
      ))}
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

function FondDomaine({ zone, jouable, survol, couleur }: { zone: ZoneDomaine; jouable: boolean; survol: boolean; couleur: string }) {
  const clair = useMemo(() => `#${new Color(couleur).lerp(new Color("#ffffff"), 0.65).getHexString()}`, [couleur])
  const ref = useRef<MeshBasicMaterial>(null)
  const geo = useMemo(() => geometrieCarte(zone.largeur, zone.profondeur, 0.35), [zone.largeur, zone.profondeur])
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    easing.damp(m, "opacity", jouable ? (survol ? 0.22 : 0.12) : 0.05, 0.15, dt)
    easing.dampC(m.color, jouable ? couleur : "#ffffff", 0.2, dt)
  })
  return (
    <>
      <mesh geometry={geo} position={zone.centre} rotation={[-Math.PI / 2, 0, zone.lacet]} raycast={() => null}>
        <meshBasicMaterial ref={ref} color="#ffffff" transparent opacity={0.05} depthWrite={false} toneMapped={false} />
      </mesh>
      <Aura
        largeur={zone.largeur}
        profondeur={zone.profondeur}
        position={[zone.centre.x, 0.014, zone.centre.z]}
        lacet={zone.lacet}
        force={jouable ? (survol ? 1 : 0.55) : 0}
        couleur={couleur}
        clair={clair}
      />
    </>
  )
}

function positionCouronne(zone: ZoneDomaine | undefined, moi: boolean) {
  if (!zone) return null
  if (moi) return new Vector3(zone.etiquette.x, 0, zone.etiquette.z - 0.5)
  const recul = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), zone.lacetEtiquette)
  return zone.etiquette.clone().addScaledVector(recul, 2.2).setY(0)
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
        onClick()
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

function Cible({ colonne, niveau, onClick }: { colonne: Colonne_; niveau: "haut" | "bas"; onClick: () => void }) {
  const haut = niveau === "haut"
  return (
    <Colonne
      x={colonneX(colonne)}
      z={haut ? -TAPIS_P / 2 : TAPIS_P / 2}
      sens={haut ? -1 : 1}
      largeur={PAS * 0.96}
      longueur={CARTE_H * 2.1}
      couleur={haut ? "#ffe8a3" : "#000000"}
      bord={haut ? "#ffffff" : "#000000"}
      additif={haut}
      onClick={onClick}
    />
  )
}

function Ephemere({ item, tex, onFin }: { item: Transitoire; tex: Textures; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, 2200)
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

function Monde({
  intro,
  missionFocus,
  onMission,
  fin,
}: {
  intro: boolean
  missionFocus: string | null
  onMission: (id: string) => void
  fin: EtatFin | null
}) {
  const { vue, catalogue, pseudo, couleur } = useJeu()
  const it = useInteraction()
  const missions = useMemo(() => vue.moi?.missions ?? [], [vue.moi?.missions])
  const toutesMissions = useMemo(
    () => [...missions, ...vue.joueurs.flatMap((j) => (j.id === vue.moi?.id ? [] : (j.missions ?? [])))],
    [missions, vue.joueurs, vue.moi?.id],
  )
  const tex = useTextures(catalogue, toutesMissions)
  const places = useMemo(() => sieges(vue), [vue])
  const [deplie, setDeplie] = useState<string | null>(null)
  const fermeture = useRef<ReturnType<typeof setTimeout> | null>(null)
  const survolGroupe = (cle: string, actif: boolean) => {
    if (fermeture.current) clearTimeout(fermeture.current)
    if (actif) setDeplie(cle)
    else fermeture.current = setTimeout(() => setDeplie((d) => (d === cle ? null : d)), 180)
  }
  const { map: plateau, zones } = useMemo(() => disposer(vue, places, deplie, fin), [vue, places, deplie, fin])
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
                depart: { ...poseDessusPioche(precedente.nombreCartesPioche - i), delai: 0.35 + i * 0.28 },
                cible: poseSiege(zone),
              })
        }
      })
      const avantMain = new Set(precedente.moi?.main.map((c) => c.id))
      let rang = 0
      for (const c of main)
        if (!avantMain.has(c.id)) nouveaux.set(c.id, { ...poseDessusPioche(precedente.nombreCartesPioche - rang), delai: 0.35 + rang++ * 0.28 })
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
    const pivot = new Vector3(-w - largeur * 0.02 + largeur / 2 + ((n - 1) * pas) / 2, -h + hauteur / 4.5, -D_MAIN)
    const bloc = new Quaternion().setFromEuler(EULER_TMP.set(-(pointer.y + 0.6) * 0.18, (pointer.x + 0.7) * 0.22, inclinaison))
    main.forEach((c, i) => {
      const t = i - (n - 1) / 2
      const choisie = c.id === selectionId
      const leve = choisie ? hauteur * 0.32 : c.id === survol ? hauteur * 0.08 : 0
      const local = new Vector3(t * pas, -Math.abs(t) * hauteur * 0.045 + leve, (choisie ? 0.15 : 0) + i * 0.01).applyQuaternion(bloc).add(pivot)
      const p = poseCamera(c.id)
      p.position.copy(camera.localToWorld(local))
      p.quaternion
        .copy(camera.quaternion)
        .multiply(bloc)
        .multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(0, 0, -t * 0.09)))
      p.echelle = echelle * (choisie ? 1.12 : 1)
    })
    const mL = Math.min(w * 0.36, h * 0.8)
    const mH = (mL * MISSION_H) / MISSION_L
    missions.forEach((m, i) => {
      const p = poseCamera(`mission:${m.id}`)
      if (intro || missionFocus === m.id) {
        const d = intro ? 4.4 : 3.6
        const k = (d / 8) * (1 / (proj[5] * Math.tan((19 * Math.PI) / 180)))
        const x = intro ? (i - 0.5) * (MISSION_L + 0.3) * k : 0
        p.position.copy(camera.localToWorld(new Vector3(x, intro ? 0.3 * k : -0.04 * k, -d)))
        p.quaternion.copy(camera.quaternion)
        if (!intro) p.quaternion.multiply(QUAT_TMP.setFromEuler(EULER_TMP.set(-pointer.y * 0.45, pointer.x * 0.6, 0)))
        p.echelle = intro ? k : 1.3 * k
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
  const resultats = vue.resultats
  const resultatMoi = resultats?.joueurs.find((x) => x.joueurId === moiId)
  const centresGagnants = useCentresGagnants(resultats?.vainqueurs ?? VIDE, zones)

  const discret = intro || !!missionFocus
  const colCible = it.selection && it.peutJouer("table") ? (it.selection.role === "espion" ? "reine" : it.selection.famille) : null
  const candidats = new Set(it.assassinat?.candidats ?? [])
  const domaineCible = (joueurId: string) => !!it.selection && !it.assassinat && it.peutJouer(joueurId === moiId ? "domaine" : "domaineAdverse")
  const jouerDomaine = (joueurId: string) => it.jouer({ zone: "domaine", joueurId })

  return (
    <>
      <CameraRig />
      <ReglagesAura />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 12, 6]} intensity={2.2} />
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
            vitesse={0.12}
            reflet={carte.id === survol || carte.id === selectionId}
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
          vitesse={survol === `mission:${m.id}` && !missionFocus ? 0.05 : 0.24}
          reflet={missionFocus === m.id}
          lueur={fin?.missions && resultatMoi?.missions.find((x) => x.missionId === m.id)?.validee ? "or" : null}
          onSurvol={(s) => setSurvol(s ? `mission:${m.id}` : null)}
          onClick={(e) => {
            e.stopPropagation()
            onMission(m.id)
          }}
        />
      ))}
      {resultats && fin && (
        <>
          <ResolutionFamilles resultats={resultats} fin={fin} />
          <Compteurs vue={vue} resultats={resultats} fin={fin} zones={zones} gagnants={resultats.vainqueurs} />
          <Projecteur fin={fin} centres={centresGagnants.centres} axes={centresGagnants.axes} />
          {fin.projecteur &&
            centresGagnants.zonesGagnantes.map((z, i) => (
              <Aura key={i} largeur={z.largeur} profondeur={z.profondeur} position={[z.centre.x, 0.016, z.centre.z]} lacet={z.lacet} force={0.9} />
            ))}
          {vue.joueurs.map((j) => {
            const zone = zones.get(j.id)
            if (!zone || j.id === moiId || !j.missions) return null
            const r = resultats.joueurs.find((x) => x.joueurId === j.id)
            const largeurTexte = pseudo(j.id).length * 0.45 + 0.6
            return j.missions.map((m, k) => {
              const local = new Vector3(largeurTexte / 2 + 0.75 + k * 1.05, 0.04, -0.45).applyAxisAngle(AXE_Y, zone.lacetEtiquette)
              const lacet = new Quaternion().setFromAxisAngle(AXE_Y, zone.lacetEtiquette)
              const cible: Pose = {
                position: zone.etiquette.clone().add(local),
                quaternion: lacet.multiply(fin.domaines ? FACE_HAUT : FACE_BAS),
                echelle: 0.4,
              }
              return (
                <Carte3D
                  key={m.id}
                  cible={cible}
                  recto={tex.mission(m)}
                  verso={tex.dosMission(m)}
                  largeur={MISSION_L}
                  hauteur={MISSION_H}
                  vitesse={0.22}
                  lueur={fin.missions && r?.missions.find((x) => x.missionId === m.id)?.validee ? "or" : null}
                />
              )
            })
          })}
        </>
      )}
      <Voile actif={discret} opacite={missionFocus ? 0.8 : 0.6} />

      {transitoires.map((t) => (
        <Ephemere key={t.id} item={t} tex={tex} onFin={() => setTransitoires((l) => l.filter((x) => x.id !== t.id))} />
      ))}

      <Pioche nombre={vue.nombreCartesPioche} />
      {vue.nombreCartesPioche > 0 && (
        <Carte3D cible={poseDessusPioche(vue.nombreCartesPioche)} recto={tex.dos} verso={tex.dos} largeur={CARTE_L} hauteur={CARTE_H} />
      )}
      <TexteTable
        texte={String(vue.nombreCartesPioche)}
        style={{ couleur: "#fff4dc", relief: "#8a6a3a", aura: "rgba(255,236,190,0.9)", graisse: 800 }}
        hauteur={0.85}
        position={[PIOCHE.x, 0.04, PIOCHE.z + CARTE_H / 2 + 0.75]}
      />

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return <FondDomaine key={`fond-${j.id}`} zone={zone} jouable={domaineCible(j.id)} survol={survolJoueur === j.id} couleur={couleur(j.id)} />
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
                ? { couleur: "#fff4dc", relief: couleur(j.id), aura: couleur(j.id), espacement: ESPACEMENT }
                : j.id === actif
                  ? { couleur: "#fff4dc", relief: couleur(j.id), aura: "rgba(255,236,190,0.9)", espacement: ESPACEMENT }
                  : { ...ENCRE, espacement: ESPACEMENT }
            }
            onClick={domaineCible(j.id) ? () => jouerDomaine(j.id) : undefined}
            onSurvol={domaineCible(j.id) ? (s) => setSurvolJoueur(s ? j.id : null) : undefined}
          />
        )
      })}

      <Couronne3D cible={actif && vue.phase === "jeu" ? positionCouronne(zones.get(actif), actif === moiId) : null} />

      {colCible &&
        (["haut", "bas"] as const).map((niveau) => (
          <Cible key={niveau} colonne={colCible} niveau={niveau} onClick={() => it.jouer({ zone: "table", niveau })} />
        ))}

      {vue.joueurs.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || !domaineCible(j.id)) return null
        return <ZoneCliquable key={j.id} zone={zone} onClick={() => jouerDomaine(j.id)} onSurvol={(s) => setSurvolJoueur(s ? j.id : null)} />
      })}
    </>
  )
}

export default function Scene3D(props: {
  intro: boolean
  missionFocus: string | null
  onMission: (id: string) => void
  onVide: () => void
  fin: EtatFin | null
}) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 26.5, near: 0.1, far: 200, position: [0, 23, 13.5] }} onPointerMissed={props.onVide}>
      <Suspense fallback={null}>
        <Monde intro={props.intro} missionFocus={props.missionFocus} onMission={props.onMission} fin={props.fin} />
      </Suspense>
    </Canvas>
  )
}
