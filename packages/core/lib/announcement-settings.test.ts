import { describe, expect, it } from "vitest"
import {
  ANNOUNCEMENT_DEFAULTS,
  ANNOUNCEMENT_LABELS,
  ANNOUNCEMENT_PRESETS,
  EXIT,
  HERO_MAX,
  announcementSettings,
  announcementTimeline,
  fontSize,
  heroSeatSize,
  lineGap,
  ruleStyles,
  textStyle,
  veilStyle,
  vh,
} from "./announcement-settings"
import { REDUCED_FADE } from "./motion-preference"
import { DEFAULT_ANNOUNCEMENT_THEME } from "./ui-theme"

const THEME = {
  font: "Georgia, serif",
  color: "#f4ecd8",
  outline: "#aa3322",
  shadow: "#221100",
  veil: "#14110d",
  rule: "#c8321e",
  confetti: { color: "#c8321e", shape: "dot" as const },
}

const PRESET_KEYS = Object.keys(ANNOUNCEMENT_PRESETS) as (keyof typeof ANNOUNCEMENT_PRESETS)[]

describe("the defaults", () => {
  it("repeat the default theme, so a game that declares nothing keeps the look the announcements had", () => {
    expect(ANNOUNCEMENT_DEFAULTS).toMatchObject({
      font: DEFAULT_ANNOUNCEMENT_THEME.font,
      textColor: DEFAULT_ANNOUNCEMENT_THEME.color,
      outlineColor: DEFAULT_ANNOUNCEMENT_THEME.outline,
      shadowColor: DEFAULT_ANNOUNCEMENT_THEME.shadow,
      veil: DEFAULT_ANNOUNCEMENT_THEME.veil,
      lineColor: DEFAULT_ANNOUNCEMENT_THEME.rule,
      confettiColor: DEFAULT_ANNOUNCEMENT_THEME.confetti!.color,
      confettiShape: DEFAULT_ANNOUNCEMENT_THEME.confetti!.shape,
    })
  })

  it("are what announcementSettings gives without a theme or a preset", () => {
    expect(announcementSettings()).toEqual(ANNOUNCEMENT_DEFAULTS)
    expect(announcementSettings({}, {})).toEqual(ANNOUNCEMENT_DEFAULTS)
  })

  it("are never handed out themselves", () => {
    const settings = announcementSettings()
    settings.size = 99
    expect(ANNOUNCEMENT_DEFAULTS.size).toBe(4.8)
    expect(announcementSettings().size).toBe(4.8)
  })
})

describe("announcementSettings", () => {
  it("seeds the colours, the font and the veil from the game's theme and keeps every other default", () => {
    expect(announcementSettings({}, THEME)).toEqual({
      ...ANNOUNCEMENT_DEFAULTS,
      font: "Georgia, serif",
      textColor: "#f4ecd8",
      outlineColor: "#aa3322",
      shadowColor: "#221100",
      veil: "#14110d",
      lineColor: "#c8321e",
      confettiColor: "#c8321e",
      confettiShape: "dot",
    })
  })

  it("lets a theme set only what it wants", () => {
    expect(announcementSettings({}, { color: "#f4ecd8" })).toEqual({ ...ANNOUNCEMENT_DEFAULTS, textColor: "#f4ecd8" })
  })

  it("puts the preset on top of the theme", () => {
    const settings = announcementSettings({ textColor: "#ffffff", veil: "#001122", size: 3 }, THEME)
    expect(settings).toMatchObject({ textColor: "#ffffff", veil: "#001122", size: 3, font: "Georgia, serif", lineColor: "#c8321e" })
  })

  it("keeps off what the theme switches off with null, whatever the preset asks", () => {
    const off = { outline: null, rule: null, confetti: null }
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.victory, off)).toMatchObject({ outline: 0, lines: false, confetti: false })
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.start, off)).toMatchObject({ outline: 0, lines: false, confetti: false })
    expect(announcementSettings({ outline: 3, lines: true, confetti: true }, off)).toMatchObject({ outline: 0, lines: false, confetti: false })
  })

  it("switches them off one at a time", () => {
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.victory, { confetti: null })).toMatchObject({ outline: 0.5, lines: true, confetti: false })
    expect(announcementSettings({}, { rule: null })).toMatchObject({ outline: 0.5, lines: false, confetti: false })
    expect(announcementSettings({}, { outline: null })).toMatchObject({ outline: 0, lines: true })
  })
})

