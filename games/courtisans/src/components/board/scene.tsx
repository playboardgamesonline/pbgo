"use client"

import { type Family, type Mission, type PlayerView, type Role, type VisibleCard, missionOf } from "@courtisans/engine"
import { useCursor } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useMemo, useRef, useState } from "react"
import { Color, Euler, type Group, type Mesh, MeshBasicMaterial, Quaternion, Shape, ShapeGeometry, Vector3 } from "three"
import { useCourtisans } from "../game/context"
import { useInteraction } from "../game/interaction"
import { Aura, AURA_FIELDS, WINNER_AURA_SETTINGS, ZONE_AURA_SETTINGS } from "./aura"
import { CrownMark } from "./crown"
import { SeatAvatarMesh } from "./seat-avatar-mesh"
import type { EndingState } from "./ending"
import { Counters, MissionSign, MatLine, MatLines, PilePoints, ENDING_SETTINGS, EndingSettings, FamilyResolution, useWinnerCenters } from "./ending3d"
import { copyButton, debugTab, useControls } from "@pbgo/core/components/game/debug-controls"
import { useSeatTheme } from "@pbgo/core/components/game/seat-label"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { Card, FACE_DOWN, lean, onTable, Pile, type Pose, Playmat, SCREEN_HAND_FIELDS, ScreenHand, screenHandLayout, type SurfaceProps, Table, useSettings, useSettingsVersion, Zone, type ZoneCard } from "@pbgo/table"
import { useSkin } from "@pbgo/core/components/skin-provider"
import { type TextStyle, TableText } from "./table-text"
import {
  CARD_SIZE,
  DOMAIN_SCALE,
  MISSION_H,
  MISSION_SIZE,
  MISSION_W,
  DRAW_PILE,
  MISSION_PILE,
  missionPilePose,
  HAND_SETTINGS,
  LAYOUT_SETTINGS,
  MAT_W,
  MAT_D,
  columnX,
  type Column as Column_,
  type DomainZone,
  columnOf,
  groupKey,
  arrangeDomain,
  deckTopPose,
  tablePose,
  type Seat,
  seats,
  missionRestPose,
} from "./layout"
import { CAMERA, INTRO, PHOTO } from "./camera"
import { type Textures, useTextures } from "./textures"

type Placed = { card: VisibleCard; pose: Pose; playerId?: string }

function arrange(view: PlayerView, places: Map<string, Seat>, unfolded: string | null = null, ending: EndingState | null = null) {
  const map = new Map<number, Placed>()
  const ranks = new Map<string, number>()
  const zones = new Map<string, DomainZone>()
  for (const { card, level } of view.table) {
    const spy = !!ending && card.role === "spy"
    const col = spy && ending.tableSpies !== "sort" ? "queen" : columnOf(card)
    const key = `${col}:${level}`
    const rank = ranks.get(key) ?? 0
    ranks.set(key, rank + 1)
    const pose = tablePose(col, level, rank, card.id)
    if (spy && ending.tableSpies === "cache") pose.quaternion.copy(lean(String(card.id))).multiply(FACE_DOWN)
    map.set(card.id, { card, pose })
  }
  for (const j of view.players) {
    const seat = places.get(j.id)
    if (!seat) continue
    const hidden = ending && !ending.domains ? new Set(j.domain.filter((c) => c.role === "spy").map((c) => c.id)) : null
    const liftedPile = ending && ending.pile > 0 && !ending.missions ? ending.pile - 1 : null
    const { poses, zone } = arrangeDomain(
      seat,
      j.domain,
      unfolded?.startsWith(`${j.id}:`) ? unfolded.slice(j.id.length + 1) : null,
      hidden,
      liftedPile,
    )
    zones.set(j.id, zone)
    for (const card of j.domain) map.set(card.id, { card, pose: poses.get(card.id)!, playerId: j.id })
  }
  return { map, ranks, zones }
}

const underTablePose = (zone: DomainZone): Pose => {
  const outside = new Vector3(zone.center.x, 0, zone.center.z).normalize()
  return {
    position: zone.center
      .clone()
      .addScaledVector(outside, zone.depth / 2 + 1.2)
      .setY(-1.6),
    quaternion: new Quaternion().setFromEuler(new Euler(0, zone.labelYaw, 0)).multiply(FACE_DOWN),
    scale: DOMAIN_SCALE * 0.8,
  }
}

const seatPose = (zone: DomainZone): Pose => ({
  position: new Vector3(zone.labelPos.x, 3.5, zone.labelPos.z),
  quaternion: new Quaternion().setFromEuler(new Euler(0, zone.labelYaw, 0)).multiply(FACE_DOWN),
  scale: DOMAIN_SCALE * 0.7,
})

type Transient = {
  id: string
  card: VisibleCard | null
  origin: Pose
  target: Pose
}

const EMPTY: string[] = []

function FollowCamera({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null)
  const { camera } = useThree()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
  }, -1)
  return <group ref={ref}>{children}</group>
}

