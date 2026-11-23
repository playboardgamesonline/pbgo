"use client"

import { type CameraSettings, Picture, Stamp } from "@pbgo/table"
import { useEffect, useMemo } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { Stage } from "./parts"

// A `Picture` is a texture laid flat on the table, cut out by its alpha. Here a sticker painted on a canvas, as a game's own would be, lies over a soft disc: a white texture that fades to nothing at its edge, tinted dark by `color`. The sticker is put in a
// `Stamp`, so that it lands with a thump when it is played again.

const CAMERA: CameraSettings = { tilt: 50, yaw: 0, distance: 12, fov: 34, targetX: 0, targetZ: 0 }

/** The sticker's size on its canvas, and so its proportions */
const BADGE = { width: 600, height: 360 }

/** A sticker with a transparent margin and a soft shadow, as a picture of a game's own is: a gold badge with the words on it */
function badgeTexture(): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = BADGE.width
  canvas.height = BADGE.height
  const g = canvas.getContext("2d")!
  g.shadowColor = "rgba(0,0,0,0.45)"
  g.shadowBlur = 18
  g.shadowOffsetY = 8
  g.beginPath()
  g.roundRect(30, 30, BADGE.width - 60, BADGE.height - 76, 64)
  g.fillStyle = "#ffd35c"
  g.fill()
  g.shadowColor = "transparent"
  g.lineWidth = 12
  g.strokeStyle = "#a8741a"
  g.stroke()
  g.fillStyle = "#4a2f06"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = "800 150px system-ui, sans-serif"
  g.fillText("+15", BADGE.width / 2, BADGE.height / 2 - 16)
  g.font = "700 40px system-ui, sans-serif"
  g.fillText("BONUS", BADGE.width / 2, BADGE.height / 2 + 82)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** A white disc that fades to nothing at its edge: tinted by a picture's `color`, it is a soft shadow */
function discTexture(): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 128
  const g = canvas.getContext("2d")!
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, "rgba(255,255,255,1)")
  gradient.addColorStop(0.55, "rgba(255,255,255,0.8)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = gradient
  g.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export type PictureKnobs = { width: number; yaw: number; run: number }

export function PictureScene({ width, yaw, run }: PictureKnobs) {
  const badge = useMemo(() => badgeTexture(), [])
  const disc = useMemo(() => discTexture(), [])
  useEffect(
    () => () => {
      badge.dispose()
      disc.dispose()
    },
    [badge, disc],
  )
  return (
    <Stage id="scene-picture" camera={CAMERA} playIntro={false}>
      {/* The disc lies under the sticker, drawn before it, and shows the colour and the opacity of a picture */}
      <Picture texture={disc} width={width * 1.7} color="#02151a" opacity={0.7} order={3} lift={0.02} />
      {/* The sticker lies where the stamp does, with its middle at the origin of the stamp's frame; a new `key` lands it again */}
      <group position={[0, 0.06, 0]} rotation-y={yaw}>
        <Stamp key={run}>
          <Picture texture={badge} width={width} aspect={BADGE.width / BADGE.height} />
        </Stamp>
      </group>
    </Stage>
  )
}
