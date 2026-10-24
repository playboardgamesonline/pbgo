"use client"

import type { Texture } from "three"

export type SurfaceProps = {
  /** Width and depth of the mat, in world units */
  size: [width: number, depth: number]
  /** The outline of the mat (default "ellipse") */
  shape?: "ellipse" | "rectangle"
  /** The picture of the mat. It is shown as it is: no light and no tone mapping touch it */
  map?: Texture
  /** The colour of the mat; it tints the picture when there is one (default white) */
  color?: string
  /** A band of this colour and width all around the mat, outside `size` */
  rim?: { width: number; color: string }
}

// The rim and the mat lie flat, over the floor and under the cards, which rest higher (see `RESTING_HEIGHT`)
const HEIGHT = { rim: 0, mat: 0.005 }

type PlateProps = {
  shape: NonNullable<SurfaceProps["shape"]>
  width: number
  depth: number
  height: number
  color: string
  map?: Texture
}

/** A flat shape on the table: a unit circle or square stretched to the size asked for */
function Plate({ shape, width, depth, height, color, map }: PlateProps) {
  const [x, z] = shape === "rectangle" ? [width, depth] : [width / 2, depth / 2]
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={height} scale={[x, z, 1]} raycast={() => null}>
      {shape === "rectangle" ? <planeGeometry args={[1, 1]} /> : <circleGeometry args={[1, 96]} />}
      <meshBasicMaterial color={color} map={map} toneMapped={false} />
    </mesh>
  )
}

/** The mat the cards are played on, with an optional rim. It takes no clicks: the cards on it do */
export function Surface({ size: [width, depth], shape = "ellipse", map, color = "#ffffff", rim }: SurfaceProps) {
  return (
    <>
      {rim && <Plate shape={shape} width={width + 2 * rim.width} depth={depth + 2 * rim.width} height={HEIGHT.rim} color={rim.color} />}
      <Plate shape={shape} width={width} depth={depth} height={HEIGHT.mat} color={color} map={map} />
    </>
  )
}