function Veil({ active, opacity, fade = 0.2 }: { active: boolean; opacity: number; fade?: number }) {
  const ref = useRef<Mesh>(null)
  const { camera } = useThree()
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.position.copy(camera.localToWorld(new Vector3(0, 0, -5)))
    ref.current.quaternion.copy(camera.quaternion)
    const m = ref.current.material as MeshBasicMaterial
    easing.damp(m, "opacity", active ? opacity : 0, active ? fade : 0.2, dt)
    ref.current.visible = m.opacity > 0.01
  })
  return (
    <mesh ref={ref} renderOrder={10} userData={{ hideInPhoto: true }}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color="#020b0d" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export const ZONE_SETTINGS = {
  restOpacity: 0.12,
  playableOpacity: 0.12,
  hoverOpacity: 0.22,
  playableAura: 0.55,
  hoverAura: 1,
  rounding: 0.35,
  nicknameSize: 0.62,
  nicknameOffset: 0.45,
  avatarSize: 0.7,
  avatarGap: 0.2,
}

/** Where the cards of a pile come in from, above it, when the pile is put on the mat */
const PILE_ENTRY = (x: number, z: number) => onTable(x, z, { y: 3, face: "down" })

function ZoneSettings() {
  // The viewer's hand is held at the bottom left of the screen: the Hand folder tunes it, as the Held hands and the layout have theirs
  useSettings("Hand", HAND_SETTINGS, SCREEN_HAND_FIELDS, { order: 2 })
  useSettings(
    "Player Zone",
    ZONE_SETTINGS,
    {
      restOpacity: ["idle opacity", 0, 1, 0.01],
      playableOpacity: ["playable opacity", 0, 1, 0.01],
      hoverOpacity: ["hover opacity", 0, 1, 0.01],
      playableAura: ["playable aura", 0, 2, 0.01],
      hoverAura: ["hover aura", 0, 2, 0.01],
      rounding: ["corner radius", 0, 1.5, 0.01],
      nicknameSize: ["name size", 0.2, 2, 0.01],
      nicknameOffset: ["name offset", -2, 2, 0.01],
      avatarSize: ["avatar size", 0.2, 2, 0.01],
      avatarGap: ["avatar gap", 0, 1.5, 0.01],
    },
    { order: 6 },
  )
  useSettings("Player Zone", ZONE_AURA_SETTINGS, AURA_FIELDS as never, { order: 6 })
  return null
}

/** A rounded rectangle lying on the table, for the background of a domain (it goes with the backgrounds, when the seats are the shared ones) */
function roundedPlane(width: number, depth: number, radius: number) {
  const x = -width / 2
  const y = -depth / 2
  const shape = new Shape()
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + depth - radius)
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth)
  shape.lineTo(x + radius, y + depth)
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return new ShapeGeometry(shape, 6)
}

function DomainBackground({ zone, playable, hover, color }: { zone: DomainZone; playable: boolean; hover: boolean; color: string }) {
  const bright = useMemo(() => `#${new Color(color).lerp(new Color("#ffffff"), 0.65).getHexString()}`, [color])
  const ref = useRef<MeshBasicMaterial>(null)
  const rounding = ZONE_SETTINGS.rounding
  const geo = useMemo(() => roundedPlane(zone.width, zone.depth, rounding), [zone.width, zone.depth, rounding])
  useFrame((_, dt) => {
    const m = ref.current
    if (!m) return
    easing.damp(m, "opacity", playable ? (hover ? ZONE_SETTINGS.hoverOpacity : ZONE_SETTINGS.playableOpacity) : ZONE_SETTINGS.restOpacity, 0.15, dt)
    easing.dampC(m.color, color, 0.2, dt)
  })
  return (
    <>
      <mesh geometry={geo} position={zone.center} rotation={[-Math.PI / 2, 0, zone.yaw]} raycast={() => null}>
        <meshBasicMaterial ref={ref} color="#ffffff" transparent opacity={0.05} depthWrite={false} toneMapped={false} />
      </mesh>
      <Aura
        width={zone.width}
        depth={zone.depth}
        position={[zone.center.x, 0.014, zone.center.z]}
        yaw={zone.yaw}
        strength={() => (playable ? (hover ? ZONE_SETTINGS.hoverAura : ZONE_SETTINGS.playableAura) : 0)}
        settings={ZONE_AURA_SETTINGS}
        color={color}
        bright={bright}
      />
    </>
  )
}

function Badge({
  zone,
  text,
  style,
  onClick,
  onHover,
  children,
}: {
  zone: DomainZone
  text: string
  style: TextStyle
  onClick?: () => void
  onHover?: (s: boolean) => void
  /** What sits left of the nickname (the seat avatar, the turn crown), in a frame whose origin is the first letter's left edge */
  children?: React.ReactNode
}) {
  return (
    <group position={zone.labelPos} rotation-y={zone.labelYaw}>
      <TableText
        text={text}
        style={style}
        elevation={ZONE_SETTINGS.nicknameSize}
        position={[0, 0, -ZONE_SETTINGS.nicknameOffset]}
        onClick={onClick}
        onHover={onHover}
      >
        {children}
      </TableText>
    </group>
  )
}

