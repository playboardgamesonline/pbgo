"use client"

import { useCursor } from "@react-three/drei"
import type { ThreeEvent } from "@react-three/fiber"
import { useEffect, useMemo, useState } from "react"
import { CanvasTexture, SRGBColorSpace } from "three"

const POLICE = '"Alegreya Variable", "Alegreya", Georgia, serif'
const TAILLE = 140

export type StyleTexte = { couleur: string; contour?: string; lueur?: string }

function dessiner(texte: string, style: StyleTexte) {
  const mesure = document.createElement("canvas").getContext("2d")!
  mesure.font = `800 ${TAILLE}px ${POLICE}`
  const marge = 60
  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(mesure.measureText(texte).width + marge * 2)
  canvas.height = Math.ceil(TAILLE * 1.35 + marge)
  const ctx = canvas.getContext("2d")!
  ctx.font = mesure.font
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
  ctx.fillStyle = style.couleur
  ctx.fillText(texte, x, y)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return { texture, ratio: canvas.width / canvas.height }
}

function usePolicePrete() {
  const [prete, setPrete] = useState(false)
  useEffect(() => {
    let actif = true
    Promise.resolve(document.fonts?.load(`800 ${TAILLE}px ${POLICE}`))
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
  const { couleur, contour, lueur } = style
  const { texture, ratio } = useMemo(
    () => dessiner(texte, { couleur, contour, lueur }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texte, couleur, contour, lueur, prete],
  )
  useEffect(() => () => texture.dispose(), [texture])
  const [survol, setSurvol] = useState(false)
  useCursor(survol && !!onClick)
  const hauteurTotale = hauteur * 1.6

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
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
