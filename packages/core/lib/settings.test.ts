import { describe, expect, it } from "vitest"
import type { GameBinding } from "./binding"
import { defaultSettings, fontFaceCss, mediaUrl, SETTINGS_FILE_SLOTS, themeStyle, UPLOADED_ACCENT_FONT, UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT } from "./settings"

const settings = defaultSettings({ NAME: "Test" } as GameBinding)
const uploaded = (name: string) => ({ url: `https://cdn.sanity.io/files/abc123/production/${name}`, name })

describe("uploaded fonts", () => {
  it("has a slot for the accent font next to the body and the title", () => {
    expect(SETTINGS_FILE_SLOTS).toContain("fontAccent")
    expect(settings.files.fontAccent).toBeNull()
  })

  it("declares no face while no font file is uploaded", () => {
    expect(fontFaceCss(settings.files)).toBe("")
  })

  it("declares the accent face under its own family, served same-origin", () => {
    const file = uploaded("typey.woff2")
    expect(fontFaceCss({ ...settings.files, fontAccent: file })).toBe(
      `@font-face{font-family:"${UPLOADED_ACCENT_FONT}";src:url("${mediaUrl(file.url)}") format("woff2");font-weight:100 900;font-display:swap}`,
    )
  })

  it("declares one face per uploaded file, each under its own family", () => {
    const css = fontFaceCss({ ...settings.files, fontBody: uploaded("body.woff2"), fontDisplay: uploaded("title.woff2"), fontAccent: uploaded("accent.woff2") })
    expect(css.match(/@font-face/g)).toHaveLength(3)
    for (const family of [UPLOADED_BODY_FONT, UPLOADED_TITLE_FONT, UPLOADED_ACCENT_FONT]) expect(css).toContain(`font-family:"${family}"`)
  })

  it("reads the format from the extension of the file", () => {
    const format = (name: string) => fontFaceCss({ ...settings.files, fontAccent: uploaded(name) }).match(/format\("([^"]+)"\)/)?.[1]
    expect(format("a.woff2")).toBe("woff2")
    expect(format("a.woff")).toBe("woff")
    expect(format("a.ttf")).toBe("truetype")
    expect(format("a.OTF")).toBe("opentype")
    expect(format("a.bin")).toBeUndefined()
  })
})

describe("themeStyle", () => {
  it("leaves --font-accent to the game's CSS and to the screens' own fallback while no accent file is uploaded", () => {
    expect(themeStyle(settings)).not.toHaveProperty("--font-accent")
    expect(themeStyle({ ...settings, files: { ...settings.files, fontDisplay: uploaded("title.woff2") } })).not.toHaveProperty("--font-accent")
  })

  it("sets --font-accent from the uploaded accent file, falling back to the title font", () => {
    const style = themeStyle({ ...settings, files: { ...settings.files, fontAccent: uploaded("typey.woff2") } })
    expect(style["--font-accent"]).toBe(`"${UPLOADED_ACCENT_FONT}", var(--font-title)`)
  })

  it("does not touch the body and title fonts when only the accent is uploaded", () => {
    const style = themeStyle({ ...settings, files: { ...settings.files, fontAccent: uploaded("typey.woff2") } })
    expect(style).not.toHaveProperty("--font-body")
    expect(style).not.toHaveProperty("--font-title")
  })
})
