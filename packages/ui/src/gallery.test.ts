import { describe, expect, it } from "vitest"
import { slideAfterKey, slideLabel, windowAfter } from "./gallery"

describe("the name of a slide", () => {
  it("is the game and what the slide is: the cover, or the place of a picture or a clip among the others", () => {
    expect(slideLabel("Courtisans", "cover", 0, 3)).toBe("Courtisans: cover")
    expect(slideLabel("Courtisans", "image", 1, 3)).toBe("Courtisans: picture 1 of 3")
    expect(slideLabel("Courtisans", "video", 3, 3)).toBe("Courtisans: clip 3 of 3")
  })

  it("says what it shows when someone said, and nothing when the caption is empty", () => {
    expect(slideLabel("Courtisans", "video", 2, 4, "Playing a card")).toBe("Courtisans: clip 2 of 4, Playing a card")
    expect(slideLabel("Courtisans", "cover", 0, 4, "Never said")).toBe("Courtisans: cover, Never said")
    expect(slideLabel("Courtisans", "image", 1, 4, null)).toBe("Courtisans: picture 1 of 4")
    expect(slideLabel("Courtisans", "image", 1, 4, "")).toBe("Courtisans: picture 1 of 4")
  })
})

describe("the keys that move between the thumbnails", () => {
  it.each([
    ["ArrowRight", 0, 1],
    ["ArrowRight", 2, 3],
    ["ArrowDown", 1, 2],
    ["ArrowLeft", 3, 2],
    ["ArrowUp", 2, 1],
  ])("%s from %i goes to %i", (key, from, to) => {
    expect(slideAfterKey(from, key, 4)).toBe(to)
  })

  it("comes round at the ends", () => {
    expect(slideAfterKey(3, "ArrowRight", 4)).toBe(0)
    expect(slideAfterKey(0, "ArrowLeft", 4)).toBe(3)
  })

  it("goes to the first with Home and to the last with End", () => {
    expect(slideAfterKey(2, "Home", 4)).toBe(0)
    expect(slideAfterKey(1, "End", 4)).toBe(3)
  })

  it("stays on any other key", () => {
    for (const key of ["a", "Enter", " ", "Tab", "PageDown"]) expect(slideAfterKey(2, key, 4)).toBe(2)
  })

  it("stays on the one slide there is, and on none", () => {
    expect(slideAfterKey(0, "ArrowRight", 1)).toBe(0)
    expect(slideAfterKey(0, "ArrowLeft", 1)).toBe(0)
    expect(slideAfterKey(0, "End", 0)).toBe(0)
  })
})

describe("the window of tiles that shows", () => {
  // Six slides, four tiles in view at once
  it("stays where it is while the slide that is shown and its neighbours are in it", () => {
    expect(windowAfter(0, 0, 6, 4)).toBe(0)
    expect(windowAfter(0, 1, 6, 4)).toBe(0)
    expect(windowAfter(0, 2, 6, 4)).toBe(0)
    expect(windowAfter(1, 3, 6, 4)).toBe(1)
    expect(windowAfter(2, 4, 6, 4)).toBe(2)
  })

  it("moves a tile when the slide that is shown is the last in view, so that the next one shows", () => {
    expect(windowAfter(0, 3, 6, 4)).toBe(1)
    expect(windowAfter(1, 4, 6, 4)).toBe(2)
  })

  it("stops at the window that ends with the last slide", () => {
    expect(windowAfter(2, 5, 6, 4)).toBe(2)
  })

  it("moves back the same way, so that the previous one shows", () => {
    expect(windowAfter(2, 2, 6, 4)).toBe(1)
    expect(windowAfter(1, 1, 6, 4)).toBe(0)
    expect(windowAfter(1, 0, 6, 4)).toBe(0)
  })

  it("goes all the way for a jump to the end or to the start", () => {
    expect(windowAfter(0, 5, 6, 4)).toBe(2)
    expect(windowAfter(2, 0, 6, 4)).toBe(0)
  })

  it("holds three tiles as it holds four", () => {
    expect(windowAfter(0, 2, 6, 3)).toBe(1)
    expect(windowAfter(1, 3, 6, 3)).toBe(2)
    expect(windowAfter(0, 5, 6, 3)).toBe(3)
  })

  it("never moves when every slide is in view", () => {
    expect(windowAfter(0, 3, 4, 4)).toBe(0)
    expect(windowAfter(0, 1, 3, 4)).toBe(0)
    expect(windowAfter(0, 2, 3, 3)).toBe(0)
  })
})
