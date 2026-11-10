"use client"

import { useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"
import { type PerspectiveCamera, RepeatWrapping, type Texture } from "three"
import { FLOOR_OVERRIDE } from "../debug/overrides"
import { useSettingsVersion } from "../debug/settings"

export type SurfaceProps = {
  /** The colour of the table, and of everything beyond it: a picture fades into it with distance, so the table has no edge and no horizon. With a picture, give the picture's average colour */
  color: string
  /** A seamless picture that repeats over the whole table: felt, linen, wood. It is shown as it is: no light and no tone mapping touch it */
  map?: Texture
  /** How many world units one repeat of the picture covers (default `SURFACE_TILE`) */
  tile?: number
}

/** World units one repeat of the picture covers unless told otherwise */
export const SURFACE_TILE = 2

/** How many times the camera's `far` the table is wide, so that wherever the camera stands, the edge of the table lies past where the fog has hidden it */
const REACH = 3

/** Where the fog starts, as a share of the camera's `far`: the cards and the seats lie nearer, so only the picture of the table fades */
const FOG_START = 0.5

/** Keeps the picture sharp where the table runs off toward the horizon */
const ANISOTROPY = 8

/** The table the cards lie on, endless: its colour is the one the canvas is cleared to, so it reaches every way the camera can look, and a picture repeats over a plane far wider than the camera sees and fades into that colour. It takes no clicks. What the Floor folder of the debug panel changed lies over the props */
export function Surface(props: SurfaceProps) {
  useSettingsVersion()
  const { color, map, tile = SURFACE_TILE } = { ...props, ...FLOOR_OVERRIDE }
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
      {picture && (
        <>
          <fog attach="fog" args={[color, far * FOG_START, far]} />
          <mesh rotation-x={-Math.PI / 2} renderOrder={-1} raycast={() => null}>
            <planeGeometry args={[width, width]} />
            <meshBasicMaterial map={picture} toneMapped={false} />
          </mesh>
        </>
      )}
    </>
  )
}
