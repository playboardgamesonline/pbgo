import { type BufferGeometry, Float32BufferAttribute, Quaternion, Vector3 } from "three"

/** The light a die is lit by. The table is flat and unlit, so a die carries its own: a fixed light that brightens the faces turned toward it as the die turns, and a glint where a face is half way between the light and the viewer */
export type DieLight = {
  /** Toward the light, unit length, in the world's frame (y up, the viewer on the +z side) */
  direction: Vector3
  /** Toward the viewer, unit length */
  view: Vector3
  /** The share of light every face gets, whatever way it looks */
  ambient: number
  /** The share a face gets by looking straight at the light */
  diffuse: number
  /** The strength of the glint */
  specular: number
  /** How tight the glint is: the higher, the smaller */
  shininess: number
}

export const DIE_LIGHT: DieLight = {
  direction: new Vector3(-0.35, 1, 0.55).normalize(),
  view: new Vector3(0, 0.8, 0.6).normalize(),
  ambient: 0.56,
  diffuse: 0.5,
  specular: 0.28,
  shininess: 28,
}

const half = new Vector3()
const turned = new Vector3()

/** How bright a face that looks along `normal` (in the world's frame, unit length) is: the ambient light, the light it faces and the glint */
export function brightness(normal: Vector3, light: DieLight = DIE_LIGHT): number {
  half.copy(light.direction).add(light.view).normalize()
  const lit = Math.max(0, normal.dot(light.direction))
  const glint = Math.max(0, normal.dot(half)) ** light.shininess
  return light.ambient + light.diffuse * lit + light.specular * glint
}

/**
 * Lights a die's vertices for the way it is turned: writes into `out` one grey per vertex, from the normals of the geometry (in the die's own frame) turned by `quaternion`.
 * It is the whole shading of a die, so a face is darker when it looks away from the light and a bevel catches the glint as the die rolls.
 */
export function shadeVertices(normals: ArrayLike<number>, quaternion: Quaternion, out: Float32Array, light: DieLight = DIE_LIGHT): void {
  for (let i = 0; i < normals.length / 3; i++) {
    turned.set(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!).applyQuaternion(quaternion)
    const grey = brightness(turned, light)
    out[i * 3] = grey
    out[i * 3 + 1] = grey
    out[i * 3 + 2] = grey
  }
}

/**
 * `shadeVertices` for a solid whose surface is not all of one colour: each vertex also has a `tint`, a share of the light it keeps (1 for the cloth of a bag or the outside of a cup, less for the dark of its inside), and its grey is the brightness
 * of the way it faces times that tint.
 */
export function shadeTinted(normals: ArrayLike<number>, tints: ArrayLike<number>, quaternion: Quaternion, out: Float32Array, light: DieLight = DIE_LIGHT): void {
  for (let i = 0; i < normals.length / 3; i++) {
    turned.set(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!).applyQuaternion(quaternion)
    const grey = brightness(turned, light) * tints[i]!
    out[i * 3] = grey
    out[i * 3 + 1] = grey
    out[i * 3 + 2] = grey
  }
}

/** A solid lit for the way it stands, once: a grey per vertex from the way each faces (in a `color` attribute), which the colour of the material tints. A solid that never turns, a knob, a rail, a pawn on a track, carries its light this way and needs none from the table */
export function litGeometry(geometry: BufferGeometry): BufferGeometry {
  const colors = new Float32Array(geometry.getAttribute("position").count * 3)
  shadeVertices(geometry.getAttribute("normal").array, new Quaternion(), colors)
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3))
  return geometry
}
