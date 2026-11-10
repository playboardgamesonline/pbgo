import { Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { dieGeometry } from "./geometry"
import { brightness, DIE_LIGHT, shadeVertices } from "./shade"

describe("brightness", () => {
  it("is the brightest facing the light and never below the ambient light", () => {
    const toward = brightness(DIE_LIGHT.direction.clone())
    const away = brightness(DIE_LIGHT.direction.clone().negate())
    expect(toward).toBeGreaterThan(away)
    expect(away).toBeCloseTo(DIE_LIGHT.ambient, 12)
    for (const normal of [new Vector3(1, 0, 0), new Vector3(0, -1, 0), new Vector3(0, 0, -1), new Vector3(0.6, 0.8, 0)]) {
      expect(brightness(normal)).toBeGreaterThanOrEqual(DIE_LIGHT.ambient)
    }
  })

  it("stays within what the light can give", () => {
    const most = DIE_LIGHT.ambient + DIE_LIGHT.diffuse + DIE_LIGHT.specular
    for (let i = 0; i < 200; i++) {
      const normal = new Vector3(Math.sin(i), Math.cos(i * 1.3), Math.sin(i * 0.7)).normalize()
      expect(brightness(normal)).toBeLessThanOrEqual(most + 1e-9)
    }
  })

  it("does not need a grey above one on a face that looks at the viewer from the side", () => {
    expect(brightness(new Vector3(0, 0, 1))).toBeLessThan(1.2)
  })
})

describe("shadeVertices", () => {
  const geometry = dieGeometry(1)
  const normals = geometry.getAttribute("normal").array
  const colors = () => new Float32Array(normals.length)

  it("writes one grey for every vertex", () => {
    const out = colors()
    shadeVertices(normals, new Quaternion(), out)
    for (let i = 0; i < out.length; i += 3) {
      expect(out[i]).toBe(out[i + 1])
      expect(out[i]).toBe(out[i + 2])
      expect(out[i]).toBeGreaterThan(0.5)
    }
  })

  it("lights the face that looks up more than the one that looks down", () => {
    const out = colors()
    shadeVertices(normals, new Quaternion(), out)
    const grey = (axis: Vector3) => {
      for (let i = 0; i < normals.length / 3; i++) {
        if (new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).distanceTo(axis) < 1e-6) return out[i * 3]!
      }
      throw new Error("no such face")
    }
    expect(grey(new Vector3(0, 1, 0))).toBeGreaterThan(grey(new Vector3(0, -1, 0)))
  })

  it("follows the turn: a face that comes round to the light brightens", () => {
    const down = new Vector3(0, -1, 0)
    const before = colors()
    shadeVertices(normals, new Quaternion(), before)
    const after = colors()
    // Half a turn about the x axis brings the face that looked down to the top
    shadeVertices(normals, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI), after)
    let checked = 0
    for (let i = 0; i < normals.length / 3; i++) {
      if (new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).distanceTo(down) < 1e-6) {
        expect(after[i * 3]).toBeGreaterThan(before[i * 3]!)
        checked++
      }
    }
    expect(checked).toBe(4)
  })

  it("lights the same normal the same way", () => {
    const out = colors()
    shadeVertices(normals, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.8), out)
    const seen = new Map<string, number>()
    for (let i = 0; i < normals.length / 3; i++) {
      const key = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]].map((n) => n!.toFixed(5)).join(",")
      const grey = out[i * 3]!
      if (seen.has(key)) expect(grey).toBeCloseTo(seen.get(key)!, 6)
      seen.set(key, grey)
    }
  })
})
