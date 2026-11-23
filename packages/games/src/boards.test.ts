import { readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { BOARD_DIR, gameDir, KIT_DIR, kitFiles, readBoards, reachedBy } from "./board-kit.ts"
import { GAMES } from "./registry"

// The boards of the games are drawn on one kit, `@pbgo/table`, so that an edit of the kit changes every one of them. Nothing at run time says so: a game can stop using the kit's `Card` for a copy of its own and
// everything still works, and the next change of the card reaches three games out of four. These tests read the source of the repository (`board-kit.ts`: which files of the kit a board loads, and which
// three.js it writes itself) and keep it so: a board that stops reaching what every table is made of fails here, and so does one that starts to draw with three.js a piece the kit could draw.
const REPO = fileURLToPath(new URL("../../../", import.meta.url))

/** The boards there are: the template's, and each game's that has one (a game that was only registered has none yet). */
const boards = readBoards(REPO, ["template", ...readdirSync(join(REPO, "games"))])
const slugs = boards.map((board) => board.slug)

/**
 * What every table is made of, as the files of the kit that hold it (from `packages/table/src`): the canvas with its lights, the camera, the mat, the card, the zone it lies in, the plate of a player and
 * the words on the table. A board reaches them all, and so an edit of any of them changes every board.
 */
const EVERY_BOARD = [
  "table/table.tsx", // the canvas, the lights, the share photo
  "table/camera.ts", // the camera and its entrance
  "table/surface.tsx", // the mat the cards lie on
  "card/card.tsx", // every card
  "zone/zone.tsx", // where cards lie
  "seat/seat.tsx", // the plate of a player
  "seat/table-text.tsx", // the words written on the table
]

/** A board that does without a piece of the list, and why: a game with no cards, say, has no use for the card. None does today. */
const WITHOUT: Record<string, string[]> = {}

/**
 * The three.js a board writes itself: the scene's elements (never `group`, which draws nothing) and what it takes from react-three-fiber and drei. Each is a piece that the kit does not have, said beside
 * it, and a board writes no other: a new element or a new hook is a decision. Ask the engine for the piece, or, when it is only this game's, add it here with the reason. The list is exact, so that one that
 * a board no longer needs is taken out of it, and the day the kit has the piece, the board takes it and the entry goes.
 */
const OWN_DRAWING: Record<string, { elements: string[]; hooks: string[] }> = {
  // Flat pictures that lie on the mat and a round backdrop under a counter (the ending), a plane under everything that takes a press on the empty table (`Table` passes none on), and the opening, which holds the
  // missions in front of the camera and follows the pointer: no kit piece draws a flat picture or holds anything in the camera's frame but a hand
  courtisans: { elements: ["circleGeometry", "mesh", "meshBasicMaterial", "planeGeometry"], hooks: ["useFrame", "useThree"] },
  // The stickers: a picture that lies on the mat with its own proportions and drops onto it when it appears
  "flip-7": { elements: ["mesh", "meshBasicMaterial", "planeGeometry"], hooks: ["useFrame"] },
}

describe("the boards of the games", () => {
  it("are found: the four games the kit was moved to, and the template they were made from", () => {
    expect(slugs).toEqual(expect.arrayContaining(["template", "courtisans", "flip-7", "skyjo", "love-letter"]))
  })

  it("exist for every game that is live", () => {
    for (const game of GAMES.filter((entry) => entry.live)) expect(slugs, `${game.slug} is live and has no board in ${gameDir(game.slug)}/${BOARD_DIR}`).toContain(game.slug)
  })

  it("have the pieces of the list in the kit: a file that was renamed or moved is told here, not as a board that stopped loading it", () => {
    const files = kitFiles(REPO)
    for (const piece of EVERY_BOARD) expect(files, `${piece} is in EVERY_BOARD and is no file of the kit (${KIT_DIR}): it was renamed or moved, so name the file that holds the piece now`).toContain(`${KIT_DIR}/${piece}`)
  })

  it.each(EVERY_BOARD)("are all changed by an edit of %s", (piece) => {
    const reached = reachedBy(boards, `${KIT_DIR}/${piece}`)
    const exempt = slugs.filter((slug) => WITHOUT[slug]?.includes(piece))
    const missed = slugs.filter((slug) => !reached.includes(slug) && !exempt.includes(slug))
    expect(missed, `${piece} is one of the pieces every table is made of, and the board of ${missed.join(", ")} no longer loads it: an edit there would not change it. Draw with the kit's piece again; a game with no use for it is listed in WITHOUT, with the reason`).toEqual([])
    expect(
      exempt.filter((slug) => reached.includes(slug)),
      `${piece} is listed as one that a board does without, and the board reaches it: take it out of WITHOUT`,
    ).toEqual([])
  })

  it("write no three.js but what is listed beside the piece the kit lacks", () => {
    for (const board of boards) {
      const allowed = OWN_DRAWING[board.slug] ?? { elements: [], hooks: [] }
      expect(
        { elements: board.elements, hooks: board.hooks },
        `the board of ${board.slug} draws with three.js itself. A piece of the kit (docs/engine/02-components) draws it for every game: use it, or ask the engine for the one that is missing. Only when it is this game's own, add it to OWN_DRAWING with the reason; take out what the board no longer needs`,
      ).toEqual(allowed)
    }
  })

  it("keep the lists of exceptions true: a game that is not there, or a piece that is not one of the list, has no entry", () => {
    for (const slug of [...Object.keys(OWN_DRAWING), ...Object.keys(WITHOUT)]) expect(slugs, `${slug} has an exception and no board`).toContain(slug)
    for (const [slug, pieces] of Object.entries(WITHOUT)) for (const piece of pieces) expect(EVERY_BOARD, `${slug} does without ${piece}, which is not in the list`).toContain(piece)
  })
})
