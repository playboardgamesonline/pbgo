import { MeshBasicMaterial } from "three"
import { describe, expect, it } from "vitest"
import { applyFold, foldable } from "./fold"
import { cardGeometry } from "./geometry"

type Shader = Parameters<MeshBasicMaterial["onBeforeCompile"]>[0]

/** The two lines of a vertex shader that `applyFold` hooks into, and nothing else */
const shaderOf = () => ({ uniforms: {}, vertexShader: "#include <common>\n#include <begin_vertex>" }) as unknown as Shader

const compile = (m: MeshBasicMaterial) => {
  const shader = shaderOf()
  m.onBeforeCompile(shader, undefined as never)
  return shader
}

const uniformsOf = (halfHeight = 0.95, dir = 1) => ({ uFold: { value: 0 }, uHalfH: { value: halfHeight }, uDir: { value: dir } })

describe("foldable", () => {
  it("cuts a card into smaller triangles, so a shader has something to bend", () => {
    const geo = cardGeometry(1.3, 1.9)
    const fine = foldable(geo, 0.26)
    expect(fine).not.toBe(geo)
    expect(fine.attributes.position!.count).toBeGreaterThan(geo.attributes.position!.count)
  })

  it("cuts a geometry once: the same geometry gives back the same cut", () => {
    const geo = cardGeometry(1.3, 1.9)
    expect(foldable(geo, 0.26)).toBe(foldable(geo, 0.26))
  })

  it("leaves no edge longer than the size asked, so the arch is smooth", () => {
    const size = 0.26
    const fine = foldable(cardGeometry(1.3, 1.9), size)
    const pos = fine.attributes.position!
    const edge = (i: number, j: number) => Math.hypot(pos.getX(i) - pos.getX(j), pos.getY(i) - pos.getY(j), pos.getZ(i) - pos.getZ(j))
    for (let i = 0; i < pos.count; i += 3) {
      expect(edge(i, i + 1)).toBeLessThanOrEqual(size + 1e-6)
      expect(edge(i + 1, i + 2)).toBeLessThanOrEqual(size + 1e-6)
      expect(edge(i + 2, i)).toBeLessThanOrEqual(size + 1e-6)
    }
  })
})

describe("applyFold", () => {
  it("hooks the card's uniforms into the material's vertex shader", () => {
    const m = new MeshBasicMaterial()
    const uniforms = uniformsOf()
    applyFold(m, uniforms)
    const shader = compile(m)
    // The uniforms are the caller's own objects: moving `uFold.value` moves the card
    expect(shader.uniforms.uFold).toBe(uniforms.uFold)
    expect(shader.uniforms.uHalfH).toBe(uniforms.uHalfH)
    expect(shader.uniforms.uDir).toBe(uniforms.uDir)
    expect(shader.vertexShader).toContain("uniform float uFold;")
    expect(shader.vertexShader).toContain("transformed.z += uDir * uFold * uHalfH")
  })

  it("keeps the shader's own lines: it only adds to them", () => {
    const m = new MeshBasicMaterial()
    applyFold(m, uniformsOf())
    const { vertexShader } = compile(m)
    expect(vertexShader.indexOf("#include <common>")).toBeLessThan(vertexShader.indexOf("uniform float uFold;"))
    expect(vertexShader.indexOf("#include <begin_vertex>")).toBeLessThan(vertexShader.indexOf("float pyPli"))
  })

  it("gives every folded material the same program: they share one compile", () => {
    const m = new MeshBasicMaterial()
    applyFold(m, uniformsOf())
    expect(m.customProgramCacheKey()).toBe("pli")
  })

  it("asks the renderer to build the program again, once", () => {
    const m = new MeshBasicMaterial()
    const before = m.version
    applyFold(m, uniformsOf())
    expect(m.version).toBe(before + 1)
    applyFold(m, uniformsOf())
    expect(m.version).toBe(before + 1)
  })

  it("patches a material once: asking again only brings the values it uses up to date", () => {
    const m = new MeshBasicMaterial()
    const first = uniformsOf(0.95)
    applyFold(m, first)
    const hook = m.onBeforeCompile
    applyFold(m, uniformsOf(1.2, -1))
    expect(m.onBeforeCompile).toBe(hook)
    expect(compile(m).uniforms.uHalfH).toBe(first.uHalfH)
    expect(first.uHalfH.value).toBe(1.2)
    expect(first.uDir.value).toBe(-1)
  })

  it("leaves no material alone to patch", () => {
    expect(() => applyFold(null, uniformsOf())).not.toThrow()
  })
})