function ClickableZone({ zone, onClick, onHover }: { zone: DomainZone; onClick: () => void; onHover: (s: boolean) => void }) {
  const [hover, setHover] = useState(false)
  useCursor(hover)
  return (
    <mesh
      position={[zone.center.x, 0.016, zone.center.z]}
      rotation={[-Math.PI / 2, 0, zone.yaw]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        onHover(true)
      }}
      onPointerOut={() => {
        setHover(false)
        onHover(false)
      }}
    >
      <planeGeometry args={[zone.width, zone.depth + 0.8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Target({ column, level, onClick }: { column: Column_; level: "up" | "down"; onClick: () => void }) {
  return <MatLine x={columnX(column)} light={level === "up"} onClick={onClick} />
}

function Ephemeral({ item, tex, onEnd }: { item: Transient; tex: Textures; onEnd: () => void }) {
  useEffect(() => {
    const t = setTimeout(onEnd, 3000 + (item.origin.delay ?? 0) * 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <Card id={`transient-${item.id}`} target={item.target} from={item.origin} front={item.card ? tex.face(item.card) : tex.back} back={tex.back} size={CARD_SIZE} speed={0.12} onArrive={onEnd} />
  )
}

/** A click on the table where nothing answers. The shared `Table` passes none on from its canvas, so a plane under everything takes it: what lies over it stops its own clicks. */
function EmptyClick({ onClick }: { onClick: () => void }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01} onClick={onClick}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

const HAND_DISTANCE = 6
const SPACING = "18px"
const QUAT_GROUP = new Quaternion()
const QUAT_LOCAL = new Quaternion()
const EULER_TMP = new Euler()

export type OpeningStep = "unroll" | "deal" | "missions" | null
export type OpeningSettings = { matDuration: number; dealStep: number }

function World({
  openingStep,
  missionFocus,
  onMission,
  onEmpty,
  onReady,
  held,
  onLoaded,
  onProgress,
  ending,
  settings,
}: {
  openingStep: OpeningStep
  missionFocus: string | null
  onMission: (id: string) => void
  onEmpty: () => void
  onReady: () => void
  held: boolean
  onLoaded: () => void
  onProgress: (progress: number) => void
  ending: EndingState | null
  settings: OpeningSettings
}) {
  useEffect(() => onReady(), [onReady])
  const { theme } = useSiteSettings()
  const { view, catalog, log, nickname, color, avatarUrl } = useCourtisans()
  const seat = useSeatTheme()
  const { hostIcon } = useSkin()
  const it = useInteraction()
  // The view gives the ids of the missions: the rule of each (its colour) is the engine's, its text and picture are Sanity's
  const missions = useMemo(() => (view.me?.missions ?? []).map(missionOf), [view.me?.missions])
  const allMissions = useMemo(
    () => [...missions, ...view.players.flatMap((j) => (j.id === view.me?.id ? [] : (j.missions ?? []).map(missionOf)))],
    [missions, view.players, view.me?.id],
  )
  const tex = useTextures(catalog, allMissions)
  // Mounted is not loaded: the start screen waits for the pictures too (PLT-107). The scene being there is a tenth of the way, the pictures are the rest
  const picturesLoaded = tex.loaded
  const picturesDone = tex.progress
  useEffect(() => {
    if (picturesLoaded) onLoaded()
  }, [picturesLoaded, onLoaded])
  useEffect(() => onProgress(0.1 + 0.9 * picturesDone), [picturesDone, onProgress])
  const places = useMemo(() => seats(view), [view])
  const [unfolded, setUnfolded] = useState<string | null>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverGroup = (key: string, active: boolean) => {
    if (closing.current) clearTimeout(closing.current)
    if (active) setUnfolded(key)
    else closing.current = setTimeout(() => setUnfolded((d) => (d === key ? null : d)), 180)
  }
  const settingsVersion = useSettingsVersion()
  const { map: board, zones } = useMemo(
    () => arrange(view, places, it.assassination ? unfolded : null, ending),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, places, unfolded, ending, it.assassination, settingsVersion],
  )
  const hand = view.me?.hand ?? []
  const meId = view.me?.id
  const myZone = meId ? zones.get(meId) : undefined
  // resting poses of the other players' missions (backs only): cached so the animation does not restart at each render
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `zones` is not read by the cache, it is what empties it
  const restPoses = useMemo(() => new Map<string, Pose>(), [zones])
  const restPose = (zone: DomainZone, id: string, k: number) => {
    const key = `${id}:${k}`
    let p = restPoses.get(key)
    // eslint-disable-next-line react-hooks/immutability
    if (!p) restPoses.set(key, (p = missionRestPose(zone, k, id)))
    return p
  }

  const [prevView, setPrevView] = useState(view)
  // What is new in the log is what has a version after the last one drawn: the log is the platform's, at most the last lines of it
  const [prevV, setPrevV] = useState(() => log.at(-1)?.v ?? 0)
  const [origins, setOrigins] = useState<Map<number, Pose>>(new Map())
  const [transients, setTransients] = useState<Transient[]>([])

  const [cameraPoses] = useState(() => new Map<string | number, Pose>())

  if (prevView !== view) {
    const newOnes = new Map<number, Pose>()
    const added: Transient[] = []
    const latest = log.at(-1)?.v ?? 0
    if (latest >= prevV) {
      const before = arrange(prevView, seats(prevView)).map
      log.filter((line) => line.v > prevV).forEach(({ v, event: e }, n) => {
        if (e.type === "cardPlayed" && e.playerId !== meId) {
          const zone = zones.get(e.playerId)
          if (zone) newOnes.set(e.card.id, seatPose(zone))
        }
        if (e.type === "cardEliminated") {
          const p = before.get(e.card.id)
          if (p) {
            const target = {
              position: p.pose.position.clone().add(new Vector3(0, 6, -2)),
              quaternion: p.pose.quaternion.clone(),
              scale: 0.2,
            }
            added.push({
              id: `x-${v}-${n}`,
              card: p.card,
              origin: p.pose,
              target,
            })
          }
        }
        if (e.type === "draw" && e.playerId !== meId) {
          const zone = zones.get(e.playerId)
          if (zone)
            for (let i = 0; i < e.count; i++)
              added.push({
                id: `p-${v}-${n}-${i}`,
                card: null,
                origin: { ...deckTopPose(prevView.deckCount - i), delay: 0.35 + i * 0.28 },
                target: underTablePose(zone),
              })
        }
      })
      const beforeHand = new Set(prevView.me?.hand.map((c) => c.id))
      let rank = 0
      for (const c of hand)
        if (!beforeHand.has(c.id)) newOnes.set(c.id, { ...deckTopPose(prevView.deckCount - rank), delay: 0.35 + rank++ * 0.28 })
    }
    setPrevV(latest)
    setOrigins(newOnes)
    if (added.length) setTransients((t) => [...t, ...added])
    setPrevView(view)
  }

  const [prevStep, setPrevStep] = useState<OpeningStep>(openingStep)
  const flow = openingStep === "unroll"
  // The piles are put on the mat once it is out, and are there from the start for a table that is opened or reloaded
  const [piled, setPiled] = useState(!flow)
  const [deal, setDeal] = useState<Map<number, Pose>>(new Map())
  const [missionOrigins, setMissionOrigins] = useState<Map<string, Pose>>(new Map())
  const cameraOuverture = useThree((s) => s.camera)
  if (prevStep !== openingStep) {
    setPrevStep(openingStep)
    if (openingStep === "deal") {
      const n = view.players.length
      const total = n * 3
      const dist = new Map<number, Pose>()
      const added: Transient[] = []
      for (let r = 0; r < 3; r++)
        view.players.forEach((j, idx) => {
          const k = r * n + idx
          const origin = { ...deckTopPose(view.deckCount + total - k), delay: 0.1 + k * settings.dealStep }
          if (j.id === meId) {
            const card = hand[r]
            if (card) dist.set(card.id, origin)
          } else {
            const zone = zones.get(j.id)
            if (zone) added.push({ id: `d-${j.id}-${r}`, card: null, origin, target: underTablePose(zone) })
          }
        })
      setDeal(dist)
      if (added.length) setTransients((t) => [...t, ...added])
    }
    if (openingStep === "missions") {
      cameraOuverture.updateMatrixWorld()
      const inverse = cameraOuverture.quaternion.clone().invert()
      setMissionOrigins(
        new Map(
          missions.map((m, i) => {
            const from = missionPilePose(MISSION_PILE.size + i)
            return [
              m.id,
              {
                position: cameraOuverture.worldToLocal(from.position.clone()),
                quaternion: inverse.clone().multiply(from.quaternion),
                scale: from.scale,
                delay: 0.35 + i * 0.3,
              },
            ]
          }),
        ),
      )
    }
  }
  const intro = openingStep === "missions"
  const visibleHand = openingStep !== "unroll"
  const visibleMissions = openingStep === "missions" || openingStep === null

  const { camera } = useThree()
  const missionSettings = useControls(
    "Missions",
    {
      distance: { value: 4.4, min: 2, max: 10, step: 0.05, label: "camera distance" },
      position: { value: { x: 0, y: 0.32 }, step: 0.01, label: "group position" },
      rotation: { value: { x: 0, y: 0, z: 0 }, step: 0.01, label: "group rotation" },
      scaleFactor: { value: 1.4, min: 0.5, max: 2.5, step: 0.01, label: "scale" },
      gap: { value: 0.3, min: -1, max: 3, step: 0.01, label: "gap" },
      angles: { value: { y: 0.06, z: 0.01 }, step: 0.01, label: "card angles" },
      card1: { value: { x: 0, y: 0 }, step: 0.01, label: "card 1 offset" },
      card2: { value: { x: 0, y: 0 }, step: 0.01, label: "card 2 offset" },
      backOffset: { value: 0, min: 0, max: 1, step: 0.01, label: "outer depth" },
      mouse: { value: 0.1, min: 0, max: 1, step: 0.01, label: "mouse tilt" },
      veil: { value: 0.24, min: 0, max: 1, step: 0.01, label: "overlay opacity" },
      focusVeil: { value: 0.24, min: 0, max: 1, step: 0.01, label: "focus overlay opacity" },
      veilFade: { value: 0.8, min: 0.05, max: 2, step: 0.05, label: "overlay fade" },
      ...copyButton("SCENE", "Missions"),
    },
    { collapsed: true, order: 4 },
    debugTab("SCENE"),
  )
  const inGameMissionSettings = useControls(
    "Missions · In Game",
    {
      size: { value: 0.36, min: 0.1, max: 0.8, step: 0.01, label: "size" },
      position: { value: { x: 0, y: 0 }, step: 0.005, label: "position" },
      angles: { value: { card1: 0.08, card2: 0.01 }, step: 0.01, label: "angles" },
      card1: { value: { x: 0.1, y: 0.085 }, step: 0.005, label: "card 1 offset" },
      card2: { value: { x: 0.04, y: -0.07 }, step: 0.005, label: "card 2 offset" },
      hoverLift: { value: 0.02, min: 0, max: 0.5, step: 0.005, label: "hover lift" },
      hoverScale: { value: 1.01, min: 0.8, max: 1.5, step: 0.01, label: "hover scale" },
      hoverDuration: { value: 0.05, min: 0.01, max: 0.5, step: 0.01, label: "hover anim (s)" },
      returnDuration: { value: 0.12, min: 0.01, max: 0.8, step: 0.01, label: "return anim (s)" },
      defocusDuration: { value: 0.4, min: 0.01, max: 1.5, step: 0.01, label: "unfocus anim (s)" },
      focusReflection: { value: 0.06, min: 0, max: 1, step: 0.01, label: "focus reflection" },
      focusDistance: { value: 3.6, min: 2, max: 10, step: 0.05, label: "focus distance" },
      focusScale: { value: 1.4, min: 0.5, max: 3, step: 0.01, label: "focus scale" },
      focusMouse: { value: 0.16, min: 0, max: 1.5, step: 0.01, label: "focus mouse tilt" },
      ...copyButton("SCENE", "Missions · In Game"),
    },
    { collapsed: true, order: 5 },
    debugTab("SCENE"),
  )
  const [hover, setHover] = useState<string | number | null>(null)
  const [prevFocus, setPrevFocus] = useState(missionFocus)
  const [focusReturn, setFocusReturn] = useState<string | null>(null)
  if (prevFocus !== missionFocus) {
    setPrevFocus(missionFocus)
    if (prevFocus && !missionFocus) setFocusReturn(prevFocus)
  }
  if (focusReturn && hover === `mission:${focusReturn}`) setFocusReturn(null)
  const [hoverPlayer, setHoverPlayer] = useState<string | null>(null)
  const cameraPose = (id: string | number) => {
    let p = cameraPoses.get(id)
    if (!p) {
      p = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 }
      cameraPoses.set(id, p)
    }
    return p
  }

  const selectionId = it.selection?.id
  // The cards of the viewer's hand can be chosen on their turn; the one under the pointer is brought forward, and so is the one that is picked
  const playable = it.myTurn && !it.assassination && !it.sending
  const [hoveredCard, setHovered] = useState<number | null>(null)
  const raised = hand.findIndex((card) => card.id === (selectionId ?? hoveredCard))
  const nameOf = (card: { family: Family | null; role: Role | null }) =>
    [card.role ? catalog.roles[card.role].name : catalog.words.courtier, card.family ? catalog.families[card.family].name : null].filter(Boolean).join(" · ")
  useFrame(({ pointer }) => {
    const proj = camera.projectionMatrix.elements
    const h = HAND_DISTANCE / proj[5]
    const w = HAND_DISTANCE / proj[0]
    const rj = inGameMissionSettings
    const mW = Math.min(w * rj.size, h * 0.8)
    const mH = (mW * MISSION_H) / MISSION_W
    missions.forEach((m, i) => {
      const p = cameraPose(`mission:${m.id}`)
      if (intro) {
        const r = missionSettings
        const k = (r.distance / 8) * (1 / (proj[5] * Math.tan((19 * Math.PI) / 180)))
        const dir = i === 0 ? 1 : -1
        const group = QUAT_GROUP.setFromEuler(EULER_TMP.set(r.rotation.x - pointer.y * r.mouse, r.rotation.y + pointer.x * r.mouse, r.rotation.z))
        const x = (i - 0.5) * (MISSION_W + r.gap) * k * r.scaleFactor
        const offset = i === 0 ? r.card1 : r.card2
        const dx = offset.x * k
        const dy = offset.y * k
        p.position.set(r.position.x * k, r.position.y * k, -r.distance).add(new Vector3(x + dx, dy, -Math.abs(x) * r.backOffset).applyQuaternion(group))
        p.quaternion.copy(group).multiply(QUAT_LOCAL.setFromEuler(EULER_TMP.set(0, dir * r.angles.y, -dir * r.angles.z)))
        p.scale = k * r.scaleFactor
      } else if (missionFocus === m.id) {
        const d = rj.focusDistance
        const k = (d / 8) * (1 / (proj[5] * Math.tan((19 * Math.PI) / 180)))
        p.position.set(0, -0.04 * k, -d)
        p.quaternion.setFromEuler(EULER_TMP.set(-pointer.y * rj.focusMouse, pointer.x * rj.focusMouse * 1.3, 0))
        p.scale = rj.focusScale * k
      } else if (myZone) {
        // placed face down on the table, right of the board; converted into the camera's frame (the cards follow the camera)
        const hovered = hover === `mission:${m.id}`
        const rest = missionRestPose(myZone, i, m.id)
        camera.updateMatrixWorld()
        if (hovered) rest.position.y += 0.18
        p.position.copy(camera.worldToLocal(rest.position))
        p.quaternion.copy(camera.quaternion).invert().multiply(rest.quaternion)
        p.scale = rest.scale * (hovered ? 1.08 : 1)
      } else {
        const hovered = hover === `mission:${m.id}`
        const jaw = i === 0 ? rj.angles.card1 : rj.angles.card2
        const arm = -mW * 0.44
        const pivotX = w - mW * 0.03 + rj.position.x * w
        const pivotY = -h + mH * 0.55 + rj.position.y * h
        const x = pivotX + Math.cos(jaw) * arm
        const y = pivotY - Math.sin(jaw) * arm + (i === 0 ? mH * 0.16 : -mH * 0.08) + (hovered ? mH * rj.hoverLift : 0)
        p.position.set(
          x + (i === 0 ? rj.card1 : rj.card2).x * mW,
          y + (i === 0 ? rj.card1 : rj.card2).y * mW,
          -HAND_DISTANCE + 0.05 + (i === 0 ? 0 : 0.02),
        )
        p.quaternion.setFromEuler(EULER_TMP.set(0, 0, -jaw))
        p.scale = (mW / MISSION_W) * (hovered ? rj.hoverScale : 1)
      }
    })
  })

  const crownPlayer =
    openingStep === "unroll" || openingStep === "deal"
      ? null
      : view.phase === "playing"
        ? view.activePlayerId
        : view.phase === "missions"
          ? (view.firstPlayerId ?? null)
          : null
  const results = view.results
  const winnerCenters = useWinnerCenters(results?.winners ?? EMPTY, zones)

  const subtle = intro || !!missionFocus
  const targetColumn = it.selection && it.canPlay("table") ? (it.selection.role === "spy" ? "queen" : it.selection.family) : null
  const candidates = new Set(it.assassination?.candidates ?? [])
  const targetDomain = (playerId: string) => !!it.selection && !it.assassination && it.canPlay(playerId === meId ? "domain" : "opponentDomain")
  const playDomain = (playerId: string) => it.play({ zone: "domain", playerId })

  return (
    <>
      <EndingSettings />
      <ZoneSettings />
      <MatLines results={results ?? null} ending={ending} />
      <EmptyClick onClick={onEmpty} />
      <Playmat
        size={{ width: MAT_W, depth: MAT_D, radius: 0.07 }}
        picture={tex.mat}
        cloth={{ picture: tex.cloth, blend: "soft-light", strength: 0.8, tile: 2 }}
        desaturate={0.06}
        thickness={0.018}
        unroll={flow ? (held ? "rolled" : "unrolling") : "flat"}
        duration={settings.matDuration}
        roller={theme.surface}
        onUnrolled={() => setPiled(true)}
      />

      {[...board.values()].map(({ card, pose, playerId }) => {
        const candidate = candidates.has(card.id)
        const domainTarget = !!playerId && targetDomain(playerId)
        const press = candidate ? () => it.eliminate(card.id) : domainTarget ? () => playDomain(playerId) : undefined
        return (
          <Card
            key={card.id}
            id={card.id}
            target={pose}
            from={origins.get(card.id)}
            front={tex.face(card)}
            back={tex.back}
            size={CARD_SIZE}
            state={press ? "interactive" : "base"}
            onPress={press}
            ariaLabel={candidate ? `${catalog.words.youEliminate} ${nameOf(card)}` : domainTarget ? `${catalog.words.youPlay} ${playerId === meId ? catalog.words.zoneYours : nickname(playerId)}` : undefined}
            onHover={
              playerId
                ? (over) => {
                    if (it.assassination) hoverGroup(`${playerId}:${groupKey(card)}`, over)
                    if (domainTarget) setHoverPlayer(over ? playerId : null)
                  }
                : undefined
            }
          />
        )
      })}

      {visibleHand && meId && (
        <ScreenHand settings={HAND_SETTINGS}>
          {(screen) => (
            <Zone
              layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND_SETTINGS, raised)}
              size={CARD_SIZE}
              cards={hand.map((card): ZoneCard => {
                const from = origins.get(card.id) ?? deal.get(card.id)
                return {
                  key: card.id,
                  id: card.id,
                  front: tex.face(card),
                  back: tex.back,
                  from: from ? screen.local(from) : undefined,
                  speed: 0.12,
                  state: card.id === selectionId ? "selected" : playable ? "interactive" : "base",
                  ariaLabel: playable ? `${catalog.words.youPlay} ${nameOf(card)}` : undefined,
                  onHover: (over) => setHovered((v) => (over ? card.id : v === card.id ? null : v)),
                  onPress: playable ? () => it.select(card.id === selectionId ? null : card) : undefined,
                }
              })}
            />
          )}
        </ScreenHand>
      )}

      <FollowCamera>
        {visibleMissions &&
          !ending &&
          missions.map((m: Mission) => (
            <Card
              key={m.id}
              id={`mission:${m.id}`}
              target={cameraPose(`mission:${m.id}`)}
              from={missionOrigins.get(m.id)}
              front={tex.mission(m)}
              back={tex.missionBack(m)}
              size={MISSION_SIZE}
              above
              shadow={false}
              speed={
                hover === `mission:${m.id}` && !missionFocus
                  ? inGameMissionSettings.hoverDuration
                  : intro || missionFocus
                    ? 0.24
                    : focusReturn === m.id
                      ? inGameMissionSettings.defocusDuration
                      : inGameMissionSettings.returnDuration
              }
              gloss={missionFocus === m.id}
              state={intro ? "base" : "interactive"}
              ariaLabel={catalog.missionTexts[m.id]}
              onHover={(over) => setHover(over ? `mission:${m.id}` : null)}
              onPress={() => onMission(m.id)}
            />
          ))}
      </FollowCamera>
      {visibleMissions &&
        !intro &&
        !ending &&
        missions.length > 0 &&
        view.players.map((j) => {
          const zone = zones.get(j.id)
          if (!zone || j.id === meId) return null
          const order = view.players.findIndex((x) => x.id === j.id)
          return [0, 1].map((k) => {
            const back = tex.missionBack(missions[k % missions.length]!)
            const origin = openingStep === "missions" ? { ...missionPilePose(MISSION_PILE.size + 2 + k), delay: 0.9 + (order * 2 + k) * 0.25 } : undefined
            return <Card key={`mission-dos-${j.id}-${k}`} id={`mission-dos-${j.id}-${k}`} target={restPose(zone, j.id, k)} from={origin} front={back} back={back} size={MISSION_SIZE} shadow={false} />
          })
        })}
      {results && ending && (
        <>
          <FamilyResolution results={results} ending={ending} />
          <Counters view={view} results={results} ending={ending} zones={zones} />
          <PilePoints view={view} results={results} ending={ending} zones={zones} />
          {ending.spotlight &&
            winnerCenters.winnerZones.map((z, i) => (
              <Aura
                key={i}
                width={z.width}
                depth={z.depth}
                position={[z.center.x, 0.016, z.center.z]}
                yaw={z.yaw}
                strength={() => ENDING_SETTINGS.winnerStrength}
                settings={WINNER_AURA_SETTINGS}
              />
            ))}
          {view.players.map((j) => {
            const zone = zones.get(j.id)
            const list = j.id === meId ? missions : j.missions?.map(missionOf)
            if (!zone || !list) return null
            const r = results.players.find((x) => x.playerId === j.id)
            return list.map((m, k) => {
              const target = missionRestPose(zone, k, m.id, ending.missions)
              const result = r?.missions.find((x) => x.missionId === m.id)
              return (
                <group key={m.id}>
                  <Card id={`end-${m.id}`} target={target} front={tex.mission(m)} back={tex.missionBack(m)} size={MISSION_SIZE} speed={0.22} />
                  {ending.missions && result && <MissionSign done={result.done} points={result.points} position={[target.position.x, 0.12, target.position.z]} />}
                </group>
              )
            })
          })}
        </>
      )}
      <Veil active={subtle} opacity={missionFocus ? missionSettings.focusVeil : missionSettings.veil} fade={missionSettings.veilFade} />

      {transients.map((t) => (
        <Ephemeral key={t.id} item={t} tex={tex} onEnd={() => setTransients((l) => l.filter((x) => x.id !== t.id))} />
      ))}

      {/* The two piles: the missions that are dealt, left of the mat, and the draw pile at its right. They come in from above when the mat is out, and are simply there when a table is opened or reloaded */}
      {piled && missions.length > 0 && (
        <Pile
          frame={{ x: MISSION_PILE.x, z: MISSION_PILE.z }}
          count={MISSION_PILE.size}
          size={MISSION_SIZE}
          back={tex.missionBack(missions[0]!)}
          scale={MISSION_PILE.scale}
          step={MISSION_PILE.spacing}
          label={false}
          enter={flow ? PILE_ENTRY(MISSION_PILE.x, MISSION_PILE.z) : undefined}
          stagger={0.05}
        />
      )}
      {piled && (
        <Pile
          frame={{ x: DRAW_PILE.x, z: DRAW_PILE.z }}
          count={view.deckCount}
          size={CARD_SIZE}
          back={tex.back}
          limit={60}
          step={LAYOUT_SETTINGS.deckSpacing}
          lean="pioche"
          leanAmplitude={0.04}
          enter={flow ? PILE_ENTRY(DRAW_PILE.x, DRAW_PILE.z) : undefined}
          stagger={0.015}
        />
      )}

      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return <DomainBackground key={`fond-${j.id}`} zone={zone} playable={targetDomain(j.id)} hover={hoverPlayer === j.id} color={color(j.id)} />
      })}

      {/* every player's nickname (one's own included), shown from the start; its color does not change on their turn: only the crown shows it */}
      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone) return null
        return (
          <Badge
            key={j.id}
            zone={zone}
            text={nickname(j.id).toUpperCase()}
            style={
              hoverPlayer === j.id && targetDomain(j.id)
                ? { color: "#fff4dc", relief: color(j.id), aura: color(j.id), spacing: SPACING }
                : { color: color(j.id), spacing: SPACING }
            }
            onClick={targetDomain(j.id) ? () => playDomain(j.id) : undefined}
            onHover={targetDomain(j.id) ? (s) => setHoverPlayer(s ? j.id : null) : undefined}
          >
            <SeatAvatarMesh
              nickname={nickname(j.id)}
              color={color(j.id)}
              imageUrl={avatarUrl(j.id)}
              theme={seat}
              size={ZONE_SETTINGS.avatarSize}
              position={[-(ZONE_SETTINGS.avatarGap + ZONE_SETTINGS.avatarSize / 2), 0, 0]}
            />
            <CrownMark show={crownPlayer === j.id} offset={[-(ZONE_SETTINGS.avatarGap + ZONE_SETTINGS.avatarSize + 0.8), 0]} icon={hostIcon} />
          </Badge>
        )
      })}

      {targetColumn &&
        (["up", "down"] as const).map((level) => (
          <Target key={level} column={targetColumn} level={level} onClick={() => it.play({ zone: "table", level })} />
        ))}

      {view.players.map((j) => {
        const zone = zones.get(j.id)
        if (!zone || !targetDomain(j.id)) return null
        return <ClickableZone key={j.id} zone={zone} onClick={() => playDomain(j.id)} onHover={(s) => setHoverPlayer(s ? j.id : null)} />
      })}
    </>
  )
}

