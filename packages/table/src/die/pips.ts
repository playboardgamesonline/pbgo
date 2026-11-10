"use client"

import { paintFace } from "../card/face"
import { pipPositions } from "./faces"

/** The colours of the default die: a warm ivory with dark pips and numbers */
export const DEFAULT_BODY = "#f3eee0"
export const DEFAULT_INK = "#1d1b19"

/** Pixels across a painted face of a die: it is seen small, so this is plenty */
const ACROSS = 256

/** How big a pip is, as a share of the face */
const PIP_RADIUS = 0.095

/**
 * The face of a die for a value, painted with pips on the `body` colour: the picture a die wears when its game gives none of its own. The same value in the same colours gives back the same texture,
 * painted once. A game with its own faces (numbers, symbols, art) passes textures to the `Die` instead, six of them, one for each value.
 */
export function pipFace(value: number, { body = DEFAULT_BODY, ink = DEFAULT_INK }: { body?: string; ink?: string } = {}) {
  return paintFace(
    `die-pips:${value}:${body}:${ink}`,
    { width: 1, height: 1 },
    (g, width, height) => {
      g.fillStyle = body
      g.fillRect(0, 0, width, height)
      const radius = width * PIP_RADIUS
      for (const [x, y] of pipPositions(value)) {
        g.beginPath()
        g.arc(x * width, y * height, radius, 0, Math.PI * 2)
        g.fillStyle = ink
        g.fill()
        // The dip of a pip: a thin lighter edge on its lower side, where the light falls on the lip of the hollow
        g.beginPath()
        g.arc(x * width, y * height + radius * 0.12, radius, Math.PI * 0.12, Math.PI * 0.88)
        g.strokeStyle = "rgba(255, 255, 255, 0.22)"
        g.lineWidth = radius * 0.16
        g.stroke()
      }
    },
    ACROSS,
  )
}
