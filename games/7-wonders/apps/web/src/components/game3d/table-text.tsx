"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, type MeshBasicMaterial, SRGBColorSpace } from "three"

const FONT = 'ui-rounded, "Avenir Next", "Nunito", system-ui, sans-serif'
const SIZE = 140

export type TextStyle = {
  color: string
  outline?: string
  glow?: string
  spacing?: string
  weight?: number
  bloom?: string
  holo?: boolean
  relief?: string
  aura?: string
  shadow?: string
}

function draw(text: string, style: TextStyle) {
  const measure = document.createElement("canvas").getContext("2d")!
  measure.font = `${style.weight ?? 900} ${SIZE}px ${FONT}`
  measure.letterSpacing = style.spacing ?? "0px"
  const margin = style.bloom || style.aura ? 110 : 60
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(measure.measureText(text).width + margin * 2)
  canvas.height = Math.ceil(SIZE * 1.35 + margin)
  const ctx = canvas.getContext("2d")!
  ctx.font = measure.font
  ctx.letterSpacing = measure.letterSpacing
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineJoin = "round"
  const x = canvas.width / 2
  const y = canvas.height / 2
  if (style.glow) {
    ctx.shadowColor = style.glow
    ctx.shadowBlur = 45
  }
  if (style.outline) {
    ctx.lineWidth = 24
    ctx.strokeStyle = style.outline
    ctx.strokeText(text, x, y)
  }
  ctx.shadowBlur = 0
  if (style.bloom) {
    ctx.shadowColor = style.bloom
    ctx.fillStyle = style.bloom
    for (const [blur, alpha] of [
      [70, 0.55],
      [34, 0.6],
      [12, 0.7],
    ] as const) {
      ctx.globalAlpha = alpha
      ctx.shadowBlur = blur
      ctx.fillText(text, x, y)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  if (style.aura) {
    ctx.shadowColor = style.aura
    ctx.shadowBlur = 55
    ctx.fillStyle = style.aura
    ctx.globalAlpha = 0.45
    ctx.fillText(text, x, y + 6)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  if (style.relief) {
    ctx.fillStyle = style.relief
    for (let k = 9; k >= 1; k--) ctx.fillText(text, x + k * 0.35, y + k)
    ctx.shadowColor = "rgba(0,0,0,0.35)"
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 8
    ctx.fillText(text, x, y + 10)
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
  if (style.shadow) {
    const [shadowTint, blur, offset] = style.shadow.split("|")
    ctx.shadowColor = shadowTint!
    ctx.shadowBlur = Number(blur)
    ctx.shadowOffsetY = Number(offset)
  }
  ctx.fillStyle = style.color
  ctx.fillText(text, x, y)
  ctx.shadowColor = "transparent"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  if (style.relief) {
    const gloss = ctx.createLinearGradient(0, y - SIZE * 0.5, 0, y + SIZE * 0.2)
    gloss.addColorStop(0, "rgba(255,255,255,0.35)")
    gloss.addColorStop(1, "rgba(255,255,255,0)")
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = gloss
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = "source-over"
  }
  if (style.holo) {
    ctx.globalCompositeOperation = "destination-out"
    ctx.fillStyle = "rgba(0,0,0,0.28)"
    for (let ly = 0; ly < canvas.height; ly += 7) ctx.fillRect(0, ly, canvas.width, 2)
    ctx.globalCompositeOperation = "source-over"
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return { texture, ratio: canvas.width / canvas.height, scale: canvas.height / 155 }
}

function useFontReady() {
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let active = true
    Promise.resolve(document.fonts?.load(`900 ${SIZE}px ${FONT}`))
      .catch(() => null)
      .then(() => active && setFontReady(true))
    return () => {
      active = false
    }
  }, [])
  return fontReady
}

export function TableText({
  text,
  style,
  height,
  position,
  yaw = 0,
  onClick,
  onHover,
  layer = 0,
}: {
  text: string
  style: TextStyle
  height: number
  position: [number, number, number]
  yaw?: number
  onClick?: () => void
  onHover?: (hovered: boolean) => void
  layer?: number
}) {
  const fontReady = useFontReady()
  const { color, outline, glow, spacing, weight, bloom, holo, relief, aura, shadow } = style
  const { texture, ratio, scale } = useMemo(
    () => draw(text, { color, outline, glow, spacing, weight, bloom, holo, relief, aura, shadow }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, color, outline, glow, spacing, weight, bloom, holo, relief, aura, shadow, fontReady],
  )
  useEffect(() => () => texture.dispose(), [texture])
  const [hovered, setHovered] = useState(false)
  useCursor(hovered && !!onClick)
  const totalHeight = height * scale
  const material = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (!material.current) return
    const t = clock.elapsedTime
    material.current.opacity = holo ? 0.9 + Math.sin(t * 1.6) * 0.05 : 1
    if (relief) material.current.color.setScalar(0.92 + 0.08 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.1 + text.length), 8))
  })

  return (
    <group position={position} rotation-y={yaw}>
      <mesh
        rotation-x={-Math.PI / 2}
        renderOrder={layer}
        {...(onClick || onHover ? {} : { raycast: () => null })}
        onClick={
          onClick &&
          ((e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick()
          })
        }
        onPointerOver={(e) => {
          if (!onClick && !onHover) return
          e.stopPropagation()
          setHovered(true)
          onHover?.(true)
        }}
        onPointerOut={() => {
          setHovered(false)
          onHover?.(false)
        }}
      >
        <planeGeometry args={[totalHeight * ratio, totalHeight]} />
        <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
