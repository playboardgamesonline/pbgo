import { describe, expect, it } from "vitest"
import { seatAvatar } from "./seat-avatar"
import { AVATAR_FILL, avatarGeometry, FALLBACK_FONT, paintSeatAvatar, resolveVars, seatFontFamily } from "./seat-avatar-canvas"
import { DEFAULT_SEAT_THEME, type SeatTheme } from "./ui-theme"

const vars = (table: Record<string, string>) => (name: string) => table[name] ?? ""

describe("resolveVars", () => {
  it("leaves a value without custom property alone", () => {
    expect(resolveVars('"Alegreya Variable", Georgia, serif', vars({}))).toBe('"Alegreya Variable", Georgia, serif')
  })

  it("replaces a custom property by its value", () => {
    expect(resolveVars("var(--font-title)", vars({ "--font-title": ' "Alegreya Variable", serif ' }))).toBe('"Alegreya Variable", serif')
  })

  it("falls back when the property is not set, fallbacks with commas and parentheses included", () => {
    expect(resolveVars("var(--font-title, ui-rounded, system-ui)", vars({}))).toBe("ui-rounded, system-ui")
    expect(resolveVars("var(--ring, rgb(255 255 255 / 0.4))", vars({}))).toBe("rgb(255 255 255 / 0.4)")
  })

  it("prefers the property over its fallback", () => {
    expect(resolveVars("var(--a, red)", vars({ "--a": "blue" }))).toBe("blue")
  })

  it("replaces several references and follows a reference to another one", () => {
    expect(resolveVars("var(--a) var(--b)", vars({ "--a": "1px", "--b": "var(--c)", "--c": "2px" }))).toBe("1px 2px")
  })

  it("drops what it cannot resolve and gives up on a cycle", () => {
    expect(resolveVars("var(--missing)", vars({}))).toBe("")
    expect(resolveVars("var(--a)", vars({ "--a": "var(--a)" }))).toBe("")
  })
})

describe("seatFontFamily", () => {
  it("is the fallback font for a value that resolves to nothing", () => {
    expect(seatFontFamily("var(--font-title)")).toBe(FALLBACK_FONT)
    expect(seatFontFamily("")).toBe(FALLBACK_FONT)
  })

  it("keeps a font stack as it is", () => {
    expect(seatFontFamily('"Alegreya Variable", Georgia, serif')).toBe('"Alegreya Variable", Georgia, serif')
  })

  it("takes the fallback of a missing property, without leaving an empty entry", () => {
    expect(seatFontFamily("var(--font-title, serif)")).toBe("serif")
    expect(seatFontFamily("var(--nope), serif")).toBe("serif")
  })
})

describe("avatarGeometry", () => {
  it("keeps the avatar, its ring and its shadow (blur 4 %, offset 1.2 % of the canvas) inside the canvas", () => {
    for (const px of [64, 128, 256]) {
      const g = avatarGeometry(px)
      expect(g.center).toBe(px / 2)
      expect(g.center - (g.diameter / 2 + g.ring)).toBeGreaterThanOrEqual(px * (0.04 + 0.012))
    }
  })

  it("fills AVATAR_FILL of the canvas, which is what a game sizes its plane from", () => {
    expect(avatarGeometry(256).diameter / 256).toBeCloseTo(AVATAR_FILL)
    expect(AVATAR_FILL).toBeGreaterThan(0.5)
    expect(AVATAR_FILL).toBeLessThan(1)
  })

  it("scales with the canvas", () => {
    const a = avatarGeometry(128)
    const b = avatarGeometry(256)
    expect(b.diameter).toBeCloseTo(a.diameter * 2)
    expect(b.ring).toBeCloseTo(a.ring * 2)
    expect(b.radius).toBeCloseTo(a.radius * 2)
  })
})

/** A canvas context that only records what it is asked to draw */
function recorder() {
  const calls: { name: string; args: unknown[] }[] = []
  const sets: [string, unknown][] = []
  const ctx = new Proxy(
    {},
    {
      get: (_, name: string) => {
        if (name === "measureText") return () => ({ actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 0 })
        return (...args: unknown[]) => void calls.push({ name, args })
      },
      set: (_, name: string, value) => {
        sets.push([name, value])
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  const count = (name: string) => calls.filter((c) => c.name === name).length
  const last = (name: string) => sets.filter(([key]) => key === name).at(-1)?.[1]
  const first = (name: string) => sets.find(([key]) => key === name)?.[1]
  return { ctx, calls, count, first, last }
}

const KATE = seatAvatar({ nickname: "kate", color: "#a8603a" })
const picture = { width: 200, height: 100 } as unknown as CanvasImageSource & { width: number; height: number }

describe("paintSeatAvatar", () => {
  it("draws a disc: the body, its clip and its ring are arcs", () => {
    const { ctx, count } = recorder()
    paintSeatAvatar(ctx, KATE, DEFAULT_SEAT_THEME, 256)
    expect(count("arc")).toBe(3)
    expect(count("arcTo")).toBe(0)
  })

  it("draws a square with four rounded corners per outline", () => {
    const { ctx, count } = recorder()
    const theme: SeatTheme = { ...DEFAULT_SEAT_THEME, shape: "square" }
    paintSeatAvatar(ctx, KATE, theme, 256)
    expect(count("arcTo")).toBe(12)
    expect(count("arc")).toBe(0)
  })

  it("writes the initial in the readable ink, in the resolved font", () => {
    const { ctx, calls, last } = recorder()
    paintSeatAvatar(ctx, KATE, DEFAULT_SEAT_THEME, 256, null, '"Alegreya Variable", serif')
    const text = calls.find((c) => c.name === "fillText")!
    expect(text.args[0]).toBe("K")
    expect(text.args[1]).toBe(128)
    expect(last("font")).toMatch(/^900 \d+px "Alegreya Variable", serif$/)
    expect(last("fillStyle")).toBe(KATE.ink)
  })

  it("fills the body with the seat colour and rings it with the theme's ring", () => {
    const { ctx, count, first, last } = recorder()
    paintSeatAvatar(ctx, KATE, { ...DEFAULT_SEAT_THEME, ring: "rgb(255 244 220)" }, 256)
    expect(first("fillStyle")).toBe(KATE.color)
    expect(count("fill")).toBe(1)
    expect(last("strokeStyle")).toBe("rgb(255 244 220)")
    expect(last("lineWidth")).toBe(avatarGeometry(256).ring)
    expect(count("stroke")).toBe(1)
  })

  it("shows the account picture instead of the initial, cropped to cover the avatar", () => {
    const { ctx, calls, count } = recorder()
    paintSeatAvatar(ctx, { ...KATE, imageUrl: "https://example.com/kate.png" }, DEFAULT_SEAT_THEME, 256, picture)
    expect(count("fillText")).toBe(0)
    const draw = calls.find((c) => c.name === "drawImage")!
    const { center, diameter } = avatarGeometry(256)
    // 200×100 covering a square: scaled to the height, centred, overflowing on the sides
    expect(draw.args.slice(1)).toEqual([center - diameter, center - diameter / 2, diameter * 2, diameter])
  })
})
