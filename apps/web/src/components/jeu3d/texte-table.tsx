"use client"

import { useCursor } from "@react-three/drei"
import { type ThreeEvent, useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, useState } from "react"
import { CanvasTexture, type MeshBasicMaterial, SRGBColorSpace } from "three"

const POLICE = '"Alegreya Variable", "Alegreya", Georgia, serif'
const TAILLE = 140

export type StyleTexte = {
  couleur: string
  contour?: string
  lueur?: string
  espacement?: string
  graisse?: number
  bloom?: string
  holo?: boolean
  relief?: string
  aura?: string
}

function dessiner(texte: string, style: StyleTexte) {
  const mesure = document.createElement("canvas").getContext("2d")!
  mesure.font = `${style.graisse ?? 900} ${TAILLE}px ${POLICE}`
  mesure.letterSpacing = style.espacement ?? "0px"
  const marge = style.bloom || style.aura ? 110 : 60
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(mesure.measureText(texte).width + marge * 2)
  canvas.height = Math.ceil(TAILLE * 1.35 + marge)
  const ctx = canvas.getContext("2d")!
  ctx.font = mesure.font
  ctx.letterSpacing = mesure.letterSpacing
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineJoin = "round"
  const x = canvas.width / 2
  const y = canvas.height / 2
  if (style.lueur) {
    ctx.shadowColor = style.lueur
    ctx.shadowBlur = 45
  }
  if (style.contour) {
    ctx.lineWidth = 24
    ctx.strokeStyle = style.contour
    ctx.strokeText(texte, x, y)
  }
  ctx.shadowBlur = 0
  if (style.bloom) {
    ctx.shadowColor = style.bloom
    ctx.fillStyle = style.bloom
    for (const [flou, alpha] of [
      [70, 0.55],
      [34, 0.6],
      [12, 0.7],
    ] as const) {
      ctx.globalAlpha = alpha
      ctx.shadowBlur = flou
      ctx.fillText(texte, x, y)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  if (style.aura) {
    ctx.shadowColor = style.aura
    ctx.shadowBlur = 55
    ctx.fillStyle = style.aura
    ctx.globalAlpha = 0.45
    ctx.fillText(texte, x, y + 6)
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  if (style.relief) {
    ctx.fillStyle = style.relief
    for (let k = 9; k >= 1; k--) ctx.fillText(texte, x + k * 0.35, y + k)
    ctx.shadowColor = "rgba(0,0,0,0.35)"
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 8
    ctx.fillText(texte, x, y + 10)
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
  ctx.fillStyle = style.couleur
  ctx.fillText(texte, x, y)
  if (style.relief) {
    const reflet = ctx.createLinearGradient(0, y - TAILLE * 0.5, 0, y + TAILLE * 0.2)
    reflet.addColorStop(0, "rgba(255,255,255,0.35)")
    reflet.addColorStop(1, "rgba(255,255,255,0)")
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = reflet
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
  return { texture, ratio: canvas.width / canvas.height, echelle: canvas.height / 155 }
}

function usePolicePrete() {
  const [prete, setPrete] = useState(false)
  useEffect(() => {
    let actif = true
    Promise.resolve(document.fonts?.load(`900 ${TAILLE}px ${POLICE}`))
      .catch(() => null)
      .then(() => actif && setPrete(true))
    return () => {
      actif = false
    }
  }, [])
  return prete
}

export function TexteTable({
  texte,
  style,
  hauteur,
  position,
  lacet = 0,
  onClick,
  onSurvol,
}: {
  texte: string
  style: StyleTexte
  hauteur: number
  position: [number, number, number]
  lacet?: number
  onClick?: () => void
  onSurvol?: (survol: boolean) => void
}) {
  const prete = usePolicePrete()
  const { couleur, contour, lueur, espacement, graisse, bloom, holo, relief, aura } = style
  const { texture, ratio, echelle } = useMemo(
    () => dessiner(texte, { couleur, contour, lueur, espacement, graisse, bloom, holo, relief, aura }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texte, couleur, contour, lueur, espacement, graisse, bloom, holo, relief, aura, prete],
  )
  useEffect(() => () => texture.dispose(), [texture])
  const [survol, setSurvol] = useState(false)
  useCursor(survol && !!onClick)
  const hauteurTotale = hauteur * echelle
  const materiau = useRef<MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (!materiau.current) return
    const t = clock.elapsedTime
    materiau.current.opacity = holo ? 0.9 + Math.sin(t * 1.6) * 0.05 : 1
  })

  return (
    <group position={position} rotation-y={lacet}>
      <mesh
        rotation-x={-Math.PI / 2}
        {...(onClick || onSurvol ? {} : { raycast: () => null })}
        onClick={
          onClick &&
          ((e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick()
          })
        }
        onPointerOver={(e) => {
          if (!onClick && !onSurvol) return
          e.stopPropagation()
          setSurvol(true)
          onSurvol?.(true)
        }}
        onPointerOut={() => {
          setSurvol(false)
          onSurvol?.(false)
        }}
      >
        <planeGeometry args={[hauteurTotale * ratio, hauteurTotale]} />
        <meshBasicMaterial ref={materiau} map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
