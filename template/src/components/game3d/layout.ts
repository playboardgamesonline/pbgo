import { Euler, Quaternion, Vector3 } from "three"

export type Pose = { position: Vector3; quaternion: Quaternion; scale: number; delay?: number }
export type Seat = { x: number; z: number; yaw: number }

export const LAYOUT_SETTINGS = {
  radiusX: 7.4,
  radiusZ: 4.4,
  handZ: 6.1,
  handY: 1.1,
  handTilt: 0.62,
  handGap: 1.05,
  handScale: 1.2,
  hoverLift: 0.45,
  trickGap: 0.3,
}

const q = (x: number, y: number, z: number) => new Quaternion().setFromEuler(new Euler(x, y, z))
const flat = (yaw: number) => q(-Math.PI / 2, 0, yaw)

export function seats(ids: string[], meId: string | null): Map<string, Seat> {
  const R = LAYOUT_SETTINGS
  const start = Math.max(0, ids.indexOf(meId ?? ""))
  const seating = [...ids.slice(start), ...ids.slice(0, start)]
  const others = seating.length - 1
  const result = new Map<string, Seat>()
  seating.forEach((id, i) => {
    if (i === 0 && meId) {
      result.set(id, { x: 0, z: R.radiusZ, yaw: 0 })
      return
    }
    const k = meId ? i - 1 : i
    const n = meId ? others : seating.length
    const angle = n === 1 ? -Math.PI / 2 : Math.PI + 0.35 + (k / (n - 1)) * (Math.PI - 0.7)
    const x = Math.cos(angle) * R.radiusX
    const z = Math.sin(angle) * R.radiusZ
    result.set(id, { x, z, yaw: Math.atan2(x, z) + Math.PI })
  })
  return result
}

export function handPose(i: number, n: number, raised: boolean): Pose {
  const R = LAYOUT_SETTINGS
  const x = (i - (n - 1) / 2) * R.handGap
  const curve = Math.abs(i - (n - 1) / 2) * 0.06
  return {
    position: new Vector3(x, R.handY + (raised ? R.hoverLift : 0) + i * 0.004, R.handZ + curve - (raised ? 0.25 : 0)),
    quaternion: q(-Math.PI / 2 + R.handTilt, 0, -(i - (n - 1) / 2) * 0.05),
    scale: R.handScale,
  }
}

export function backPose(seat: Seat, i: number, n: number): Pose {
  const offset = (i - (n - 1) / 2) * 0.32
  const cos = Math.cos(seat.yaw)
  const sin = Math.sin(seat.yaw)
  const recoil = 1.1
  return {
    position: new Vector3(seat.x * 1.08 + cos * offset + sin * recoil * 0, 0.02 + i * 0.004, seat.z * 1.08 - sin * offset),
    quaternion: q(Math.PI / 2, 0, seat.yaw + Math.PI),
    scale: 0.62,
  }
}

export function trickPose(seat: Seat, rank: number): Pose {
  const R = LAYOUT_SETTINGS
  return {
    position: new Vector3(seat.x * R.trickGap, 0.03 + rank * 0.012, seat.z * R.trickGap),
    quaternion: flat(seat.yaw + ((rank * 37) % 11) * 0.02 - 0.1),
    scale: 1,
  }
}

export function collectedPose(seat: Seat): Pose {
  return { position: new Vector3(seat.x * 1.05, 0.04, seat.z * 1.05), quaternion: flat(seat.yaw), scale: 0.35 }
}

export const DECK_POSE: Pose = { position: new Vector3(0, 3.2, -0.5), quaternion: q(Math.PI / 2, 0, 0), scale: 0.9 }
