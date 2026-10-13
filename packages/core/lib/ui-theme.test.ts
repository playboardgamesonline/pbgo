import { describe, expect, it } from "vitest"
import { DEFAULT_SEAT_THEME, seatTheme } from "./ui-theme"

describe("seatTheme", () => {
  it("is the default look when the game declares nothing", () => {
    expect(seatTheme()).toEqual(DEFAULT_SEAT_THEME)
    expect(seatTheme({})).toEqual(DEFAULT_SEAT_THEME)
  })

  it("lets a game override some fields and keeps the others", () => {
    expect(seatTheme({ shape: "square", name: "ink" })).toEqual({ ...DEFAULT_SEAT_THEME, shape: "square", name: "ink" })
    expect(seatTheme({ ring: "var(--accent-game)", font: "Georgia, serif" })).toEqual({ ...DEFAULT_SEAT_THEME, ring: "var(--accent-game)", font: "Georgia, serif" })
  })

  it("keeps the default of a field set to undefined", () => {
    expect(seatTheme({ shape: undefined, ring: "red" })).toEqual({ ...DEFAULT_SEAT_THEME, ring: "red" })
  })

  it("never hands out the defaults themselves", () => {
    const theme = seatTheme()
    theme.shape = "square"
    expect(DEFAULT_SEAT_THEME.shape).toBe("disc")
    expect(seatTheme().shape).toBe("disc")
  })
})
