import type { VisibleCard, Family, Level, PlayerView } from "@courtisans/engine"
import { Euler, Quaternion, Vector3 } from "three"
import { DEFAULT_FAMILIES, MAT_ORDER } from "@/lib/catalog"

export const MAT_W = 12
export const MAT_D = MAT_W / (2362 / 579)
const MARGIN = 0.033 * MAT_W
export const STEP = (MAT_W - 2 * MARGIN) / 7
export const CARD_W = STEP * 0.92
export const CARD_H = (CARD_W * 890) / 472
export const MISSION_W = 2.4
export const MISSION_H = (MISSION_W * 452) / 688
export const DOMAIN_SCALE = 1.1
export const OFFSET = 0.42
export const LAYOUT_SETTINGS = { randomRotation: 0.017, pileSpacing: 0.02, deckSpacing: 0.017 }

export const FACE_UP = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0))
export const FACE_DOWN = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))

export type Pose = {
  position: Vector3
  quaternion: Quaternion
  scaleFactor: number
  delay?: number
}

const pose = (x: number, y: number, z: number, q: Quaternion, scaleFactor = 1): Pose => ({
  position: new Vector3(x, y, z),
  quaternion: q.clone(),
  scaleFactor,
})

export type Column = Family | "queen"

export function hashRandom(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967295) * 2 - 1
}

export const lean = (key: string, amplitude = LAYOUT_SETTINGS.randomRotation) =>
  new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), hashRandom(key) * amplitude)

export const columnX = (column: Column) => -MAT_W / 2 + MARGIN + STEP * (MAT_ORDER.indexOf(column) + 0.5)

export function tablePose(column: Column, level: Level, rank: number, id?: string): Pose {
  const edge = MAT_D / 2 + CARD_H / 2 + rank * OFFSET
  return pose(
    columnX(column),
    0.03 + rank * LAYOUT_SETTINGS.pileSpacing,
    level === "up" ? -edge : edge,
    id ? lean(id).multiply(FACE_UP) : FACE_UP,
  )
}

export const columnOf = (card: VisibleCard): Column => card.family ?? "queen"

/** Missions posées face cachée sur la table, à droite de chaque plateau, le long du bord côté table. */
export const MISSION_REST = { scale: 0.62, gap: 0.35, spacing: 0.14 }
export function missionRestPose(zone: { center: Vector3; width: number; labelPos: Vector3; labelYaw: number }, index: number, key: string): Pose {
  const w = MISSION_W * MISSION_REST.scale
  const h = MISSION_H * MISSION_REST.scale
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), zone.labelYaw)
  const local = new Vector3(zone.width / 2 + MISSION_REST.gap + w / 2, 0.05 + index * 0.02, 0.25 + h / 2 + index * (h + MISSION_REST.spacing)).applyQuaternion(yaw)
  return {
    position: zone.labelPos.clone().add(local).setY(0.05 + index * 0.02),
    quaternion: yaw.multiply(lean(`${key}:${index}`, 0.06)).multiply(FACE_DOWN),
    scaleFactor: MISSION_REST.scale,
  }
}

export const DRAW_PILE = new Vector3(MAT_W / 2 + 1.2, 0, 0)
export const deckTopPose = (n: number) =>
  pose(DRAW_PILE.x, 0.03 + Math.min(n, 60) * LAYOUT_SETTINGS.deckSpacing, DRAW_PILE.z, lean(`pioche${n}`, 0.04).multiply(FACE_DOWN))

/** Pile des missions, face cachée, à gauche du plateau (symétrique de la pioche) ; les missions en sont distribuées après les cartes de la pioche. */
export const MISSION_PILE = { x: -(MAT_W / 2 + 1.2), z: 0, size: 8, scale: 0.85, spacing: 0.022 }
export const missionPilePose = (n: number, scaleFactor = MISSION_PILE.scale): Pose =>
  pose(MISSION_PILE.x, 0.03 + n * MISSION_PILE.spacing, MISSION_PILE.z, lean(`mission-pile${n}`, 0.05).multiply(FACE_DOWN), scaleFactor)

export type Orientation = "down" | "up" | "left" | "right"
export type Seat = { position: Vector3; orientation: Orientation; maxWidth: number }

const H = -10.6
const SIDE = 13.2
const SEATS: Record<number, [number, number, Orientation, number][]> = {
  1: [[0, H, "up", 12]],
  2: [
    [-SIDE, -2.2, "left", 10],
    [SIDE, -2.2, "right", 10],
  ],
  3: [
    [-SIDE, -2.2, "left", 10],
    [0, H, "up", 12],
    [SIDE, -2.2, "right", 10],
  ],
  4: [
    [-SIDE, -2.2, "left", 10],
    [-6, H, "up", 9.5],
    [6, H, "up", 9.5],
    [SIDE, -2.2, "right", 10],
  ],
}

export const MY_SEAT: Seat = { position: new Vector3(0, 0, 5.4), orientation: "down", maxWidth: 11 }

