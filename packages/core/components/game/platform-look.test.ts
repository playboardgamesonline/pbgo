import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Guard of the rule of a game's screen (`docs/design/01-guidelines/04-in-game-rules.md`, PLT-130): what is of the game, on the table, keeps the game's look; everything around the table, the corners of the HUD with
 * their menu and the windows of the menu, takes the platform's. The check reads the files of the second kind: they carry the platform's look (the `platform` class, or components of `@pbgo/ui/platform`, which carry it
 * themselves) and hold nothing of the game's own (its components in `@pbgo/ui/game`, its tokens `surface`, `surface-dark`, `accent-game` and `font-display`).
 */

const HERE = fileURLToPath(new URL(".", import.meta.url))

/** What stands around the table. */
const AROUND_THE_TABLE = ["hud.tsx", "hud-dock.tsx", "table-players.tsx", "chat.tsx", "game-menu.tsx", "game-windows.tsx"]

/** What is the game's own: its components and its tokens. */
const OF_THE_GAME: ReadonlyArray<{ what: string; pattern: RegExp }> = [
  { what: "a component of the game's look (`@pbgo/ui/game`)", pattern: /@pbgo\/ui\/game\// },
  // `shadow-surface` is the platform's own elevation, not the game's `surface` colour
  { what: "a token of the game's look (`surface`, `surface-dark`, `accent-game`)", pattern: /(?<![\w-])(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide)-(?:surface-dark|surface|accent-game)(?![\w-])/ },
  { what: "the game's display font (`font-display`)", pattern: /(?<![\w-])font-display(?![\w-])/ },
]

/** Whether the code wears the platform's look: its class, or a component that carries it. */
const WEARS_THE_PLATFORM = /(?<![\w-])platform(?![\w-])\s|@pbgo\/ui\/platform\//

describe("the screen around the table", () => {
  it("sees what is of the game", () => {
    const found = (code: string) => OF_THE_GAME.filter(({ pattern }) => pattern.test(code)).length
    expect(found('import { Dialog } from "@pbgo/ui/game/dialog"')).toBe(1)
    expect(found('<div className="rounded-2xl border-0 bg-surface p-6">')).toBe(1)
    expect(found('<div className="bg-surface-dark/80 text-accent-game">')).toBe(1)
    expect(found('<h2 className="font-display text-2xl">')).toBe(1)
    expect(found('<div className="platform glass rounded-3xl border shadow-surface">')).toBe(0)
    expect(found('<div className="platform bg-surfaces">')).toBe(0)
    expect(found('import { Dialog } from "@pbgo/ui/platform/dialog"')).toBe(0)
  })

  it.each(AROUND_THE_TABLE)("%s is in the platform's look and holds nothing of the game's", (file) => {
    const code = readFileSync(join(HERE, file), "utf8")
    expect(WEARS_THE_PLATFORM.test(code), `${file} does not wear the platform's look`).toBe(true)
    for (const { what, pattern } of OF_THE_GAME) expect(pattern.test(code), `${file} holds ${what}`).toBe(false)
  })
})
