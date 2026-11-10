"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { type ThreeEvent, useThree } from "@react-three/fiber"
import { type RefObject, useEffect, useRef, useState } from "react"
import { Vector3 } from "three"
import { useDragStore } from "./context"
import { endOf, movePress, startPress } from "./gesture"
import { pointOnTable, withinReach } from "./reach"
import { DRAG_SETTINGS } from "./settings"
import type { Point } from "./shapes"
import type { ZoneId } from "./store"
import { claimTouch } from "./touch"

/** Where a dragged thing was let go */
export type Drop = {
  /** The zone it was let go on, among the ones it may go on: null when it was let go on none */
  target: ZoneId | null
  /** Where the thing lay when it was let go: x and z on the table, y the height of its place */
  position: Vector3
}

export type DragOptions = {
  /** The thing can be picked up (default true). Turn it off while it must not be moved: it is not the player's turn, the thing is locked. A thing that is held when this turns false is let go of, and nothing is dropped */
  enabled?: boolean
  /** The height its place gives it above the table: what the thing is lifted from when it is picked up */
  level: number
  /** Where the thing is now, the position of its group: read when it is picked up, so that the pointer keeps hold of it where it took it. Null while it has none */
  position: () => Vector3 | null
  /** The zones it may be let go on, by their id (default: any). Those zones show themselves while it is held, and it is never over another */
  dropOn?: readonly ZoneId[]
  /** The click of the thing. A press that became a drag is not a click, so it is not called for the one that ends a drag */
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  /** The pointer has gone far enough from where it went down: the thing is picked up */
  onDragStart?: () => void
  /** The thing was let go, on a zone or on none. It goes back to the place the game gives it, which the game changes in the same step if the drop does something */
  onDrop?: (drop: Drop) => void
  /** The drag was given up: Escape was pressed, the pointer was taken from the page, or the thing can no longer be moved. Nothing is dropped */
  onDragCancel?: () => void
}

export type Dragger = {
  /** The handlers to put on the group of the thing, `onPointerDown` and `onClick`. A thing that cannot be picked up has no `onPointerDown`, and one with no click has no `onClick` */
  bind: { onPointerDown?: (e: ThreeEvent<PointerEvent>) => void; onClick?: (e: ThreeEvent<MouseEvent>) => void }
  /** Whether the thing is held: from the move that picked it up to the one that let it go */
  dragging: boolean
  /** Where the thing is drawn while it is held, x and z, under the pointer and where it took hold of it; null when it is not held. A ref that a frame reads, since the pointer moves faster than a component renders */
  held: RefObject<{ x: number; z: number } | null>
  /** The visitor asks for less motion: the thing is where the pointer is, with no catching up */
  reduced: boolean
}

/** A press that is going on: what ends it */
type Session = { end: (how: "drop" | "cancel") => void }

/**
 * Lets the player pick a thing up with the pointer and let it go on the table, in the way the `Card` and the `Piece` do, for anything a game draws. It must be called inside the `Table`. A press on the thing that stays within a few pixels is a click; one
 * that goes farther picks it up: while it is held it follows the pointer, `held` says where for a frame to read, and the zones it may be let go on show themselves; letting go reports where, and on which zone, to `onDrop`. The thing is never moved by the
 * hook: its owner draws it at `held` while there is one (`dragGoal`) and at its place the rest of the time, so a thing that is let go goes back to where the game has it, and goes elsewhere when the game has moved it.
 *
 * The pointer's place on the table is the point of the table under it, and a zone is the one that holds that point: the thing is "over" a zone when the pointer is, not its middle. Escape gives the drag up. A drag and a click must lead to the same action
 * in a game, since a drag is not available to everyone: the click is the way that always works.
 */
