"use client"

import { useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { AdditiveBlending, CanvasTexture, type PerspectiveCamera, RepeatWrapping, SRGBColorSpace, type Texture } from "three"
import { FLOOR_OVERRIDE } from "../debug/overrides"
import { useSettingsVersion } from "../debug/settings"
import { poolStops } from "./mat-field"

/** A pool of light on the middle of the table, as a vignette is: the table is lit there and falls away to its own colour toward its far parts */
export type SurfaceLight = {
  /** `#rrggbb`: the light added to the table at the middle of the pool. Dark: a light that is seen is a spotlight and no vignette (a mat of `#0d0d10` lit with `#2a2b30` reads as dark grey in the middle and black at the edges) */
  color: string
  /** How far the pool reaches, in world units (default `LIGHT_RADIUS`) */
  radius?: number
  /** Where its middle lies on the table (default the middle of the table) */
  at?: { x: number; z: number }
}

export type SurfaceProps = {
  /** The colour of the table, and of everything beyond it: a picture fades into it with distance, so the table has no edge and no horizon. With a picture, give the picture's average colour */
  color: string
  /** A seamless picture that repeats over the whole table: felt, linen, wood. It is shown as it is: no light and no tone mapping touch it */
  map?: Texture
  /** How many world units one repeat of the picture covers (default `SURFACE_TILE`) */
  tile?: number
  /** A pool of light on the table: lit at its middle and darker toward the edges, drawn on the table and under everything, so the cards and the plates are not darkened by it. It is added to the colour and the picture, so the picture shows through everywhere alike */
  light?: SurfaceLight
}

/** How far a pool of light reaches unless told otherwise: a little past the far seats of a table of eight */
export const LIGHT_RADIUS = 20

/** World units one repeat of the picture covers unless told otherwise */
export const SURFACE_TILE = 2

/** How many times the camera's `far` the table is wide, so that wherever the camera stands, the edge of the table lies past where the fog has hidden it */
const REACH = 3

/** Where the fog starts, as a share of the camera's `far`: the cards and the seats lie nearer, so only the picture of the table fades */
const FOG_START = 0.5

/** How far the table is pushed back in the depth buffer, in the units of `polygonOffset`: the surface is one plane a thousand units wide, whose depth is not exact over such a size, so what lies a hair above it (the plates of a board, the line of a zone) would sink into it where the camera looks from far away */
const POLYGON_OFFSET = 4

/** Keeps the picture sharp where the table runs off toward the horizon */
const ANISOTROPY = 8

/** How high above the table the pool of light lies: a hair, over the surface and under everything that stands on it */
const LIGHT_Y = 0.002

/** One radial gradient for a colour: black at its edge, the colour of the light at its middle, the pool of light added over the table */
function poolTexture(color: string): CanvasTexture {
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const { at, rgb } of poolStops(color)) gradient.addColorStop(at, rgb)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Pool({ color, radius = LIGHT_RADIUS, at }: SurfaceLight) {
  const map = useMemo(() => poolTexture(color), [color])
  useEffect(() => () => map.dispose(), [map])
  return (
    <mesh position={[at?.x ?? 0, LIGHT_Y, at?.z ?? 0]} rotation-x={-Math.PI / 2} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      {/* Added to the table, not laid over it; and not fogged, which would add the table's colour to the far side of the pool */}
      <meshBasicMaterial map={map} blending={AdditiveBlending} transparent depthWrite={false} fog={false} toneMapped={false} polygonOffset polygonOffsetFactor={POLYGON_OFFSET - 2} polygonOffsetUnits={POLYGON_OFFSET - 2} />
    </mesh>
  )
}

/** The table the cards lie on, endless: its colour is the one the canvas is cleared to, so it reaches every way the camera can look, and a picture repeats over a plane far wider than the camera sees and fades into that colour. It takes no clicks. What the Floor folder of the debug panel changed lies over the props */
export function Surface(props: SurfaceProps) {
  useSettingsVersion()
  const { color, map, tile = SURFACE_TILE, light } = { ...props, ...FLOOR_OVERRIDE }
  const far = useThree((s) => (s.camera as PerspectiveCamera).far)
  const width = far * REACH
  const repeat = width / tile
  // The table's own copy, so the game's texture keeps its wrapping and its repeat
  const picture = useMemo(() => {
    if (!map) return null
    const copy = map.clone()
    copy.wrapS = copy.wrapT = RepeatWrapping
    copy.repeat.set(repeat, repeat)
    copy.anisotropy = Math.max(copy.anisotropy, ANISOTROPY)
    copy.needsUpdate = true
    return copy
  }, [map, repeat])
  useEffect(() => () => picture?.dispose(), [picture])

  return (
    <>
      <color attach="background" args={[color]} />
      {light && <Pool {...light} />}
      {picture && (
        <>
          <fog attach="fog" args={[color, far * FOG_START, far]} />
          <mesh rotation-x={-Math.PI / 2} renderOrder={-1} raycast={() => null}>
            <planeGeometry args={[width, width]} />
            <meshBasicMaterial map={picture} toneMapped={false} polygonOffset polygonOffsetFactor={POLYGON_OFFSET} polygonOffsetUnits={POLYGON_OFFSET} />
          </mesh>
        </>
      )}
    </>
  )
}
