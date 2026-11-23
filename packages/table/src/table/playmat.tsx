"use client"

import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import { CanvasTexture, type Mesh, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type Texture, Vector2 } from "three"
import { cardGeometry, edgeGeometry } from "../card/geometry"
import type { Spot } from "../layout"
import type { Blend } from "./mat"
import { BLEND_GLSL, BLEND_INDEX, PLAYMAT, rollerAt, type Unroll, unrollClock } from "./playmat-look"

/** A cloth laid over the picture of a playmat: the weave a printed picture has under it */
export type PlaymatCloth = {
  /** The weave: a seamless colour picture of the game's own (an sRGB texture), repeated across the playmat. Null lays none, which a game gives while its picture loads */
  picture: Texture | null
  /** How it is laid over the playmat's picture (`PLAYMAT.blend`, soft light, when not given) */
  blend?: Blend
  /** How strongly, 0 to 1 (`PLAYMAT.strength`, 0.8, when not given) */
  strength?: number
  /** How many world units one repeat of the picture covers (`PLAYMAT.tile`, 2, when not given) */
  tile?: number
}

export type PlaymatProps = {
  /** How big the playmat is on the table, in world units: its width along x and its depth along z, and the radius of its corners (`PLAYMAT.rounding` of its shorter side when not given) */
  size: { width: number; depth: number; radius?: number }
  /** Where it lies on the table and which way it faces (default: the middle, unturned). It rolls out from its left edge toward its right one, in its own frame */
  frame?: Spot
  /** The picture on its face, the game's own, stretched over the whole playmat edge to edge. Null draws `color` */
  picture?: Texture | null
  /** The colour of its face when it has no picture, and the one its rim takes from it (default a dark grey) */
  color?: string
  /** A cloth laid over the picture */
  cloth?: PlaymatCloth
  /** How much colour the picture is stripped of, 0 to 1 (default 0): a picture made for a screen is a touch loud for a table */
  desaturate?: number
  /** How thick its rim is, and how high it lies above the table (`PLAYMAT.thickness` when not given) */
  thickness?: number
  /** How it is: `rolled` is still rolled up and waiting, `unrolling` rolls out and then stays out, `flat` is laid out (default). A board holds it rolled while its start screen is up, rolls it out when the opening begins and lays it flat after */
  unroll?: Unroll
  /** Seconds it waits before it begins to roll out, and takes to do it (`PLAYMAT.delay` and `PLAYMAT.duration` when not given) */
  delay?: number
  duration?: number
  /** The colour of the roll of cloth at the front of the part that has rolled out (default the colour of the face) */
  roller?: string
  /** Called once when a roll-out ends. A visitor who asks for less motion gets the playmat laid flat at once, so it is called at once for them */
  onUnrolled?: () => void
}

/** The cap of the rim, which is not drawn: a playmat is a face and a rim, and the caps of the extruded rim are the face's own */
const HIDDEN = new MeshBasicMaterial({ visible: false })

/** Keeps the picture of the cloth sharp where the playmat runs off toward the horizon */
const ANISOTROPY = 8

/** What the rim reads of the picture: the edge of it, kept off the very border so that it does not wrap to the other side */
const clampUv = (n: number) => Math.min(0.998, Math.max(0.002, n))

const DECLARATIONS = /* glsl */ `
uniform vec2 uSize;
uniform float uUnroll;
uniform float uDesat;
uniform sampler2D uCloth;
uniform float uWithCloth;
uniform float uTile;
uniform float uMode;
uniform float uStrength;`

// The picture is laid as the material reads it, then: what is not yet rolled out is cut (from the left, along the picture's own x), the colour is taken out of it a little, and the cloth is laid over it with the blend, in the space of what the screen shows, which is
// where the blends are made for (the picture is in linear light here). The cloth repeats every `uTile` world units.
const FRAGMENT = /* glsl */ `
#include <map_fragment>
{
  if (vMapUv.x > uUnroll) discard;
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l), uDesat);
  if (uWithCloth > 0.5) {
    vec3 a = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
    vec3 b = pow(texture2D(uCloth, vMapUv * uSize / uTile).rgb, vec3(1.0 / 2.2));
    diffuseColor.rgb = pow(mix(a, clamp(blendCloth(a, b, uMode), 0.0, 1.0), uStrength), vec3(2.2));
  }
}`