export function seats(view: PlayerView): Map<string, Seat> {
  const meId = view.me?.id
  const i = view.players.findIndex((j) => j.id === meId)
  const opponents = [...view.players.slice(i + 1), ...view.players.slice(0, Math.max(0, i))].filter((j) => j.id !== meId)
  const places = SEATS[opponents.length] ?? []
  const map = new Map<string, Seat>()
  opponents.forEach((j, k) => {
    const [x, z, orientation, maxWidth] = places[k] ?? [0, H, "up", 6]
    map.set(j.id, { position: new Vector3(x, 0, z), orientation, maxWidth })
  })
  if (meId) map.set(meId, { ...MY_SEAT, position: MY_SEAT.position.clone() })
  return map
}

const FAMILY_ORDER = Object.keys(DEFAULT_FAMILIES) as Family[]
export const DL = CARD_W * DOMAIN_SCALE
export const DH = CARD_H * DOMAIN_SCALE
const OVERLAP = 0.42
const GAP = 0.35

const YAW: Record<Orientation, number> = { down: 0, up: 0, left: -Math.PI / 2, right: Math.PI / 2 }

export type DomainPile = { family: Family | null; position: Vector3 }
export type DomainZone = {
  center: Vector3
  width: number
  depth: number
  yaw: number
  labelPos: Vector3
  labelYaw: number
  piles: DomainPile[]
}

export const groupKey = (card: VisibleCard) => card.family ?? "spy"
export const GROUP_ORDER = FAMILY_ORDER

export function arrangeDomain(
  seat: Seat,
  domain: VisibleCard[],
  unfolded: string | null = null,
  hidden: Set<string> | null = null,
  liftedPile: number | null = null,
): { poses: Map<string, Pose>; zone: DomainZone } {
  const { position: p, orientation, maxWidth } = seat
  const family = (c: VisibleCard) => (hidden?.has(c.id) ? null : c.family)
  const groups = [...FAMILY_ORDER.map((f) => domain.filter((c) => family(c) === f)), domain.filter((c) => !family(c))].filter(
    (g) => g.length > 0,
  )
  const natural = groups.reduce((s, g) => s + DL + (g.length - 1) * OVERLAP, 0) + GAP * Math.max(0, groups.length - 1)
  const fixed = DL * groups.length
  const f = natural > maxWidth && natural > fixed ? Math.max(0.3, (maxWidth - fixed) / (natural - fixed)) : 1
  const width = groups.length ? fixed + (natural - fixed) * f : DL * 2

  const lateral = orientation === "left" || orientation === "right"
  const toward = orientation === "left" ? 1 : orientation === "right" ? -1 : 1
  const center = lateral ? new Vector3(p.x + toward * (0.4 + DH / 2), 0.02, p.z) : new Vector3(p.x, 0.02, p.z + 0.4 + DH / 2)
  const yaw = new Quaternion().setFromEuler(new Euler(0, YAW[orientation], 0))
  const place = (u: number, y: number, q: Quaternion) =>
    pose(lateral ? center.x : center.x + u, y, lateral ? center.z + u : center.z, yaw.clone().multiply(q), DOMAIN_SCALE)

  const poses = new Map<string, Pose>()
  const toTable = lateral ? new Vector3(toward, 0, 0) : new Vector3(0, 0, orientation === "up" ? 1 : -1)
  const piles: DomainPile[] = []
  let u = -width / 2 + DL / 2
  groups.forEach((group, groupIndex) => {
    const open = unfolded !== null && groupKey(group[0]) === unfolded && group.length > 1
    const lifted = liftedPile === groupIndex ? 0.45 : 0
    const middle = u + ((group.length - 1) * OVERLAP * f) / 2
    piles.push({
      family: family(group[0]),
      position: new Vector3(lateral ? center.x : center.x + middle, 0.05, lateral ? center.z + middle : center.z).addScaledVector(
        toTable,
        -(DH / 2 + 0.55),
      ),
    })
    group.forEach((card, k) => {
      const position = open ? middle + (k - (group.length - 1) / 2) * DL * 0.6 : u + k * OVERLAP * f
      poses.set(
        card.id,
        place(
          position,
          (open ? 0.35 : 0.03) + lifted + k * LAYOUT_SETTINGS.pileSpacing,
          lean(card.id).multiply(family(card) ? FACE_UP : FACE_DOWN),
        ),
      )
    })
    u += DL + (group.length - 1) * OVERLAP * f + GAP * f
  })

  const labelPos = center
    .clone()
    .addScaledVector(toTable, DH / 2 + 0.25)
    .setY(0.02)
  const bg = center.clone().setY(0.012)
  return {
    poses,
    zone: {
      center: bg,
      width: Math.max(width, 3 * DL + 2 * GAP) + 0.6,
      depth: DH + 0.5,
      yaw: YAW[orientation],
      labelPos,
      labelYaw: orientation === "up" ? Math.PI : YAW[orientation],
      piles,
    },
  }
}
