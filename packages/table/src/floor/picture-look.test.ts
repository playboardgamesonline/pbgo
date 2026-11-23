import { describe, expect, it } from "vitest"
import { PICTURE, pictureAspect } from "./picture-look"

describe("the proportions of a picture", () => {
  it("are those of the image its texture holds, width over height", () => {
    expect(pictureAspect({ image: { width: 300, height: 200 } })).toBe(1.5)
    expect(pictureAspect({ image: { width: 128, height: 128 } })).toBe(1)
    expect(pictureAspect({ image: { width: 100, height: 400 } })).toBe(0.25)
  })

  it("are a square when the texture holds no image, or one of no size", () => {
    expect(pictureAspect({})).toBe(1)
    expect(pictureAspect({ image: null })).toBe(1)
    expect(pictureAspect({ image: { width: 0, height: 0 } })).toBe(1)
    expect(pictureAspect({ image: { width: 200 } })).toBe(1)
  })
})

describe("what a flat picture is drawn after", () => {
  it("is over the mat and what lies flat on it, under what is drawn after the veil of a table", () => {
    expect(PICTURE.order).toBe(4)
  })
})
