import { describe, expect, it } from "vitest"
import { scrubCapture, scrubDeep, scrubText } from "./scrub"

describe("scrubText", () => {
  it("replaces the code of a table, wherever the address appears", () => {
    expect(scrubText("https://playboardgamesonline.app/hanabi/game/ABC123")).toBe(
      "https://playboardgamesonline.app/hanabi/game/:code",
    )
    expect(scrubText("/hanabi/game/ABC123?lang=fr#chat")).toBe("/hanabi/game/:code?lang=fr#chat")
    expect(scrubText("/6-nimmt/game/Z9Y8X7")).toBe("/6-nimmt/game/:code")
    expect(scrubText("from /a/game/AAAAAA to /b/game/BBBBBB")).toBe("from /a/game/:code to /b/game/:code")
  })

  it("replaces it in the API address of a table too", () => {
    expect(scrubText("/api/hanabi/games/ABC123")).toBe("/api/hanabi/games/:code")
    expect(scrubText("https://x.app/api/hanabi/games/ABC123/chat?x=1")).toBe("https://x.app/api/hanabi/games/:code/chat?x=1")
  })

  it("replaces the code the tab title of a table spells, in two groups after a #", () => {
    expect(scrubText("Play Courtisans Online [PBGO] · Table #4XV-XA1")).toBe("Play Courtisans Online [PBGO] · Table #:code")
    expect(scrubText("Table #4xv-xa1")).toBe("Table #:code")
    expect(scrubText("#4XV-XA1")).toBe("#:code")
    expect(scrubText("#4XV-XA1 then #AAA-BBB")).toBe("#:code then #:code")
    expect(scrubText("(#4XV-XA1)")).toBe("(#:code)")
  })

  it("replaces both spellings of the code in the same text", () => {
    expect(scrubText("Table #4XV-XA1 at /hanabi/game/4XVXA1")).toBe("Table #:code at /hanabi/game/:code")
  })

  it("leaves everything else alone", () => {
    for (const value of [
      "",
      "/",
      "/hanabi",
      "/hanabi/game",
      "/hanabi/game/",
      "/hanabi/game/ABC12",
      "/hanabi/game/ABC1234",
      "/hanabi/gameplay/ABC123",
      "/api/hanabi/games",
      "/api/hanabi/games/",
      "/gamemaster/hanabi/preview/game",
      "/legal",
      "/legal#cookies",
      "Create a game",
      "Play Courtisans Online [PBGO]",
      "Table #4XV",
      "Table #4XV-XA",
      "Table #4XVX-XA1",
      "Table #4XV-XA1Z",
      "Table 4XV-XA1",
      "id#4XV-XA1",
    ]) {
      expect(scrubText(value), value).toBe(value)
    }
  })
})

describe("scrubDeep", () => {
  it("scrubs every string of nested objects and arrays, without touching the input", () => {
    const input = {
      $current_url: "https://x.app/hanabi/game/ABC123",
      title: "Play Hanabi Online [PBGO] · Table #ABC-123",
      $set: { $current_url: "https://x.app/hanabi/game/ABC123" },
      $elements: [{ attr__href: "/hanabi/game/ABC123", nth_child: 2 }],
      count: 3,
      flag: true,
      nothing: null,
    }
    const output = scrubDeep(input)
    expect(output).toEqual({
      $current_url: "https://x.app/hanabi/game/:code",
      title: "Play Hanabi Online [PBGO] · Table #:code",
      $set: { $current_url: "https://x.app/hanabi/game/:code" },
      $elements: [{ attr__href: "/hanabi/game/:code", nth_child: 2 }],
      count: 3,
      flag: true,
      nothing: null,
    })
    expect(input.$current_url).toBe("https://x.app/hanabi/game/ABC123")
    expect(input.$elements[0].attr__href).toBe("/hanabi/game/ABC123")
  })

  it("returns class instances and primitives as they are", () => {
    const date = new Date(0)
    expect(scrubDeep(date)).toBe(date)
    expect(scrubDeep(42)).toBe(42)
    expect(scrubDeep(undefined)).toBeUndefined()
  })

  it("stops going down past a fixed depth instead of looping", () => {
    type Node = { next?: Node; value: string }
    const root: Node = { value: "/a/game/ABC123" }
    let node = root
    for (let i = 0; i < 20; i++) {
      node.next = { value: "/a/game/ABC123" }
      node = node.next
    }
    const output = scrubDeep(root)
    expect(output.value).toBe("/a/game/:code")
    let deepest = output
    while (deepest.next) deepest = deepest.next
    // The leaf past the depth limit keeps its original string; reaching it did not hang.
    expect(deepest.value).toBe("/a/game/ABC123")
  })
})

describe("scrubCapture", () => {
  it("scrubs the properties of an event", () => {
    const output = scrubCapture({
      event: "$pageview",
      properties: {
        $current_url: "https://x.app/hanabi/game/ABC123",
        $pathname: "/hanabi/game/ABC123",
        title: "Play Hanabi Online [PBGO] · Table #ABC-123",
      },
    })
    expect(output?.properties).toEqual({
      $current_url: "https://x.app/hanabi/game/:code",
      $pathname: "/hanabi/game/:code",
      title: "Play Hanabi Online [PBGO] · Table #:code",
    })
  })

  it("passes null through (an event dropped by an earlier hook)", () => {
    expect(scrubCapture(null)).toBeNull()
  })

  it("scrubs the page properties of a recording and leaves its payload to the recorder's own masking", () => {
    const data = [{ type: 4, data: { href: "https://x.app/hanabi/game/ABC123" } }]
    const snapshot = {
      event: "$snapshot",
      properties: { $current_url: "https://x.app/hanabi/game/ABC123", $session_id: "s1", $snapshot_data: data },
    }
    const output = scrubCapture(snapshot)
    expect(output?.properties).toEqual({
      $current_url: "https://x.app/hanabi/game/:code",
      $session_id: "s1",
      $snapshot_data: data,
    })
    // The payload is handed back as it is, not copied: a recording can be heavy.
    expect((output?.properties as { $snapshot_data: unknown }).$snapshot_data).toBe(data)
    expect(snapshot.properties.$current_url).toBe("https://x.app/hanabi/game/ABC123")
  })

  it("scrubs a recording that carries no payload like any other event", () => {
    const output = scrubCapture({ event: "$snapshot", properties: { $current_url: "https://x.app/hanabi/game/ABC123" } })
    expect(output?.properties).toEqual({ $current_url: "https://x.app/hanabi/game/:code" })
  })
})
