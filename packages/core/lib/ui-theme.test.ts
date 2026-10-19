import { describe, expect, it } from "vitest"
import { DEFAULT_ANNOUNCEMENT_THEME, DEFAULT_GAME_OVER_THEME, DEFAULT_SEAT_THEME, announcementTheme, gameOverStyle, gameOverTheme, seatTheme } from "./ui-theme"

describe("announcementTheme", () => {
  it("is the look the announcements had before games could tune them", () => {
    expect(announcementTheme()).toEqual(DEFAULT_ANNOUNCEMENT_THEME)
    expect(announcementTheme({})).toEqual(DEFAULT_ANNOUNCEMENT_THEME)
    expect(DEFAULT_ANNOUNCEMENT_THEME).toMatchObject({ color: "#ffffff", outline: "#f2b705", rule: "#f5c542", veil: "#000000" })
  })

  it("lets a game override some fields and keeps the others", () => {
    expect(announcementTheme({ color: "#f4ecd8", veil: "#14110d" })).toEqual({ ...DEFAULT_ANNOUNCEMENT_THEME, color: "#f4ecd8", veil: "#14110d" })
    expect(announcementTheme({ font: "Georgia, serif", rule: "var(--accent-game)" })).toEqual({
      ...DEFAULT_ANNOUNCEMENT_THEME,
      font: "Georgia, serif",
      rule: "var(--accent-game)",
    })
  })

  it("keeps the default of a field set to undefined", () => {
    expect(announcementTheme({ color: undefined, shadow: "#112233" })).toEqual({ ...DEFAULT_ANNOUNCEMENT_THEME, shadow: "#112233" })
  })

  it("switches the outline, the hairlines and the confetti off with null", () => {
    const theme = announcementTheme({ outline: null, rule: null, confetti: null })
    expect(theme.outline).toBeNull()
    expect(theme.rule).toBeNull()
    expect(theme.confetti).toBeNull()
    expect(theme.color).toBe(DEFAULT_ANNOUNCEMENT_THEME.color)
  })

  it("takes the confetti of the game whole", () => {
    expect(announcementTheme({ confetti: { color: "#c8321e", shape: "dot" } }).confetti).toEqual({ color: "#c8321e", shape: "dot" })
  })

  it("never hands out the defaults themselves", () => {
    const theme = announcementTheme()
    theme.color = "red"
    theme.confetti!.color = "red"
    expect(DEFAULT_ANNOUNCEMENT_THEME.color).toBe("#ffffff")
    expect(DEFAULT_ANNOUNCEMENT_THEME.confetti).toEqual({ color: "#ffd35c", shape: "star" })
    expect(announcementTheme().confetti).toEqual({ color: "#ffd35c", shape: "star" })
  })

  it("never hands out the confetti of the game itself", () => {
    const confetti = { color: "#c8321e", shape: "dot" as const }
    const theme = announcementTheme({ confetti })
    theme.confetti!.color = "red"
    expect(confetti.color).toBe("#c8321e")
  })
})

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

describe("gameOverTheme", () => {
  it("is the look the game over had before games could tune it", () => {
    expect(gameOverTheme()).toEqual(DEFAULT_GAME_OVER_THEME)
    expect(gameOverTheme({})).toEqual(DEFAULT_GAME_OVER_THEME)
    expect(DEFAULT_GAME_OVER_THEME).toMatchObject({ surface: "var(--surface)", radius: "1.5rem", ink: "var(--foreground)", frame: "#f3ecd6" })
  })

  it("lets a game override some fields and keeps the others", () => {
    expect(gameOverTheme({ surface: "#f4ecd8", ink: "#1b1b1b" })).toEqual({ ...DEFAULT_GAME_OVER_THEME, surface: "#f4ecd8", ink: "#1b1b1b" })
    expect(gameOverTheme({ radius: "0.25rem", frame: "white" })).toEqual({ ...DEFAULT_GAME_OVER_THEME, radius: "0.25rem", frame: "white" })
  })

  it("keeps the default of a field set to undefined", () => {
    expect(gameOverTheme({ border: undefined, accent: "#c8321e" })).toEqual({ ...DEFAULT_GAME_OVER_THEME, accent: "#c8321e" })
  })

  it("never hands out the defaults themselves", () => {
    const theme = gameOverTheme()
    theme.surface = "red"
    expect(DEFAULT_GAME_OVER_THEME.surface).toBe("var(--surface)")
    expect(gameOverTheme().surface).toBe("var(--surface)")
  })
})

describe("gameOverStyle", () => {
  it("writes the theme as the panel's inline style", () => {
    const style = gameOverStyle(gameOverTheme({ surface: "#f4ecd8", border: "#14110d", radius: "0.25rem", ink: "#14110d", accent: "#c8321e", frame: "#fff" }))
    expect(style).toMatchObject({ background: "#f4ecd8", borderColor: "#14110d", borderRadius: "0.25rem", color: "#14110d" })
  })

  it("hands the accent and the frame to the parts of the panel through two variables", () => {
    const style = gameOverStyle(gameOverTheme({ accent: "#c8321e", frame: "#fff" })) as Record<string, string>
    expect(style["--go-accent"]).toBe("#c8321e")
    expect(style["--go-frame"]).toBe("#fff")
  })

  it("points at the tokens of the game's skin by default, so the panel follows them", () => {
    const style = gameOverStyle(gameOverTheme()) as Record<string, string>
    expect(style.background).toBe("var(--surface)")
    expect(style["--go-accent"]).toBe("var(--accent-game)")
    expect(style.borderColor).toContain("var(--accent-game)")
  })
})
