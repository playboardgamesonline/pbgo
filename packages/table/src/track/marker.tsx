"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import { Piece, type PieceProps } from "../piece/piece"
import { PIECE_SIZE } from "../piece/settings"
import type { Space } from "./path"
import { routeBetween, slotOffset } from "./route"
import { TRACK_SETTINGS } from "./settings"

export type TrackMarkerProps = Omit<PieceProps, "at" | "from" | "y"> & {
  /** The spaces of the track, the list given to the `Track` */
  spaces: readonly Space[]
  /** The space the marker is on: its number in the list, the number the state holds (less the first space of the engine's track, when it does not start at 0) */
  space: number
  /** The track closes on itself: a marker that is sent to another space takes the shorter way round */
  loop?: boolean
  /** The spaces to go through to get to the new `space`, when the way is not the straight one or the shorter one: the `passed` of the engine's `moveAlong`, less the first space of its track. It is used when it ends on the new space */
  route?: readonly number[]
  /** The marker goes straight to its new space, without going through the spaces between, unless it is given a `route`: for spaces that do not lie in a row, such as the cells of a board */
  direct?: boolean
  /** Which of the markers that share this space this one is (from 0, in the order they came) and how many there are: they stand side by side in the space */
  slot?: number
  of?: number
  /** The distance between two markers that share a space (default 0.85 widths of the marker) */
  spread?: number
  /** The way the marker faces (default: the way the track goes on its space) */
  yaw?: number
  /** Called each time the marker reaches a space on its way, with it: a step of sound */
  onStep?: (space: number) => void
}

/**
 * A piece that stands on a space of a track and walks along the spaces: when `space` changes it goes through each space between the old one and the new one, one after the other, hopping at each step, and faster when the walk is long.
 * It is a `Piece`, so it takes everything a piece takes (a shape, a colour, pictures, a halo, a click). The first space is shown at once; a visitor who asks for less motion gets no walk and no hop, and the marker goes straight to the new space.
 */
export function TrackMarker({ spaces, space, loop = false, route, direct = false, slot = 0, of = 1, spread, yaw, onStep, size = PIECE_SIZE, lift = 0, ...piece }: TrackMarkerProps) {
  const reduced = usePrefersReducedMotion()
  const count = spaces.length
  const goal = Math.max(0, Math.min(count - 1, Math.round(Number.isFinite(space) ? space : 0)))
  // The space the marker is on, or is passing, and how high its step has taken it
  const [on, setOn] = useState(goal)
  const [hop, setHop] = useState(0)
  const run = useRef({ goal, on: goal, queue: [] as number[], wait: 0, per: 0, since: 0, up: false })
  // What a frame reads: the newest props, not the ones of the render that made the frame's closure
  const latest = useRef({ goal, reduced, loop, route, direct, count, size, onStep })
  useEffect(() => {
    latest.current = { goal, reduced, loop, route, direct, count, size, onStep }
  })

  useFrame((_, dt) => {
    const r = run.current
    const now = latest.current
    const S = TRACK_SETTINGS

    // A new space: the way there is the route the game gave, when it ends where the marker goes, or else the straight way, or the shorter one round a loop
    if (r.goal !== now.goal) {
      r.goal = now.goal
      if (now.reduced) {
        r.queue = []
        r.on = now.goal
        setOn(now.goal)
      } else {
        const given = now.route?.map((index) => Math.max(0, Math.min(now.count - 1, Math.round(index))))
        r.queue = given && given.length > 0 && given[given.length - 1] === now.goal ? [...given] : now.direct ? [now.goal] : routeBetween(r.on, now.goal, now.count, now.loop)
        r.per = Math.min(S.stepSeconds, S.maxSeconds / Math.max(1, r.queue.length))
        // The first step is taken at once
        r.wait = 0
      }
    }

    if (r.queue.length > 0) {
      r.wait -= dt
      r.since += dt
      if (r.wait <= 0) {
        r.on = r.queue.shift()!
        r.wait += r.per
        r.since = 0
        setOn(r.on)
        now.onStep?.(r.on)
        if (!r.up) {
          r.up = true
          setHop(S.hop * now.size)
        }
      }
    } else {
      r.since += dt
    }
    // Back down halfway through the step, so the marker comes down on the space before it goes for the next
    if (r.up && r.since >= (r.queue.length > 0 ? r.per : S.stepSeconds) * 0.5) {
      r.up = false
      setHop(0)
    }
  })

  const at = spaces[on] ?? spaces[goal]
  if (!at) return null
  // The markers that share a space stand side by side, as the viewer sees them, whichever way the track goes there
  const offset = slotOffset(slot, of, spread ?? size * 0.85)
  return <Piece {...piece} size={size} lift={lift + hop} at={{ x: at.x + offset.x, z: at.z + offset.z, yaw: yaw ?? at.yaw }} />
}