describe("the shared presets", () => {
  it("start is the defaults: the big one", () => {
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.start)).toEqual(ANNOUNCEMENT_DEFAULTS)
  })

  it("round is the start made quieter and shorter", () => {
    const start = announcementSettings(ANNOUNCEMENT_PRESETS.start)
    const round = announcementSettings(ANNOUNCEMENT_PRESETS.round)
    expect(round.duration).toBeLessThan(start.duration)
    expect(round.size).toBeLessThan(start.size)
    expect(round.overlay).toBeLessThan(start.overlay)
    expect(round.lines).toBe(true)
  })

  it("your turn is one light line at the top, without hairlines", () => {
    const turn = announcementSettings(ANNOUNCEMENT_PRESETS.turn)
    expect(turn).toMatchObject({ above: true, lines: false, fadeGradient: true, outline: 0 })
    expect(turn.size).toBeLessThan(announcementSettings(ANNOUNCEMENT_PRESETS.round).size)
  })

  it("shows the seat where it belongs: next to 'your turn', above the winner's title, nowhere else", () => {
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.turn).seat).toBe("inline")
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.victory).seat).toBe("hero")
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.start).seat).toBe("none")
    expect(announcementSettings(ANNOUNCEMENT_PRESETS.round).seat).toBe("none")
  })

  it("lets only the victory spring and throw confetti", () => {
    for (const key of PRESET_KEYS) {
      const settings = announcementSettings(ANNOUNCEMENT_PRESETS[key])
      expect(settings.spring).toBe(key === "victory")
      expect(settings.confetti).toBe(key === "victory")
    }
  })

  it("have a name in the debug panel", () => {
    for (const key of PRESET_KEYS) expect(ANNOUNCEMENT_LABELS[key]).toBeTruthy()
  })

  it.each(PRESET_KEYS)("%s: the title, the subtitle and the glint have settled before it leaves", (key) => {
    const settings = announcementSettings(ANNOUNCEMENT_PRESETS[key])
    const timeline = announcementTimeline(settings, "lively", 2)
    expect(timeline.title.delay + timeline.title.duration).toBeLessThan(settings.duration)
    expect(timeline.subtitle.delay + timeline.subtitle.duration).toBeLessThan(settings.duration)
    if (timeline.rule.show && timeline.rule.glint) {
      expect(timeline.rule.glint.delay + timeline.rule.glint.duration).toBeLessThan(settings.duration)
    }
  })
})

describe("fontSize and lineGap", () => {
  it("also follow the height of the viewport, so a short screen shrinks them", () => {
    expect(fontSize(5)).toBe("min(5rem, calc(var(--vh, 1vh) * 12))")
    expect(lineGap(80)).toBe("min(80px, calc(var(--vh, 1vh) * 12))")
  })

  it("read the height of the stage when a specimen sets --vh, the viewport (1vh) otherwise", () => {
    expect(vh(9)).toBe("calc(var(--vh, 1vh) * 9)")
  })
})

describe("textStyle", () => {
  it("draws the letters in the text colour, with a line around them when there is an outline", () => {
    const style = textStyle(ANNOUNCEMENT_DEFAULTS)
    expect(style.color).toBe("#ffffff")
    expect(style.WebkitTextStroke).toBe("0.5px #f2b705")
    expect(style.paintOrder).toBe("stroke fill")
  })

  it("draws no line when the outline is 0", () => {
    expect(textStyle({ ...ANNOUNCEMENT_DEFAULTS, outline: 0 }).WebkitTextStroke).toBeUndefined()
  })

  it("casts a hard and a soft shadow in the game's shadow colour", () => {
    const style = textStyle({ ...ANNOUNCEMENT_DEFAULTS, shadowColor: "#221100", shadow: 4, blur: 18 })
    expect(style.filter).toBe("drop-shadow(0 4px 0 color-mix(in srgb, #221100 85%, transparent)) drop-shadow(0 10px 18px color-mix(in srgb, #221100 60%, transparent))")
  })
})

describe("veilStyle", () => {
  it("covers the screen with the veil colour", () => {
    expect(veilStyle(ANNOUNCEMENT_DEFAULTS)).toEqual({ backgroundColor: "#000000" })
  })

  it("fades out downwards when asked for a gradient", () => {
    expect(veilStyle({ ...ANNOUNCEMENT_DEFAULTS, veil: "#14110d", fadeGradient: true, gradientHeight: 45 })).toEqual({
      background: "linear-gradient(to bottom, #14110d 0%, transparent 45%)",
    })
  })
})

describe("ruleStyles", () => {
  it("fades the hairline at both ends and whitens the glint that crosses it", () => {
    const { line, glint } = ruleStyles({ ...ANNOUNCEMENT_DEFAULTS, lineColor: "#c8321e" })
    expect(line.background).toBe("linear-gradient(90deg, transparent, #c8321e 16%, #c8321e 84%, transparent)")
    expect(glint.background).toBe("linear-gradient(90deg, transparent, color-mix(in srgb, #c8321e 25%, white) 50%, transparent)")
  })
})

