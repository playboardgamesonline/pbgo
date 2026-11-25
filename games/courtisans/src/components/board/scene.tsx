"use client"

import { type Family, type Mission, type PlayerView, type Role, type VisibleCard, missionOf } from "@courtisans/engine"
import { useEffect, useMemo, useRef, useState } from "react"
import { Color, Euler, Quaternion, Vector3 } from "three"
import { useCourtisans } from "../game/context"
import { useInteraction } from "../game/interaction"
import type { EndingState } from "./ending"
import { LETTERING_FONT } from "./font"
import { Counters, MissionSign, PilePoints, ENDING_SETTINGS, EndingSettings, FamilyResolution, useWinnerCenters, WINNER_AURA } from "./ending3d"
import { Lane, LaneSettings, MatLines } from "./lanes"
import { copyButton, debugTab, useControls } from "@pbgo/core/components/game/debug-controls"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { Aura, Card, type CardState, effectiveState, FACE_DOWN, FloorButton, HELD_FAN_FIELDS, HELD_FAN_SETTINGS, HeldHand, Hotspot, lean, LightPool, NO_TOUCH, onTable, Pile, type Pose, Playmat, PlayerSeat, SCREEN_HAND_FIELDS, ScreenHand, type ScreenHandView, type ScreenPointer, screenHandLayout, type SurfaceProps, Table, type Touch, useSettings, useSettingsVersion, Veil, Zone, type ZoneCard } from "@pbgo/table"
import {
  CARD_SCALE,
  CARD_SIZE,
  DH,
  DL,
  MISSION_H,
  MISSION_SCALE,
  MISSION_SIZE,
  MISSION_W,
  DRAW_PILE,
  MISSION_PILE,
  missionPilePose,
  HAND_SETTINGS,
  LAYOUT_SETTINGS,
  MAT_W,
  MAT_D,
  type DomainZone,
  columnOf,
  groupKey,
  arrangeDomain,
  deckTopPose,
  heldFrame,
  heldFrom,
  heldLayout,
  HELD_SHADOW,
  seatHotspot,
  tablePose,
  type Seat,
  seatBox,
  seats,
  missionRestPose,
  BUTTON_PAD,
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

type Transient = {
  id: string
  card: VisibleCard | null
  origin: Pose
  target: Pose
}

const EMPTY: string[] = []

/** Where the cards of a pile come in from, above it, when the pile is put on the mat: they are the size they land at */
const PILE_ENTRY = (x: number, z: number, scale: number) => onTable(x, z, { y: 3, face: "down", scale })

/** The knobs of the small fans of the others' hands but their card size: every card of the table is `CARD_SCALE`, the one number of the layout (`HELD_SETTINGS` of `layout.ts`) */
const HELD_HAND_FIELDS = Object.fromEntries(Object.entries(HELD_FAN_FIELDS).filter(([key]) => key !== "scale"))

function LayoutSettings() {
  // The viewer's hand is held at the bottom left of the screen: the Hand folder tunes it, as the Held hands folder tunes the small fans of the others
  useSettings("Hand", HAND_SETTINGS, SCREEN_HAND_FIELDS, { order: 2 })
  useSettings("Held hands", HELD_FAN_SETTINGS, HELD_HAND_FIELDS, { order: 3 })
  return <LaneSettings />
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

const HAND_DISTANCE = 6
const QUAT_GROUP = new Quaternion()
const QUAT_LOCAL = new Quaternion()
const EULER_TMP = new Euler()

export type OpeningStep = "unroll" | "deal" | "missions" | null
export type OpeningSettings = { matDuration: number; dealStep: number }

function World({
  openingStep,
  missionFocus,
  onMission,
  onReady,
  held,
  onLoaded,
  onProgress,
  ending,
  onSkip,
  settings,
}: {
  openingStep: OpeningStep
  missionFocus: string | null
  onMission: (id: string) => void
  onReady: () => void
  held: boolean
  onLoaded: () => void
  onProgress: (progress: number) => void
  ending: EndingState | null
  onSkip: () => void
  settings: OpeningSettings
}) {
  useEffect(() => onReady(), [onReady])
  const { theme } = useSiteSettings()
  const { view, catalog, log, nickname } = useCourtisans()
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
      // How many cards each opponent held before the move that is being drawn: the card they play leaves from the left end of that hand
      const held = new Map(prevView.players.map((j) => [j.id, j.handCount]))
      log.filter((line) => line.v > prevV).forEach(({ v, event: e }, n) => {
        if (e.type === "cardPlayed" && e.playerId !== meId) {
          const seat = places.get(e.playerId)
          const count = held.get(e.playerId) ?? 0
          held.set(e.playerId, Math.max(0, count - 1))
          if (seat) newOnes.set(e.card.id, heldFrom(seat, count))
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
  // The piles are put on the mat once it is out, and are there from the start for a table that is opened or reloaded. A slow machine can still be rolling the mat out when the opening moves on (the opening is a timer, the mat a clock of its own): the
  // piles are then put on it as the opening moves on, never left off
  const [rolledOut, setRolledOut] = useState(!flow)
  const piled = rolledOut || openingStep !== "unroll"
  const [deal, setDeal] = useState<Map<number, Pose>>(new Map())
  const [missionOrigins, setMissionOrigins] = useState<Map<string, Pose>>(new Map())
  if (prevStep !== openingStep) {
    setPrevStep(openingStep)
    if (openingStep === "deal") {
      const n = view.players.length
      const total = n * 3
      const dist = new Map<number, Pose>()
      for (let r = 0; r < 3; r++)
        view.players.forEach((j, idx) => {
          const k = r * n + idx
          const card = j.id === meId ? hand[r] : undefined
          if (card) dist.set(card.id, { ...deckTopPose(view.deckCount + total - k), delay: 0.1 + k * settings.dealStep })
        })
      setDeal(dist)
    }
    if (openingStep === "missions") {
      // Where each mission starts, on the table, and how long it waits: the screen frame puts it in the frame of the camera when the card is drawn
      setMissionOrigins(new Map(missions.map((m, i) => [m.id, { ...missionPilePose(MISSION_PILE.size + i), delay: 0.35 + i * 0.3 }])))
    }
  }
  const intro = openingStep === "missions"
  const visibleHand = openingStep !== "unroll"
  const visibleMissions = openingStep === "missions" || openingStep === null

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
  // What the visitor does to the area of each domain that can be chosen: the cards under it are lit from it
  const [touches, setTouches] = useState<Record<string, Touch>>({})
  const touchOf = (playerId: string, touch: Touch) =>
    setTouches((all) => {
      const was = all[playerId] ?? NO_TOUCH
      return was.hovered === touch.hovered && was.focused === touch.focused && was.pressed === touch.pressed ? all : { ...all, [playerId]: touch }
    })
  const cameraPose = (id: string | number) => {
    let p = cameraPoses.get(id)
    if (!p) {
      p = { position: new Vector3(), quaternion: new Quaternion(), scale: 1 }
      cameraPoses.set(id, p)
    }
    return p
  }

  const fromMissionOrigin = (screen: ScreenHandView, id: string) => {
    const origin = missionOrigins.get(id)
    return origin ? screen.local(origin) : undefined
  }

  const selectionId = it.selection?.id
  // The cards of the viewer's hand can be chosen on their turn; the one under the pointer is brought forward, and so is the one that is picked
  const playable = it.myTurn && !it.assassination && !it.sending
  const [hoveredCard, setHovered] = useState<number | null>(null)
  const raised = hand.findIndex((card) => card.id === (selectionId ?? hoveredCard))
  const nameOf = (card: { family: Family | null; role: Role | null }) =>
    [card.role ? catalog.roles[card.role].name : catalog.words.courtier, card.family ? catalog.families[card.family].name : null].filter(Boolean).join(" · ")
  // The missions are held in front of the camera, in the frame that follows it: where each one lies depends on the camera and on the pointer, so it is worked out on every frame, in the poses the cards read
  const holdMissions = (screen: ScreenHandView, pointer: ScreenPointer) => {
    // the half height and the half width of the picture, one unit in front of the camera, and `HAND_DISTANCE` in front of it
    const unitH = screen.halfHeight / screen.distance
    const unitW = screen.halfWidth / screen.distance
    const h = HAND_DISTANCE * unitH
    const w = HAND_DISTANCE * unitW
    const rj = inGameMissionSettings
    const mW = Math.min(w * rj.size, h * 0.8)
    const mH = (mW * MISSION_H) / MISSION_W
    missions.forEach((m, i) => {
      const p = cameraPose(`mission:${m.id}`)
      if (intro) {
        const r = missionSettings
        const k = (r.distance / 8) * (unitH / Math.tan((19 * Math.PI) / 180))
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
        const k = (d / 8) * (unitH / Math.tan((19 * Math.PI) / 180))
        p.position.set(0, -0.04 * k, -d)
        p.quaternion.setFromEuler(EULER_TMP.set(-pointer.y * rj.focusMouse, pointer.x * rj.focusMouse * 1.3, 0))
        p.scale = rj.focusScale * k
      } else if (myZone) {
        // placed face down on the table, right of the board; converted into the camera's frame (the cards follow the camera)
        const hovered = hover === `mission:${m.id}`
        const rest = missionRestPose(myZone, i, m.id)
        if (hovered) rest.position.y += 0.18
        const placed = screen.local(rest)
        p.position.copy(placed.position)
        p.quaternion.copy(placed.quaternion)
        p.scale = placed.scale * (hovered ? 1.08 : 1)
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
  }

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
      <LayoutSettings />
      <MatLines results={results ?? null} ending={ending} />
      <Playmat
        size={{ width: MAT_W, depth: MAT_D, radius: 0.07 }}
        picture={tex.mat}
        cloth={{ picture: tex.cloth, blend: "soft-light", strength: 0.8, tile: 2 }}
        desaturate={0.06}
        thickness={0.018}
        unroll={flow ? (held ? "rolled" : "unrolling") : "flat"}
        duration={settings.matDuration}
        roller={theme.surface}
        onUnrolled={() => setRolledOut(true)}
      />

      {[...board.values()].map(({ card, pose, playerId }) => {
        const candidate = candidates.has(card.id)
        // A domain that can be chosen is lit, and brighter under the pointer: the area over it takes the pointer, and says what is done to it
        const state: CardState = candidate ? "interactive" : playerId && targetDomain(playerId) ? effectiveState("interactive", touches[playerId] ?? NO_TOUCH) : "base"
        return (
          <Card
            key={card.id}
            id={card.id}
            target={pose}
            from={origins.get(card.id)}
            front={tex.face(card)}
            back={tex.back}
            size={CARD_SIZE}
            state={state}
            onPress={candidate ? () => it.eliminate(card.id) : undefined}
            ariaLabel={candidate ? `${catalog.words.youEliminate} ${nameOf(card)}` : undefined}
            onHover={playerId && it.assassination ? (over) => hoverGroup(`${playerId}:${groupKey(card)}`, over) : undefined}
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

      {/* The missions a player reads are held up in front of the camera, in a frame that follows it */}
      <ScreenHand settings={HAND_SETTINGS} onFrame={holdMissions}>
        {(screen) =>
          visibleMissions &&
          !ending &&
          missions.map((m: Mission) => (
            <Card
              key={m.id}
              id={`mission:${m.id}`}
              target={cameraPose(`mission:${m.id}`)}
              from={fromMissionOrigin(screen, m.id)}
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
          ))
        }
      </ScreenHand>
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
              <Aura key={i} size={{ width: z.width, depth: z.depth }} frame={{ x: z.center.x, z: z.center.z, yaw: z.yaw }} y={0.016} strength={ENDING_SETTINGS.winnerStrength} look={WINNER_AURA} />
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
      <Veil active={subtle} opacity={missionFocus ? missionSettings.focusVeil : missionSettings.veil} fade={missionSettings.veilFade} color="#020b0d" />

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
          scale={MISSION_SCALE}
          step={MISSION_PILE.spacing}
          label={false}
          enter={flow ? PILE_ENTRY(MISSION_PILE.x, MISSION_PILE.z, MISSION_SCALE) : undefined}
          stagger={0.05}
        />
      )}
      {piled && (
        <Pile
          frame={{ x: DRAW_PILE.x, z: DRAW_PILE.z }}
          count={view.deckCount}
          size={CARD_SIZE}
          back={tex.back}
          scale={CARD_SCALE}
          limit={60}
          step={LAYOUT_SETTINGS.deckSpacing}
          lean="pioche"
          leanAmplitude={0.04}
          enter={flow ? PILE_ENTRY(DRAW_PILE.x, DRAW_PILE.z, CARD_SCALE) : undefined}
          stagger={0.015}
        />
      )}

      {/* Every player is a line along the axis of their seat, turned as their name is, from the middle of the table outward: the plate (the name), the domain and the hand. The hands of the others are a small fan of backs, a card played leaves from its left end and a card drawn comes in at its right end; the viewer's is held on the screen */}
      {view.players.map((j, order) => {
        const seat = places.get(j.id)
        if (!seat) return null
        return (
          <group key={j.id}>
            <PlayerSeat id={j.id} frame={seat.frame} above={seatBox(seat)} font={LETTERING_FONT} />
            {!seat.viewer && (
              <HeldHand
                count={openingStep === "unroll" ? 0 : j.handCount}
                frame={heldFrame(seat)}
                layout={(n) => heldLayout(n, seat)}
                size={CARD_SIZE}
                back={tex.back}
                enter={openingStep === "deal" ? { ...deckTopPose(view.deckCount + 3), delay: 0.1 + order * settings.dealStep } : deckTopPose(view.deckCount + 1)}
                shadow={HELD_SHADOW}
              />
            )}
          </group>
        )
      })}

      {/* The lanes the picked card can be played along on the Queen's table: the light above the mat, the disgrace below it, pressed where the cards lie */}
      {targetColumn &&
        (["up", "down"] as const).map((level) => (
          <Lane
            key={level}
            column={targetColumn}
            light={level === "up"}
            ariaLabel={[catalog.words.youPlay, catalog.words.zoneTable, catalog.statusWords[level === "up" ? "light" : "disgrace"][0]].filter(Boolean).join(" ")}
            onPress={() => it.play({ zone: "table", level })}
          />
        ))}

      {/* An assassin that was played may eliminate a card, or nobody: a button, since nobody is no object on the table. The end of the game can be skipped, by the same one: they never meet */}
      {it.assassination && (
        <FloorButton at={BUTTON_PAD.at} width={BUTTON_PAD.width} depth={BUTTON_PAD.depth} label={catalog.words.noAssassination} tone="neutral" disabled={it.sending} onPress={() => it.eliminate(null)} />
      )}
      {ending && !ending.scoreboard && <FloorButton at={BUTTON_PAD.at} width={BUTTON_PAD.width} depth={BUTTON_PAD.depth} label={catalog.words.skip} tone="neutral" onPress={onSkip} />}

      {/* A domain is chosen by pressing it, its cards and the plate over it: an invisible area, and the cards are lit by their states, or a pool of light where there are none */}
      {view.players.map((j) => {
        const seat = places.get(j.id)
        const zone = zones.get(j.id)
        if (!seat || !zone || !targetDomain(j.id)) return null
        const area = seatHotspot(seat, zone.width)
        return (
          <group key={j.id}>
            {j.domain.length === 0 && (
              <LightPool size={{ width: DL, height: DH }} state={effectiveState("interactive", touches[j.id] ?? NO_TOUCH)} position={[zone.center.x, 0.012, zone.center.z]} yaw={zone.yaw} />
            )}
            <Hotspot
              {...area}
              ariaLabel={`${catalog.words.youPlay} ${j.id === meId ? catalog.words.zoneYours : nickname(j.id)}`}
              onPress={() => playDomain(j.id)}
              onTouch={(touch) => touchOf(j.id, touch)}
            />
          </group>
        )
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
  /** Skips the end of the game: the sequence jumps to its last step */
  onSkip: () => void
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
    <Table camera={CAMERA} intro={INTRO} playIntro={props.openingStep === "unroll"} photo={PHOTO} surface={surface} lights held={props.held} onEmptyPress={props.onEmpty}>
      <World
        openingStep={props.openingStep}
        missionFocus={props.missionFocus}
        onMission={props.onMission}
        onReady={props.onReady}
        held={props.held}
        onLoaded={props.onLoaded}
        onProgress={props.onProgress}
        ending={props.ending}
        onSkip={props.onSkip}
        settings={props.settings}
      />
    </Table>
  )
}
