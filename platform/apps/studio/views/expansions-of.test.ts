import { evaluate, parse } from "groq-js"
import { describe, expect, it } from "vitest"
import { EXPANSIONS_OF_QUERY } from "./expansions-of"

// The query of the "Expansions" tab runs here against a small dataset by a GROQ engine: the Studio cannot be opened by a test, and a
// query that matches nothing would show an empty tab without a word.

/** A reference as the Studio writes one into a draft whose target is not published: weak, and marked to be made strong on publication. */
const draftReference = (id: string, type: string) => ({ _type: "reference", _ref: id, _weak: true, _strengthenOnPublish: { type } })
const reference = (id: string) => ({ _type: "reference", _ref: id })

const dataset = [
  { _id: "game-courtisans", _type: "game", name: "Courtisans", kind: "game" },
  { _id: "game-flip-7", _type: "game", name: "Flip 7", kind: "game" },
  { _id: "game-flip-7-vengeance", _type: "game", name: "Flip 7 Vengeance", kind: "reimplementation", baseGame: reference("game-flip-7") },
  { _id: "game-lonely", _type: "game", name: "Lonely", kind: "game" },
  // a published expansion and a draft one of the same game, whose reference is weak as the Studio writes it until the game is published
  { _id: "expansion-courtisans-spies", _type: "expansion", name: "Courtisans: Spies", baseGame: reference("game-courtisans") },
  { _id: "drafts.expansion-courtisans-diplomats-confidants", _type: "expansion", name: "Courtisans: Diplomates & Confidents", baseGame: draftReference("game-courtisans", "game") },
  { _id: "expansion-flip-7-more", _type: "expansion", name: "Flip 7: More", baseGame: reference("game-flip-7") },
]

async function run(id: string) {
  const params = { id }
  return (await evaluate(parse(EXPANSIONS_OF_QUERY, { params }), { dataset, params })).get()
}

describe("the expansions of a game", () => {
  it("are the expansions that name it as their base game, by name, drafts and published ones alike", async () => {
    expect(await run("game-courtisans")).toEqual([
      { _id: "drafts.expansion-courtisans-diplomats-confidants", name: "Courtisans: Diplomates & Confidents" },
      { _id: "expansion-courtisans-spies", name: "Courtisans: Spies" },
    ])
  })

  it("leave out the expansions of another game", async () => {
    expect(await run("game-flip-7")).toEqual([{ _id: "expansion-flip-7-more", name: "Flip 7: More" }])
  })

  it("are not the reimplementations that name the game as their base game: those are games", async () => {
    const found = (await run("game-flip-7")) as { _id: string }[]
    expect(found.some((entry) => entry._id === "game-flip-7-vengeance")).toBe(false)
  })

  it("are none for a game no expansion names", async () => {
    expect(await run("game-lonely")).toEqual([])
    expect(await run("game-nobody")).toEqual([])
  })
})
