"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { type ReactNode, useCallback, useRef, useState } from "react"
import { type Camera, type Group, Matrix4, type PerspectiveCamera, Quaternion, Vector3 } from "three"
import { useSettingsVersion } from "../debug/settings"
import type { Pose } from "../pose"
import { SCREEN_HAND_SETTINGS, type ScreenHandSettings, type ScreenView, screenViewOf } from "./screen-hand-layout"

/** What a screen hand tells what it draws: where the edges of the picture are in its own frame, and how to say a place of the table in that frame */
export type ScreenHandView = ScreenView & {
  /** A pose on the table, in the world, as the hand's frame sees it, for a card that comes in from there (`enter` of a `Zone`) or goes there: the frame moves with the camera, so a place of the table is only the same place in it for a moment */
  local: (pose: Pose) => Pose
}

const inverse = new Matrix4()
const placed = new Matrix4()
const scale = new Vector3()

/** A pose of the world in the frame of the camera */
function inCameraFrame(camera: Camera, pose: Pose): Pose {
  camera.updateMatrixWorld()
  inverse.copy(camera.matrixWorld).invert()
  placed.compose(pose.position, pose.quaternion, scale.setScalar(pose.scale)).premultiply(inverse)
  const local: Pose = { position: new Vector3(), quaternion: new Quaternion(), scale: 1, ...(pose.delay === undefined ? {} : { delay: pose.delay }) }
  placed.decompose(local.position, local.quaternion, scale)
  local.scale = scale.x
  return local
}

/**
 * The frame of a hand held at the bottom left of the screen, as Courtisans does it: a frame that follows the camera, so that what is laid in it keeps its place on the screen whatever the window, the entrance of the camera and the view. `children` is given the `ScreenHandView`
 * (where the edges of the picture are in the frame, and `local`, which puts a place of the table in it) and lays the cards there, with `screenHandLayout` for the slots. The cards are a `Zone` like any other, so they glide, fly and glow as cards of the table do, and a card that goes to
 * the table flies from where it was on the screen. It is not in the share photo.
 */
export function ScreenHand({ settings = SCREEN_HAND_SETTINGS, children }: { settings?: ScreenHandSettings; children: (view: ScreenHandView) => ReactNode }) {
  useSettingsVersion()
  const camera = useThree((three) => three.camera)
  const group = useRef<Group>(null)
  const [view, setView] = useState<ScreenHandView | null>(null)
  const local = useCallback((pose: Pose) => inCameraFrame(camera, pose), [camera])
  useFrame(() => {
    const g = group.current
    if (!g) return
    // The camera has been put where it stands this frame (the rig runs first): the frame goes there, and the picture's edges are read from its lens
    camera.updateMatrixWorld()
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
    const m = (camera as PerspectiveCamera).projectionMatrix.elements
    const next = screenViewOf({ m00: m[0]!, m11: m[5]! }, settings.distance)
    if (!view || Math.abs(next.halfWidth - view.halfWidth) > 1e-3 || Math.abs(next.halfHeight - view.halfHeight) > 1e-3 || next.distance !== view.distance) setView({ ...next, local })
  })
  return (
    <group ref={group} userData={{ hiddenInPhoto: true }}>
      {view && children(view)}
    </group>
  )
}
