import { describe, expect, it } from "vitest"
import { openableTarget, publishedIds, publishLine } from "./pipeline.ts"

describe("the documents that publishing makes public", () => {
  const report = "Draft https://pbgo.sanity.studio/x\nValidate, or tell me what to change. Validate publishes 2 documents (game-love-letter, publisher-sample): the page is public within about eleven minutes."

  it("are read from the sentence of the skill's report, and nowhere else", () => {
    expect(publishedIds(report)).toEqual(["game-love-letter", "publisher-sample"])
    expect(publishedIds("Validate publishes 1 document (game-love-letter)")).toEqual(["game-love-letter"])
    expect(publishedIds("validate publishes 1 document (game-love-letter)")).toEqual(["game-love-letter"])
    expect(publishedIds("Validate publishes 3 documents (game-a, expansion-a-b, creator-c-d)")).toEqual(["game-a", "expansion-a-b", "creator-c-d"])
  })

  it("are none when the sentence is missing, or does not add up: the owner is shown the ids, and the call that publishes may publish these only", () => {
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
})

describe("what the o key opens", () => {
  it("is the platform's own addresses, the first of the report that is one, else the file", () => {
    expect(openableTarget(["https://pbgo.sanity.studio/intent/edit/id=game-x;type=game"], null)).toBe("https://pbgo.sanity.studio/intent/edit/id=game-x;type=game")
    expect(openableTarget(["https://evil.example/", "https://playboardgamesonline.app/game/x"], null)).toBe("https://playboardgamesonline.app/game/x")
    expect(openableTarget(["https://www.playboardgamesonline.app"], null)).toBe("https://www.playboardgamesonline.app")
    expect(openableTarget(["https://example.com/rules.pdf"], "/assets/x/scout.json")).toBe("/assets/x/scout.json")
    expect(openableTarget([], null)).toBeNull()
  })

  it("is never another address, whatever it looks like", () => {
    for (const link of [
      "https://evil.example/https://pbgo.sanity.studio/",
      "https://pbgo.sanity.studio.evil.example/",
      "https://playboardgamesonline.app.evil.example/",
      "https://xplayboardgamesonline.app/",
      "https://sanity.studio@evil.example/",
      "https://pbgo.sanity.studio:443@evil.example/",
      "https://evil.example/?next=https://pbgo.sanity.studio",
      "http://pbgo.sanity.studio/",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://localhost/",
    ]) {
      expect(openableTarget([link], null), link).toBeNull()
    }
  })
})
