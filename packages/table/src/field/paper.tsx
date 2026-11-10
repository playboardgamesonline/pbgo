"use client"

import { useCursor } from "@react-three/drei"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"
import { shadowTexture } from "../card/textures"
import { TABLE_FONT } from "../seat/table-text"
import { layoutSheet, type Measure } from "./layout"
import { innerBox, paintSheet, PX_PER_UNIT } from "./paint"

export type PaperProps = {
  /** What is written on the paper */
  text: string
  /** Said in faint ink while `text` is empty, in the game's words */
  placeholder?: string
  /** How many lines the paper has (default 1). The letters shrink, then the text is cut, when it does not fit */
  lines?: number
  /** Where the paper lies on the table, and the way it faces (`yaw`, radians about the vertical axis, counterclockwise from above) */
  at: { x: number; z: number; yaw?: number }
  /** Its size in world units. The default height depends on the lines */
  width?: number
  height?: number
  /** The CSS font and weight of the letters, `TABLE_FONT` by default */
  font?: string
  weight?: number
  /** The colour of the paper, of the ink, and of the edge while the pointer is over a paper that can be pressed */
  paper?: string
  ink?: string
  accent?: string
  /** Pressing the paper does this. Without it the paper only shows its text */
  onPress?: () => void
  /** The paper cannot be pressed now (it is not the player's turn): the ink is dimmed */
  disabled?: boolean
}

const PAPER = "#f4efe2"
const INK = "#26231f"
const ACCENT = "#d9822b"
// How high above the table the paper lies: over the surface, under the cards
const HEIGHT = 0.015

/** Tells the graphics card that the picture a canvas holds has been painted again: a texture is a resource of the card, not a value of the page */
function changed(texture: CanvasTexture) {
  texture.needsUpdate = true
}

function useFontReady(font: string, weight: number) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    Promise.resolve(document.fonts?.load(`${weight} 40px ${font}`))
      .catch(() => null)
      .then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [font, weight])
  return ready
}

/**
 * A piece of paper on the table with a few words on it, which can be pressed. It is what a field of the board is drawn as (`TextField`, `NumberField`, `ChoiceField` press it to open their window), and a board uses it on its own for
 * a button on the table, or to open a window of its own (`ask`). The paper and its writing are painted on a canvas and lie on the table like the rest of the board, so the paper is lit, turned and covered as a card is.
 * Its edge takes the accent colour under the pointer when it can be pressed. Without `onPress` it only shows its text, which is how a text another player wrote is drawn.
 */
export function Paper({ text, placeholder = "", lines = 1, at, width = 3.4, height, font = TABLE_FONT, weight = 600, paper = PAPER, ink = INK, accent = ACCENT, onPress, disabled = false }: PaperProps) {
  const h = height ?? 0.7 + 0.5 * (lines - 1)
  const pressable = !!onPress && !disabled
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && pressable)
  const [shadowTex] = useState(shadowTexture)

  const box = useMemo(() => ({ width: Math.round(width * PX_PER_UNIT), height: Math.round(h * PX_PER_UNIT), lines }), [width, h, lines])
  const { canvas, texture } = useMemo(() => {
    const surface = document.createElement("canvas")
    surface.width = box.width
    surface.height = box.height
    const map = new CanvasTexture(surface)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 8
    return { canvas: surface, texture: map }
  }, [box.width, box.height])
  useEffect(() => () => texture.dispose(), [texture])
  const fontReady = useFontReady(font, weight)

  // The paper is painted again when what it shows changes: the text, the edge under the pointer, the colours, and the font once it has loaded
  useEffect(() => {
    const g = canvas.getContext("2d")
    if (!g) return
    const { inner } = innerBox(box)
    const measureAt =
      (size: number): Measure =>
      (measured) => {
        g.font = `${weight} ${size}px ${font}`
        return g.measureText(measured).width
      }
    const faint = text === ""
    const layout = layoutSheet(faint ? placeholder : text, inner, measureAt)
    paintSheet(g, box, layout, { paper, ink, accent, font, weight }, { focused: hovered && pressable, disabled, faint })
    changed(texture)
  }, [canvas, texture, box, text, placeholder, hovered, pressable, disabled, paper, ink, accent, font, weight, fontReady])

  return (
    <group position={[at.x, HEIGHT, at.z]} rotation-y={at.yaw ?? 0}>
      <group rotation-x={-Math.PI / 2}>
        <mesh position={[width * 0.02, -h * 0.05, -0.004]} renderOrder={1} raycast={() => null}>
          <planeGeometry args={[width * 1.14, h * 1.4]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh
          renderOrder={2}
          onClick={
            pressable
              ? (e) => {
                  e.stopPropagation()
                  onPress?.()
                }
              : undefined
          }
          onPointerOver={pressable ? () => setHovered(true) : undefined}
          onPointerOut={pressable ? () => setHovered(false) : undefined}
          {...(pressable ? {} : { raycast: () => null })}
        >
          <planeGeometry args={[width, h]} />
          <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
