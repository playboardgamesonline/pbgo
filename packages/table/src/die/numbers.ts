"use client"

import { paintFace } from "../card/face"
import { DEFAULT_BODY, DEFAULT_INK } from "./pips"

/** Pixels across a painted face of a die: it is seen small, so this is plenty */
const ACROSS = 256

/**
 * The face of a die that carries a written value: a number or a word, in the ink on the body colour, sized to fit the middle of the face. A 6 and a 9 are underlined so that a die lying on its side is not read upside down. The
 * same text in the same colours gives back the same texture, painted once. The stand-in of a die whose game gives no pictures of its own, like `pipFace` for a cube.
 */
export function numberFace(text: string, { body = DEFAULT_BODY, ink = DEFAULT_INK }: { body?: string; ink?: string } = {}) {
  return paintFace(
    `die-number:${text}:${body}:${ink}`,
    { width: 1, height: 1 },
    (g, width, height) => {
      g.fillStyle = body
      g.fillRect(0, 0, width, height)
      let size = width * 0.4
      g.font = `700 ${size}px system-ui, sans-serif`
      const reach = width * 0.42
      const measured = g.measureText(text).width
      if (measured > reach) {
        size *= reach / measured
        g.font = `700 ${size}px system-ui, sans-serif`
      }
      g.fillStyle = ink
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillText(text, width / 2, height / 2)
      if (text === "6" || text === "9") g.fillRect(width / 2 - size * 0.28, height / 2 + size * 0.5, size * 0.56, size * 0.09)
    },
    ACROSS,
  )
}
