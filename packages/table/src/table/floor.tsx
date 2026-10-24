"use client"

export type FloorProps = {
  /** The colour of the room around the table: the skin's dark surface, so the room matches the page behind the canvas */
  color: string
  /** Width and depth of the floor in world units, one number for a square (default 400): wider than anything the camera sees, so the table has no edge */
  size?: number | [width: number, depth: number]
}

/** Just under the surface and the cards, so nothing sinks into it */
const FLOOR_HEIGHT = -0.02

/** The room around the table: a flat colour that reaches past the camera's view, under everything */
export function Floor({ color, size = 400 }: FloorProps) {
  const [width, depth] = typeof size === "number" ? [size, size] : size
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_HEIGHT} raycast={() => null}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}
