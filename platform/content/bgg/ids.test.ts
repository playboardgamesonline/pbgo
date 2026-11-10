import { describe, expect, it } from "vitest"
import type { GameFigures, Plan } from "./figures.ts"
import { CANDIDATES_SHOWN, describeCandidates, findIds, needingAnId, pickIds } from "./ids.ts"
import type { BggCandidate } from "./xml.ts"

const entry = (slug: string, name: string, status: GameFigures["status"]): GameFigures => ({ id: `game-${slug}`, slug, name, bggId: null, status, set: {}, notes: [], bgg: null })

/** A client whose search answers by the query, and remembers what it was asked. */
function searcher(answers: Record<string, { exact?: BggCandidate[]; near?: BggCandidate[] }>) {
  const asked: { name: string; exact: boolean }[] = []
  return {
    asked,
    async search(name: string, { exact = false }: { exact?: boolean } = {}) {
      asked.push({ name, exact })
      const answer = answers[name] ?? {}
      return (exact ? answer.exact : answer.near) ?? []
    },
  }
}

describe("needingAnId", () => {
  it("is the games with no id or a wrong one, when they have a name to search for", () => {
    const plan: Plan = { mutations: [], games: [entry("a", "A", "no-id"), entry("b", "B", "mismatch"), entry("c", "C", "proposed"), entry("d", "", "no-id"), entry("e", "E", "complete")] }
    expect(needingAnId(plan).map((game) => game.slug)).toEqual(["a", "b"])
  })
})

describe("findIds", () => {
  it("asks for the exact name first, and keeps the results that have exactly the name", async () => {
    const client = searcher({ Azul: { exact: [{ id: 230802, name: "Azul", year: 2017 }] } })
    const [found] = await findIds([entry("azul", "Azul", "no-id")], client)
    expect(client.asked).toEqual([{ name: "Azul", exact: true }])
    expect(found).toMatchObject({ id: "game-azul", slug: "azul", why: "no-id", candidates: [{ id: 230802 }], exact: [{ id: 230802 }] })
  })

  it("asks again for the nearest names when the exact one has no result, and shows few of them", async () => {
    const near = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: `Welcome to ${index}`, year: null }))
    const client = searcher({ "Welcome to": { near } })
    const [found] = await findIds([entry("welcome", "Welcome to", "mismatch")], client)
    expect(client.asked).toEqual([
      { name: "Welcome to", exact: true },
      { name: "Welcome to", exact: false },
    ])
    expect(found?.why).toBe("mismatch")
    expect(found?.candidates).toHaveLength(CANDIDATES_SHOWN)
    expect(found?.exact).toEqual([])
  })

  it("compares names without accents or case", async () => {
    const client = searcher({ Café: { exact: [{ id: 1, name: "CAFE", year: 2000 }] } })
    expect((await findIds([entry("cafe", "Café", "no-id")], client))[0]?.exact).toHaveLength(1)
  })
})

describe("pickIds", () => {
  it("takes the result that has exactly the name, when it is the only one, and leaves a name that several games bear", async () => {
    const client = searcher({
      Azul: { exact: [{ id: 230802, name: "Azul", year: 2017 }] },
      Trio: {
        exact: [
          { id: 8148, name: "Trio", year: 1972 },
          { id: 23768, name: "Trio", year: 2006 },
        ],
      },
      Nothing: {},
    })
    const found = await findIds([entry("azul", "Azul", "no-id"), entry("trio", "Trio", "no-id"), entry("nothing", "Nothing", "no-id")], client)
    expect([...pickIds(found)]).toEqual([["game-azul", 230802]])
  })
})

describe("describeCandidates", () => {
  it("says each game with its results, an id that has exactly the name marked, and the ones that are wrong", () => {
    const text = describeCandidates([
      { id: "game-azul", slug: "azul", name: "Azul", why: "no-id", candidates: [{ id: 230802, name: "Azul", year: 2017 }], exact: [{ id: 230802, name: "Azul", year: 2017 }] },
      { id: "game-trio", slug: "trio", name: "Trio", why: "mismatch", candidates: [{ id: 8148, name: "Trio", year: 1972 }, { id: 23768, name: "Trio", year: null }], exact: [{ id: 8148, name: "Trio", year: 1972 }, { id: 23768, name: "Trio", year: null }] },
      { id: "game-none", slug: "none", name: "None", why: "no-id", candidates: [], exact: [] },
    ])
    expect(text).toContain("for 3 games")
    expect(text).toContain('azul ("Azul") · one result has exactly this name: 230802')
    expect(text).toContain("230802  Azul (2017)")
    expect(text).toContain('trio ("Trio") · its BGG id is wrong\n')
    expect(text).toContain("23768  Trio\n")
    expect(text).toContain('none ("None"): no result')
  })

  it("says that every game has an id when there is no one to say", () => {
    expect(describeCandidates([])).toBe("Every game has a BGG id that matches it.")
  })
})