/** A colour between two others, as a hex string: the lines of the lattice of the table lie close to its colour, tinted with the accent. */
const mixed = (from: string, to: string, share: number) => `#${new Color(from).lerp(new Color(to), share).getHexString()}`

export default function Scene3D(props: {
  openingStep: OpeningStep
  missionFocus: string | null
  onMission: (id: string) => void
  onEmpty: () => void
  onReady: () => void
  /** The start screen is up: the opening (camera entrance, mat, deal) waits for it to go */
  held: boolean
  /** Called once when the pictures are in */
  onLoaded: () => void
  /** How far the scene is loaded, 0 to 1 */
  onProgress: (progress: number) => void
  ending: EndingState | null
  settings: OpeningSettings
}) {
  const { theme } = useSiteSettings()
  // The endless table: the colour of the edge of the table, a lattice a hair off it, and a pool of light at the middle that falls away to it
  const surface = useMemo<SurfaceProps>(
    () => ({
      color: theme.surfaceDark,
      layers: [{ kind: "lattice", line: mixed(theme.surfaceDark, theme.accent, 0.12), diamonds: 3, width: 1 }],
      resolution: 512,
      tile: 8,
      light: { center: theme.surface, radius: 22 },
    }),
    [theme],
  )
  return (
    <Table camera={CAMERA} intro={INTRO} playIntro={props.openingStep === "unroll"} photo={PHOTO} surface={surface} lights held={props.held}>
      <World
        openingStep={props.openingStep}
        missionFocus={props.missionFocus}
        onMission={props.onMission}
        onEmpty={props.onEmpty}
        onReady={props.onReady}
        held={props.held}
        onLoaded={props.onLoaded}
        onProgress={props.onProgress}
        ending={props.ending}
        settings={props.settings}
      />
    </Table>
  )
}
