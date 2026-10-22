"use client"

import { CanvasTexture, SRGBColorSpace } from "three"
import type { CardSize } from "./geometry"

/** Pixels across a face when the game does not say: sharp at the size a card has on screen, light on memory */
const ACROSS = 360

const faces = new Map<string, CanvasTexture>()

/** The canvas of a face, in pixels: `across` wide, as high as the card's proportions ask */
export function faceResolution({ width, height }: CardSize, across = ACROSS) {
  return { width: across, height: Math.round((across * height) / width) }
}

/**
 * A face (or a back) painted on a canvas. `draw` gets the 2D context and the canvas size in pixels: paint the whole rectangle, the card's shape cuts the rounded corners.
 * The key says what is painted (a card's id, "back"): the same key at the same size gives back the same texture, painted once.
 */
export function paintFace(key: string, size: CardSize, draw: (g: CanvasRenderingContext2D, width: number, height: number) => void, across = ACROSS) {
  const id = `${key}@${size.width}x${size.height}x${across}`
  let texture = faces.get(id)
  if (texture) return texture
  const px = faceResolution(size, across)
  const canvas = document.createElement("canvas")
  canvas.width = px.width
  canvas.height = px.height
  draw(canvas.getContext("2d")!, px.width, px.height)
  texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  faces.set(id, texture)
  return texture
}

export type StandIn = {
  /** Fill colour (default: a neutral paper) */
  color?: string
  /** Written across the middle. Pass the key of the missing picture, `[missing: key]`, so the gap shows */
  label?: string
}

/** What a card shows while its picture is missing: a plain face, still a texture on the card */
export function standIn(key: string, size: CardSize, { color = "#d8d2c2", label }: StandIn = {}) {
  return paintFace(`stand-in:${key}:${color}:${label ?? ""}`, size, (g, width, height) => {
    g.fillStyle = color
    g.fillRect(0, 0, width, height)
    if (!label) return
    let font = width / 10
    g.font = `700 ${font}px system-ui, sans-serif`
    const fit = (width * 0.86) / g.measureText(label).width
    if (fit < 1) {
      font *= fit
      g.font = `700 ${font}px system-ui, sans-serif`
    }
    g.fillStyle = "rgba(0,0,0,0.55)"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(label, width / 2, height / 2)
  })
}