/** What the shader reads, moved every frame: how much is rolled out, the colour taken out of the picture, the cloth and how it is laid */
function makeUniforms() {
  return {
    uSize: { value: new Vector2(1, 1) },
    uUnroll: { value: 1 },
    uDesat: { value: 0 },
    uCloth: { value: null as Texture | null },
    uWithCloth: { value: 0 },
    uTile: { value: PLAYMAT.tile as number },
    uMode: { value: BLEND_INDEX[PLAYMAT.blend] },
    uStrength: { value: PLAYMAT.strength as number },
  }
}
type PlaymatUniforms = ReturnType<typeof makeUniforms>

/** How dark the roll of cloth is underneath and at its sides, against 1 on top where the light falls */
const ROLL_SHADE = 0.35

/** The shade round a roll of cloth, painted once and laid over its colour: bright on top and dark where the cloth turns away, so that the roll reads as a cylinder with no light in the scene (the table's materials are unlit, and a lit one would be black wherever a board has no lights). The cylinder's picture goes round it from u = 0 under it to u = 0.5 on top */
function shadeTexture(): Texture {
  const texels = 64
  const canvas = document.createElement("canvas")
  canvas.width = texels
  canvas.height = 2
  const ctx = canvas.getContext("2d")!
  const image = ctx.createImageData(texels, 2)
  for (let x = 0; x < texels; x++) {
    const light = 0.5 + 0.5 * Math.cos(2 * Math.PI * ((x + 0.5) / texels - 0.5))
    const shade = Math.round(255 * (ROLL_SHADE + (1 - ROLL_SHADE) * light))
    for (let y = 0; y < 2; y++) image.data.set([shade, shade, shade, 255], (y * texels + x) * 4)
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** The face of a playmat that has no picture: its colour, as a picture of one texel, so that the shader reads the same either way */
function solidTexture(color: string): Texture {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * A playmat: a bounded mat laid on the table, a rounded rectangle with a rim that has a picture on its face, a cloth over the picture, and that can be rolled up and roll out. It is the mat of a game that has one on its table, as a card game has its playmat, where the endless
 * surface of the table is the cloth under it (`Surface`). The picture is the game's own, and so is the cloth: the table makes none.
 *
 * Rolling out: asked to `unrolling`, the playmat waits, then rolls out from its left edge toward its right one, fast at first and slowing to settle, with a roll of cloth at the front of the part that is out that shrinks as the cloth is let out. A board holds it `rolled` while it
 * waits for its opening, rolls it out when the opening begins and lays it `flat` after. A visitor who asks for less motion gets it laid flat at once.
 *
 * The cloth is laid in the shader with the blend and the strength it is given, every frame, so a game can tune both live. Nothing here is lit, like the rest of the table, and nothing takes a click: the playmat is the table's, and what lies on it is the game's.
 */
export function Playmat({ size, frame, picture = null, color = "#20242a", cloth, desaturate = 0, thickness = PLAYMAT.thickness, unroll = "flat", delay, duration, roller, onUnrolled }: PlaymatProps) {
  const reduced = usePrefersReducedMotion()
  const { width, depth } = size
  const radius = size.radius ?? Math.min(width, depth) * PLAYMAT.rounding

  // The face: the game's picture, or its colour as a picture of one texel
  const face = useMemo(() => picture ?? solidTexture(color), [picture, color])
  useEffect(
    () => () => {
      // the picture is the game's, and it keeps it
      if (face !== picture) face.dispose()
    },
    [face, picture],
  )

  // The table's own copy of the cloth, so the game's texture keeps its wrapping
  const clothMap = useMemo(() => {
    const source = cloth?.picture
    if (!source) return null
    const copy = source.clone()
    copy.wrapS = copy.wrapT = RepeatWrapping
    copy.colorSpace = SRGBColorSpace
    copy.anisotropy = Math.max(copy.anisotropy, ANISOTROPY)
    copy.needsUpdate = true
    return copy
  }, [cloth?.picture])
  useEffect(() => () => clothMap?.dispose(), [clothMap])

  // The material of the face and of the rim: the picture, patched once to cut what is not yet rolled out and to lay the cloth. Its uniforms are kept with it and moved every frame, read back from the face's mesh
  const material = useMemo(() => {
    const uniforms = makeUniforms()
    const m = new MeshBasicMaterial({ map: face, toneMapped: false })
    m.userData.uniforms = uniforms
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${DECLARATIONS}\n${BLEND_GLSL}`).replace("#include <map_fragment>", FRAGMENT)
    }
    return m
  }, [face])
  useEffect(() => () => material.dispose(), [material])

  // The face, and the rim: the rim reads the edge of the picture, so that it is the colour of the border of the playmat and rolls out with it. The face's geometry is the cards', one for each size, and the rim's is its own copy, whose picture coordinates are laid over the playmat
  const top = useMemo(() => cardGeometry(width, depth, radius), [width, depth, radius])
  const rim = useMemo(() => {
    const geometry = edgeGeometry(width, depth, thickness, radius).clone()
    const position = geometry.attributes.position!
    const uv = geometry.attributes.uv!
    for (let i = 0; i < position.count; i++) uv.setXY(i, clampUv(position.getX(i) / width + 0.5), clampUv(position.getY(i) / depth + 0.5))
    uv.needsUpdate = true
    return geometry
  }, [width, depth, thickness, radius])
  useEffect(() => () => rim.dispose(), [rim])

  const shade = useMemo(() => shadeTexture(), [])
  useEffect(() => () => shade.dispose(), [shade])
  const faceMesh = useRef<Mesh>(null)
  const roll = useRef<Mesh>(null)
  const started = useRef<number | null>(null)
  const told = useRef(false)
  const latest = useRef(onUnrolled)
  useEffect(() => {
    latest.current = onUnrolled
  })
  useFrame(({ clock }) => {
    const uniforms = (faceMesh.current?.material as MeshBasicMaterial | undefined)?.userData.uniforms as PlaymatUniforms | undefined
    if (!uniforms) return
    // A visitor who asks for less motion gets a playmat that is asked to roll out laid flat at once
    const mode: Unroll = reduced && unroll === "unrolling" ? "flat" : unroll
    const step = unrollClock(mode, started.current, clock.elapsedTime, { delay, duration })
    started.current = step.started
    uniforms.uSize.value.set(width, depth)
    uniforms.uUnroll.value = step.progress
    uniforms.uDesat.value = desaturate
    uniforms.uCloth.value = clothMap
    uniforms.uWithCloth.value = clothMap ? 1 : 0
    uniforms.uTile.value = cloth?.tile ?? PLAYMAT.tile
    uniforms.uMode.value = BLEND_INDEX[cloth?.blend ?? PLAYMAT.blend]
    uniforms.uStrength.value = cloth?.strength ?? PLAYMAT.strength
    const at = rollerAt(step.progress, { width, depth, thickness })
    const mesh = roll.current
    if (mesh) {
      mesh.visible = at.visible
      mesh.position.set(at.x, at.y, 0)
      mesh.scale.set(at.radius, 1, at.radius)
    }
    // Told once for each roll-out, when it ends
    if (unroll === "unrolling" && step.progress >= 1) {
      if (!told.current) {
        told.current = true
        latest.current?.()
      }
    } else {
      told.current = false
    }
  })

  return (
    <group position={[frame?.x ?? 0, 0, frame?.z ?? 0]} rotation-y={frame?.yaw ?? 0}>
      <mesh geometry={rim} rotation-x={-Math.PI / 2} material={[HIDDEN, material]} raycast={() => null} />
      <mesh ref={faceMesh} geometry={top} rotation-x={-Math.PI / 2} position-y={thickness + 0.001} material={material} raycast={() => null} />
      {/* The roll of cloth at the front of the part that has rolled out: a cylinder along the depth of the playmat */}
      <mesh ref={roll} rotation-x={Math.PI / 2} visible={false} raycast={() => null}>
        <cylinderGeometry args={[1, 1, depth, 32]} />
        <meshBasicMaterial color={roller ?? color} map={shade} toneMapped={false} />
      </mesh>
    </group>
  )
}
