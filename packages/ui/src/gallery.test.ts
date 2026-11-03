import { describe, expect, it } from "vitest"
import { slideAfterKey, slideLabel } from "./gallery"

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
