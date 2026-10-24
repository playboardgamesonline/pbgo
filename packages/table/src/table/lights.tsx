"use client"

export type LightsProps = {
  /** Strength of the light that falls everywhere alike (default 0.8) */
  ambient?: number
  /** Strength of the sun, the light that gives the cards their shade (default 2.2) */
  sun?: number
  /** Where the sun stands; it shines towards the middle of the table (default [4, 12, 6]) */
  sunPosition?: [x: number, y: number, z: number]
}

/** The lights of a table: the ones Courtisans plays under */
export const DEFAULT_LIGHTS = { ambient: 0.8, sun: 2.2, sunPosition: [4, 12, 6] } satisfies Required<LightsProps>

/** An ambient light and a sun. Only a lit material shows them: the flat ones of the template do not need any */
export function Lights({ ambient = DEFAULT_LIGHTS.ambient, sun = DEFAULT_LIGHTS.sun, sunPosition = DEFAULT_LIGHTS.sunPosition }: LightsProps) {
  return (
    <>
      <ambientLight intensity={ambient} />
      <directionalLight position={sunPosition} intensity={sun} />
    </>
  )
}
