"use client"

import { useThree } from "@react-three/fiber"
import { button, useControls } from "leva"
import { useEffect } from "react"
import { type Object3D, PerspectiveCamera, Vector2 } from "three"
import { useReglages } from "./reglages"
import { onglet } from "./onglets-debug"

export const REGLAGES_PHOTO = {
  inclinaison: 34,
  lacet: 0,
  distance: 50,
  fov: 28,
  cibleX: 0,
  cibleZ: -0.8,
}

const RAD = Math.PI / 180
let capturer: ((largeur: number, hauteur: number) => HTMLCanvasElement) | null = null

export function photographierPartie(largeur: number, hauteur: number) {
  return capturer?.(largeur, hauteur) ?? null
}

export function PhotoPartie() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useReglages(
    "Share Photo",
    REGLAGES_PHOTO,
    {
      inclinaison: ["tilt °", 0, 85, 0.5],
      lacet: ["yaw °", -180, 180, 1],
      distance: ["distance", 8, 90, 0.1],
      fov: ["fov °", 10, 100, 0.5],
      cibleX: ["target x", -10, 10, 0.05],
      cibleZ: ["target z", -10, 10, 0.05],
    },
    { ordre: 14 },
  )
  useControls(
    "Share Photo",
    {
      "Download test photo": button(() => {
        const c = photographierPartie(1600, 1200)
        if (!c) return
        const a = document.createElement("a")
        a.href = c.toDataURL("image/png")
        a.download = "photo-partie.png"
        a.click()
      }),
    },
    { collapsed: true, order: 14 },
    onglet("SCENE"),
  )

  useEffect(() => {
    capturer = (largeur, hauteur) => {
      const r = REGLAGES_PHOTO
      const cam = new PerspectiveCamera(r.fov, largeur / hauteur, 0.1, 300)
      const incl = r.inclinaison * RAD
      const lacet = r.lacet * RAD
      cam.position.set(
        r.cibleX + r.distance * Math.sin(incl) * Math.sin(lacet),
        Math.max(0.5, r.distance * Math.cos(incl)),
        r.cibleZ + r.distance * Math.sin(incl) * Math.cos(lacet),
      )
      cam.lookAt(r.cibleX, 0, r.cibleZ)
      cam.updateMatrixWorld()

      const masques: Object3D[] = []
      scene.traverse((o) => {
        if (o.userData.horsPhoto && o.visible) masques.push(o)
      })
      masques.forEach((o) => (o.visible = false))

      const taille = gl.getSize(new Vector2())
      const dpr = gl.getPixelRatio()
      const sortie = document.createElement("canvas")
      sortie.width = largeur
      sortie.height = hauteur
      try {
        gl.setPixelRatio(1)
        gl.setSize(largeur, hauteur, false)
        gl.render(scene, cam)
        sortie.getContext("2d")!.drawImage(gl.domElement, 0, 0, largeur, hauteur)
      } finally {
        masques.forEach((o) => (o.visible = true))
        gl.setPixelRatio(dpr)
        gl.setSize(taille.x, taille.y, false)
        gl.render(scene, camera)
      }
      return sortie
    }
    return () => {
      capturer = null
    }
  }, [gl, scene, camera])

  return null
}