export function useDrag(options: DragOptions): Dragger {
  const store = useDragStore()
  const camera = useThree((state) => state.camera)
  const element = useThree((state) => state.gl.domElement)
  const reduced = usePrefersReducedMotion()
  const [dragging, setDragging] = useState(false)
  const held = useRef<{ x: number; z: number } | null>(null)
  const session = useRef<Session | null>(null)
  // The click that comes after a drop is not one
  const suppress = useRef(false)
  // What a handler reads: the newest props, not the ones of the render that made the handler
  const latest = useRef({ ...options, camera, element })
  useEffect(() => {
    latest.current = { ...options, camera, element }
  })

  const enabled = options.enabled ?? true
  useEffect(() => (enabled ? claimTouch(element) : undefined), [enabled, element])
  // A thing that can no longer be moved is let go of, and one that leaves the table takes its press with it
  useEffect(() => {
    if (!enabled) session.current?.end("cancel")
  }, [enabled])
  useEffect(
    () => () => {
      session.current?.end("cancel")
    },
    [],
  )

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const now = latest.current
    const native = e.nativeEvent
    if (!(now.enabled ?? true) || native.button !== 0 || session.current || store.snapshot().dragging) return
    const place = now.position()
    if (!place) return
    // Where on the thing's own plane the pointer took hold of it, so that the thing is kept where it was taken
    const taken = pointOnTable(now.camera, now.element.getBoundingClientRect(), native.clientX, native.clientY, place.y)
    if (!taken) return
    e.stopPropagation()
    suppress.current = false
    const grab: Point = [place.x - taken[0], place.z - taken[1]]
    let press = startPress(native.pointerId, native.clientX, native.clientY)

    /** Where the pointer is: the thing goes under it, lifted, and the zone it is over is worked out from the point of the table the pointer is on */
    const follow = (ev: PointerEvent) => {
      const { camera: view, element: canvas, level } = latest.current
      const box = canvas.getBoundingClientRect()
      const lifted = pointOnTable(view, box, ev.clientX, ev.clientY, level + DRAG_SETTINGS.lift)
      if (lifted) {
        const [x, z] = withinReach([lifted[0] + grab[0], lifted[1] + grab[1]], DRAG_SETTINGS.reach)
        held.current = { x, z }
      }
      const table = pointOnTable(view, box, ev.clientX, ev.clientY, 0)
      if (table) store.move(...withinReach(table, DRAG_SETTINGS.reach))
    }

    const move = (ev: PointerEvent) => {
      const moved = movePress(press, ev.pointerId, ev.clientX, ev.clientY, DRAG_SETTINGS.threshold)
      press = moved.press
      if (moved.began) {
        // Another thing is held already (a second finger): this press is not a drag, and not a click either
        if (!store.begin(latest.current.dropOn ?? null)) {
          unlisten()
          session.current = null
          return
        }
        setDragging(true)
        latest.current.element.style.cursor = "grabbing"
        latest.current.onDragStart?.()
      }
      if (press.dragging && ev.pointerId === press.pointer) follow(ev)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId === press.pointer) finish("drop", ev)
    }
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === press.pointer) finish("cancel")
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && press.dragging) finish("cancel")
    }
    const away = () => finish("cancel")
    const listen = () => {
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", cancel)
      window.addEventListener("keydown", key)
      window.addEventListener("blur", away)
    }
    const unlisten = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", key)
      window.removeEventListener("blur", away)
    }

    /** Ends the press. A press that never became a drag is a click, which the canvas reports by itself; one that did is ended: put down on `how`, or given up */
    function finish(how: "drop" | "cancel", ev?: PointerEvent) {
      unlisten()
      session.current = null
      if (endOf(press) === "click") return
      // Where the thing was let go, with the last place of the pointer
      if (how === "drop" && ev) follow(ev)
      const [target, at] = [store.snapshot().over, held.current]
      held.current = null
      store.end()
      setDragging(false)
      latest.current.element.style.cursor = ""
      suppress.current = true
      const callbacks = latest.current
      if (how === "drop" && at) callbacks.onDrop?.({ target, position: new Vector3(at.x, callbacks.level, at.z) })
      else callbacks.onDragCancel?.()
    }

    session.current = { end: (how) => finish(how) }
    listen()
  }

  const onClick = options.onClick
    ? (e: ThreeEvent<MouseEvent>) => {
        if (suppress.current) {
          suppress.current = false
          return
        }
        latest.current.onClick?.(e)
      }
    : undefined

  return { bind: { onPointerDown: enabled ? onPointerDown : undefined, onClick }, dragging, held, reduced }
}
