import type { BufferGeometry, Material } from "three"
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js"

/** How dark the grey of a card that is out is, as a share of its own brightness */
export const GREY_SHADE = 0.5

export type FoldUniforms = Record<string, { value: number }>

const foldables = new Map<BufferGeometry, BufferGeometry>()

/** The geometry cut into small triangles (edges no longer than `size`), so that a shader can bend it. Cut once per geometry */
export function foldable(geo: BufferGeometry, size: number) {
  let g = foldables.get(geo)
  if (!g) {
    g = new TessellateModifier(size, 8).modify(geo)
    foldables.set(geo, g)
  }
  return g
}

/**
 * Makes a material arch along its height by `uFold` (and grey by `uGrey`, 0 to 1, if it is given) (a fraction of the half height `uHalfH`, towards `uDir`), the way a card in flight bends.
 * The uniforms are the caller's: it moves `uFold` every frame. A material is patched once; asking again only brings the values it already uses up to date.
 */
export function applyFold(m: Material | null, uniforms: FoldUniforms) {
  if (!m) return
  const patched = m.userData.folded as FoldUniforms | undefined
  if (patched) {
    for (const [name, uniform] of Object.entries(uniforms)) if (patched[name] && patched[name] !== uniform) patched[name].value = uniform.value
    return
  }
  m.userData.folded = uniforms
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uFold;\nuniform float uHalfH;\nuniform float uDir;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat pyPli = clamp(position.y / uHalfH, -1.0, 1.0);\ntransformed.z += uDir * uFold * uHalfH * (1.0 - pyPli * pyPli);",
      )
    // The grey filter of a card that is out: `uGrey` (0 to 1) takes the colour out of what is drawn and darkens it, on the picture's own pixels
    if (shader.fragmentShader) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uGrey;")
        .replace("#include <dithering_fragment>", "float pyLuma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(pyLuma * GREY_SHADE), uGrey);\n#include <dithering_fragment>")
      shader.fragmentShader = `#define GREY_SHADE ${GREY_SHADE.toFixed(2)}\n${shader.fragmentShader}`
    }
  }
  m.customProgramCacheKey = () => "pli"
  m.needsUpdate = true
}
