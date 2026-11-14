import { describe, expect, it } from "vitest"
import { PRESET_IDS } from "./presets"
import { isTyping, type KeyLike, SHORTCUTS, shortcutFor } from "./shortcuts"

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe("shortcutFor", () => {
  it("reads undo and redo with Ctrl or ⌘", () => {
    expect(shortcutFor(key("z", { ctrlKey: true }))).toBe("undo")
    expect(shortcutFor(key("Z", { metaKey: true, shiftKey: true }))).toBe("redo")
    expect(shortcutFor(key("y", { ctrlKey: true }))).toBe("redo")
    expect(shortcutFor(key("d", { ctrlKey: true }))).toBeNull()
  })

  it("reads the letters of the transitions and of the table", () => {
    expect(shortcutFor(key("d"))).toBe("deal")
    expect(shortcutFor(key("F"))).toBe("flip")
    expect(shortcutFor(key("r"))).toBe("roll")
    expect(shortcutFor(key("R", { shiftKey: true }))).toBe("reset")
    expect(shortcutFor(key("Delete"))).toBe("remove")
    expect(shortcutFor(key("?", { shiftKey: true }))).toBe("help")
    expect(shortcutFor(key("+", { shiftKey: true }))).toBe("point")
  })

  it("picks a scene with a digit, and nothing beyond the last", () => {
    expect(shortcutFor(key("1"))).toEqual({ scene: PRESET_IDS[0] })
    expect(shortcutFor(key(String(PRESET_IDS.length)))).toEqual({ scene: PRESET_IDS.at(-1) })
    expect(shortcutFor(key(String(PRESET_IDS.length + 1)))).toBeNull()
    expect(shortcutFor(key("0"))).toBeNull()
  })

  it("lets the browser have the keys with Alt, and a capital letter that is no shortcut", () => {
    expect(shortcutFor(key("d", { altKey: true }))).toBeNull()
    expect(shortcutFor(key("D", { shiftKey: true }))).toBeNull()
  })

  it("is each key of the list that the help prints", () => {
    for (const { id, keys } of SHORTCUTS) {
      if (id === "scene" || id === "undo" || id === "redo" || id === "reset" || id === "help" || id === "point") continue
      const letter = keys[0]!
      const read = shortcutFor(key(letter === "Del" ? "Delete" : letter === "Esc" ? "Escape" : letter.toLowerCase()))
      expect(read, letter).toBe(id)
    }
  })
})

describe("isTyping", () => {
  it("is true in a field and in a dialog, false on the page", () => {
    expect(isTyping({ tagName: "INPUT" })).toBe(true)
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true)
    expect(isTyping({ tagName: "BUTTON", closest: () => ({}) })).toBe(true)
    expect(isTyping({ tagName: "BUTTON", closest: () => null })).toBe(false)
    expect(isTyping(null)).toBe(false)
  })
})