describe("heroSeatSize", () => {
  it("is large for a winner and smaller for a tie", () => {
    expect(heroSeatSize(1)).toBe("xl")
    expect(heroSeatSize(2)).toBe("lg")
    expect(heroSeatSize(HERO_MAX)).toBe("lg")
  })
})

describe("announcementTimeline", () => {
  const start = announcementSettings(ANNOUNCEMENT_PRESETS.start)
  const turn = announcementSettings(ANNOUNCEMENT_PRESETS.turn)
  const victory = announcementSettings(ANNOUNCEMENT_PRESETS.victory)

  describe("with reduced motion", () => {
    const timeline = announcementTimeline(victory, "reduced", 2)

    it("fades everything at once, 150 ms at most", () => {
      for (const seconds of [timeline.veil, timeline.seat.duration, timeline.title.duration, timeline.subtitle.duration, timeline.exit]) {
        expect(seconds).toBeLessThanOrEqual(REDUCED_FADE)
      }
      for (const delay of [timeline.seat.delay, timeline.seat.crownDelay, timeline.title.delay, timeline.subtitle.delay]) {
        expect(delay).toBe(0)
      }
    })

    it("travels, blurs, scales, springs and throws nothing", () => {
      expect(timeline.title).toMatchObject({ rise: 0, blur: 0, scale: 1, spring: false })
      expect(timeline.subtitle.rise).toBe(0)
      expect(timeline.confetti).toBe(false)
    })

    it("shows the hairlines without drawing them or crossing them with a glint", () => {
      expect(announcementTimeline(start, "reduced").rule).toEqual({ show: true, delay: 0, draw: 0, glint: null })
      expect(announcementTimeline(turn, "reduced").rule.show).toBe(false)
    })

    it("keeps a fade shorter than 150 ms as it is", () => {
      expect(announcementTimeline({ ...start, fade: 0.05 }, "reduced").veil).toBe(0.05)
    })
  })

  describe("with calm motion", () => {
    it("keeps the entrance but never springs or throws confetti, even when the preset asks", () => {
      const timeline = announcementTimeline(victory, "calm", 1)
      expect(timeline.title.spring).toBe(false)
      expect(timeline.confetti).toBe(false)
      expect(timeline.title.rise).toBe(victory.rise)
      expect(timeline.title.blur).toBe(victory.riseBlur)
      expect(timeline.title.scale).toBe(victory.startScale)
    })

    it("draws the hairlines and crosses them with a glint", () => {
      const { rule } = announcementTimeline(start, "calm")
      expect(rule.show).toBe(true)
      expect(rule.draw).toBeGreaterThan(0)
      expect(rule.glint?.duration).toBe(start.lineDuration)
    })
  })

  describe("with lively motion", () => {
    it("springs and throws confetti when the preset asks", () => {
      const timeline = announcementTimeline(victory, "lively", 1)
      expect(timeline.title.spring).toBe(true)
      expect(timeline.confetti).toBe(true)
    })

    it("does neither when the preset does not", () => {
      const timeline = announcementTimeline(start, "lively")
      expect(timeline.title.spring).toBe(false)
      expect(timeline.confetti).toBe(false)
    })
  })

  describe("the order of things", () => {
    it("brings the hairlines in first, then the title, then the subtitle", () => {
      const timeline = announcementTimeline(start, "lively")
      expect(timeline.rule.delay).toBeLessThan(timeline.title.delay)
      expect(timeline.subtitle.delay).toBeCloseTo(timeline.title.delay + start.subtitleDelay, 6)
    })

    it("makes the title of a victory wait for the winner's medallion, if there is one", () => {
      const withSeat = announcementTimeline(victory, "lively", 1)
      const without = announcementTimeline(victory, "lively", 0)
      expect(withSeat.title.delay).toBeGreaterThan(without.title.delay)
      expect(without.title.delay).toBe(announcementTimeline(start, "lively").title.delay)
      expect(withSeat.seat.delay).toBeLessThan(withSeat.title.delay)
    })

    it("does not make a title wait for a seat that sits next to it", () => {
      expect(announcementTimeline(turn, "lively", 1).title.delay).toBe(announcementTimeline(start, "lively", 1).title.delay)
    })

    it("has no glint when its duration is 0", () => {
      expect(announcementTimeline({ ...start, lineDuration: 0 }, "lively").rule.glint).toBeNull()
    })

    it("leaves in EXIT seconds", () => {
      expect(announcementTimeline(start, "calm").exit).toBe(EXIT)
      expect(announcementTimeline(start, "lively").exit).toBe(EXIT)
    })
  })
})
