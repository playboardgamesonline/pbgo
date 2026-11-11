import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Guard of the rule of a game's screen (`docs/design/01-guidelines/04-in-game-rules.md`): every interface of the screen is drawn in the game's look, its skin tokens and its `UI_THEME`, and the platform's look is kept for
 * the social dock with the menu its picture opens and for the screens of a table that starts. The check reads the files. What is in the game's look holds nothing of the platform's (its `platform` class, its components in `@pbgo/ui/platform`), the platform's wears it, and what has
 * not moved to the game's look yet is named, so that the work left is a list in the code: moving a file means moving its name from the last list to the first, and the check fails on a name left in the wrong one.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url))

/** Drawn in the game's look. */
const IN_THE_GAMES_LOOK = ["ticker.tsx", "game-over-card.tsx"]

/** The platform's look, by decision: the social dock and the menu of its picture (`hud.tsx` holds the corner that mounts them), and the screens of a table that starts, which are the platform's own moment (PLT-107). */
const THE_PLATFORMS = ["hud.tsx", "hud-dock.tsx", "game-menu.tsx", "start-screen.tsx", "ready-screen.tsx"]

/** Still drawn in the platform's look, to move to the game's one at a time (the chat has its messages in the game's look already, its field and its palette are left). */
const NOT_MOVED_YET = ["table-players.tsx", "chat.tsx", "game-windows.tsx", "leave-dialog.tsx", "prompt-host.tsx"]

/** What is the platform's: its class, or a component of it, which carries the class itself. */
const WEARS_THE_PLATFORM = /(?<![\w-])platform(?![\w-])\s+[a-z]|@pbgo\/ui\/platform\//

const read = (file: string) => readFileSync(join(HERE, file), "utf8")

describe("the look of the screen around the table", () => {
  it("sees what is the platform's", () => {
    expect(WEARS_THE_PLATFORM.test('<div className="platform glass rounded-3xl">')).toBe(true)
    expect(WEARS_THE_PLATFORM.test('import { Dialog } from "@pbgo/ui/platform/dialog"')).toBe(true)
    expect(WEARS_THE_PLATFORM.test('<div className="table-ink text-foreground">')).toBe(false)
    expect(WEARS_THE_PLATFORM.test('import { Dialog } from "@pbgo/ui/game/dialog"')).toBe(false)
    // a word in a comment is not a class
    expect(WEARS_THE_PLATFORM.test("// goes on to the platform's home")).toBe(false)
  })

  it.each(IN_THE_GAMES_LOOK)("%s is in the game's look and holds nothing of the platform's", (file) => {
    expect(WEARS_THE_PLATFORM.test(read(file)), `${file} wears the platform's look`).toBe(false)
  })

  it.each(THE_PLATFORMS)("%s is the platform's", (file) => {
    expect(WEARS_THE_PLATFORM.test(read(file)), `${file} does not wear the platform's look`).toBe(true)
  })

  it.each(NOT_MOVED_YET)("%s is not moved to the game's look yet", (file) => {
    expect(WEARS_THE_PLATFORM.test(read(file)), `${file} is in the game's look now: move its name to IN_THE_GAMES_LOOK`).toBe(true)
  })
})
