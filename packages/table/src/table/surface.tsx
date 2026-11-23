"use client"

import { useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { AdditiveBlending, CanvasTexture, type PerspectiveCamera, RepeatWrapping, SRGBColorSpace, type Texture } from "three"
import { FLOOR_OVERRIDE } from "../debug/overrides"
import { useSettingsVersion } from "../debug/settings"
import { bakeMat, MAT_SIZE, type MatLayer, matKey } from "./mat"
import { lightBetween, poolPixels } from "./mat-field"

/** A faint wheel of colours that turns through a pool of light, as a conic gradient does: the card back of a game that is a rainbow lights its table so */
export type PoolGlow = {
  /** The colours of the wheel, going round once: give the first again at the end, so that the circle closes with no seam */
  colors: readonly string[]
  /** How strong it is where it is brightest, 0 to 1 (default 0.14): low, so that the cards stay the brightest colours of the table */
  strength?: number
}

/** A pool of light on the middle of the table, as a vignette is: the table is lit there and falls away to its own colour toward its far parts */
export type SurfaceLight = {
  /** `#rrggbb`: the light added to the table at the middle of the pool. Dark: a light that is seen is a spotlight and no vignette (a mat of `#0d0d10` lit with `#2a2b30` reads as dark grey in the middle and black at the edges). Give this or `center` */
  color?: string
  /** `#rrggbb`: the colour the table has at the middle of the pool, which is what a game's settings say (`surface`, in the middle, over `surfaceDark`, beyond). The light is what it has more than the table's own colour, channel by channel. Instead of `color` */
  center?: string
  /** How far the pool reaches, in world units (default `LIGHT_RADIUS`) */
  radius?: number
  /** Where its middle lies on the table (default the middle of the table) */
  at?: { x: number; z: number }
  /** A faint wheel of colours turning through the pool */
  glow?: PoolGlow
}

export type SurfaceProps = {
  /** The colour of the table, and of everything beyond it: a picture fades into it with distance, so the table has no edge and no horizon. It is the bottom of the mat: the layers are laid over it */
  color: string
  /** What lies on the table, from the bottom up, each layer laid over what is below it: a lattice, a mosaic, a grain, a picture of the game's own (wood, stone, leather, cloth) with the blend that suits it, a flat colour. They are baked once into one seamless picture that repeats over the whole table (`MatLayer`) */
  layers?: readonly MatLayer[]
  /** Pixels across the baked picture of the layers, a power of two (default `MAT_SIZE`): more for a picture with detail that is seen up close */
  resolution?: number
  /**
   * A seamless picture that repeats over the whole table, made by the game. It is shown as it is: no light and no tone mapping touch it.
   * @deprecated Say `layers`: the table bakes the picture itself, once, and a game paints none and keeps none
   */
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

/** Pixels across the picture of a pool of light: a gradient, so a few hundred are plenty */
const POOL_SIZE = 512

/** The default strength of the wheel of colours of a pool */
const GLOW_STRENGTH = 0.14

/** The picture of a pool of light for a colour: black at its edge, the colour of the light at its middle, each level dithered so that it does not band, and the wheel of colours of the glow added over it. It is added to the table */
function poolTexture(color: string, glow?: PoolGlow): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = POOL_SIZE
  const ctx = canvas.getContext("2d")!
  const image = ctx.createImageData(POOL_SIZE, POOL_SIZE)
  image.data.set(poolPixels(color, POOL_SIZE))
  ctx.putImageData(image, 0, 0)
  if (glow && glow.colors.length > 0) {
    const strength = glow.strength ?? GLOW_STRENGTH
    // The wheel, kept to the middle by a radial mask, then added over the pool
    const wheel = document.createElement("canvas")
    wheel.width = wheel.height = POOL_SIZE
    const g = wheel.getContext("2d")!
    const cone = g.createConicGradient(-Math.PI / 2, POOL_SIZE / 2, POOL_SIZE / 2)
    glow.colors.forEach((colour, i) => cone.addColorStop(i / Math.max(1, glow.colors.length - 1), colour))
    g.fillStyle = cone
    g.fillRect(0, 0, POOL_SIZE, POOL_SIZE)
    g.globalCompositeOperation = "destination-in"
    const mask = g.createRadialGradient(POOL_SIZE / 2, POOL_SIZE / 2, 0, POOL_SIZE / 2, POOL_SIZE / 2, POOL_SIZE / 2)
    mask.addColorStop(0, `rgba(0,0,0,${strength})`)
    mask.addColorStop(0.45, `rgba(0,0,0,${strength * 0.7})`)
    mask.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = mask
    g.fillRect(0, 0, POOL_SIZE, POOL_SIZE)
    ctx.globalCompositeOperation = "lighter"
    ctx.drawImage(wheel, 0, 0)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Pool({ light, table }: { light: SurfaceLight; table: string }) {
  const { radius = LIGHT_RADIUS, at, glow } = light
  // The light added to the table: the one asked for, or what the middle of the pool has more than the table
  const color = light.center ? lightBetween(light.center, table) : (light.color ?? "#000000")
  const wheel = glow ? JSON.stringify(glow) : ""
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `wheel` is `glow` as text: a game may make its glow again on every render, and the picture is painted again only when it changed
  const map = useMemo(() => poolTexture(color, glow), [color, wheel])
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
  const { color, layers, resolution = MAT_SIZE, map, tile = SURFACE_TILE, light } = { ...props, ...FLOOR_OVERRIDE }
  const far = useThree((s) => (s.camera as PerspectiveCamera).far)
  const width = far * REACH
  const repeat = width / tile
  // The layers baked into one picture, once for each mat: a game may make them again on every render, and the key is the same while they are
  const key = layers && layers.length > 0 ? matKey(color, layers, resolution) : ""
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` says whether the colour, the layers or the resolution changed, and the layers are read from here only to bake them
  const baked = useMemo(() => (key ? bakeMat(color, layers ?? [], resolution) : null), [key])
  useEffect(() => () => baked?.dispose(), [baked])
  const source = baked ?? map
  // The table's own copy, so the game's texture keeps its wrapping and its repeat
  const picture = useMemo(() => {
    if (!source) return null
    const copy = source.clone()
    copy.wrapS = copy.wrapT = RepeatWrapping
    copy.repeat.set(repeat, repeat)
    copy.anisotropy = Math.max(copy.anisotropy, ANISOTROPY)
    copy.needsUpdate = true
    return copy
  }, [source, repeat])
  useEffect(() => () => picture?.dispose(), [picture])

  return (
    <>
      <color attach="background" args={[color]} />
      {light && <Pool light={light} table={color} />}
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
