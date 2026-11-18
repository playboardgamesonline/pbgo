"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { type ReactNode, useState } from "react"
import { CORNER_SCREEN, type CornerFrame, cornerFrame, onTableAt, type Place } from "./screen"

/**
 * The hand of the viewer in the bottom left of the screen. The table is seen through a camera, so where a corner of the screen falls on the table is read from the camera on every frame, and the hand is laid there: `children` is given the frame (`CornerFrame`: its middle,
 * its room and the `scale` the hand must be drawn at to fit it) and draws the cards in it. It asks for a render only when the place moves, which it does when the window is resized or the view changes. `most` and `depth` are the width and the depth the hand is drawn at, and
 * `height` how high its cards stand at their outer edge: the edges are read at that height, so that a hand that stands up, which shows larger than the table under it, stays inside the picture.
 */
export function CornerHand({ most, depth, height = 0, screen = CORNER_SCREEN, children }: { most: number; depth: number; height?: number; screen?: typeof CORNER_SCREEN; children: (frame: CornerFrame) => ReactNode }) {
  const camera = useThree((three) => three.camera)
  const [frame, setFrame] = useState<CornerFrame | null>(null)
  useFrame(() => {
    camera.updateMatrixWorld()
    const next = cornerFrame(onTableAt(camera, screen.left, screen.row, height), onTableAt(camera, screen.middle, screen.row, height), { most, depth })
    if (!frame || Math.abs(next.x - frame.x) > 0.05 || Math.abs(next.z - frame.z) > 0.05 || Math.abs(next.scale - frame.scale) > 0.01) setFrame(next)
  })
  return frame ? <>{children(frame)}</> : null
}

/** A place of the table that a point of the screen shows (-1 to 1 across and up), read from the camera as the corner hand is: what is laid at a corner of the screen other than the hand */
export function ScreenSpot({ at, children }: { at: readonly [number, number]; children: (spot: Place) => ReactNode }) {
  const camera = useThree((three) => three.camera)
  const [spot, setSpot] = useState<Place | null>(null)
  useFrame(() => {
    camera.updateMatrixWorld()
    const next = onTableAt(camera, at[0], at[1])
    if (!spot || Math.abs(next.x - spot.x) > 0.05 || Math.abs(next.z - spot.z) > 0.05) setSpot(next)
  })
  return spot ? <>{children(spot)}</> : null
}
