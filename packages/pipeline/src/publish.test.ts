import { describe, expect, it } from "vitest"
import { isPublishedId, publishedIds, publishLine } from "./publish.ts"

describe("the documents that publishing makes public", () => {
  const report = "Draft https://pbgo.sanity.studio/x\nValidate, or tell me what to change. Validate publishes 2 documents (game-love-letter, publisher-sample): the page is public within about eleven minutes."

  it("are read from the sentence of the skill's report, and nowhere else", () => {
    expect(publishedIds(report)).toEqual(["game-love-letter", "publisher-sample"])
    expect(publishedIds("Validate publishes 1 document (game-love-letter)")).toEqual(["game-love-letter"])
    expect(publishedIds("validate publishes 1 document (game-love-letter)")).toEqual(["game-love-letter"])
    expect(publishedIds("Validate publishes 3 documents (game-a, expansion-a-b, creator-c-d)")).toEqual(["game-a", "expansion-a-b", "creator-c-d"])
  })

  it("are none when the sentence is missing, or does not add up: the owner is shown the ids, and these are the only ones that may be published", () => {
    expect(publishedIds("The drafts are right.")).toEqual([])
    expect(publishedIds("")).toEqual([])
    // the count says three and the list holds two, or one id twice
    expect(publishedIds("Validate publishes 3 documents (game-a, publisher-b)")).toEqual([])
    expect(publishedIds("Validate publishes 2 documents (game-a, game-a)")).toEqual([])
    // an id that is not one a draft can be published under
    for (const list of ["drafts.game-a", "game-a, settings", "game-A", "game-a; publisher-b", "*", "game-a, "]) expect(publishedIds(`Validate publishes 2 documents (${list})`), list).toEqual([])
    expect(publishedIds("Validate publishes 0 documents ()")).toEqual([])
  })

  it("make the line of the second gate, or none", () => {
    expect(publishLine(report)).toBe("publish makes 2 documents public (game-love-letter, publisher-sample): they are on the hub within about eleven minutes.")
    expect(publishLine("Validate publishes 1 document (game-love-letter)")).toContain("publish makes 1 document public (game-love-letter)")
    expect(publishLine("nothing")).toBeNull()
  })

  it("name the types of the catalog and nothing else", () => {
    for (const id of ["game-x", "expansion-x-y", "creator-ann-lee", "publisher-kosmos", "category-cooperative"]) expect(isPublishedId(id), id).toBe(true)
    for (const id of ["settings", "drafts.game-x", "game-", "Game-x", "game-x-", "page-x"]) expect(isPublishedId(id), id).toBe(false)
  })
})
