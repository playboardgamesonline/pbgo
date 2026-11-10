import { describe, expect, it } from "vitest"
import { PROFILE_PATH, PROFILE_SOURCES, TAG_MAX, TAG_MIN, checkTag, handleText, ownHandleOf, parseProfileSegment, profilePath, profileSourceOf, profileViewOf, tagOfRequest, tagText } from "./profile"

describe("tagText and handleText", () => {
  it("write a tag with its four digits", () => {
    expect(tagText(42)).toBe("0042")
    expect(tagText(1)).toBe("0001")
    expect(tagText(9999)).toBe("9999")
  })

  it("write a member as Alex#0042", () => {
    expect(handleText({ nickname: "Alex", tag: 42 })).toBe("Alex#0042")
    expect(handleText({ nickname: "Marly the Brave", tag: 7 })).toBe("Marly the Brave#0007")
  })
})

describe("profilePath", () => {
  it("is /player/<nickname>-<tag>", () => {
    expect(PROFILE_PATH).toBe("/player")
    expect(profilePath({ nickname: "Alex", tag: 42 })).toBe("/player/Alex-0042")
  })

  it("writes the nickname for a path", () => {
    expect(profilePath({ nickname: "Marly the Brave", tag: 7 })).toBe("/player/Marly%20the%20Brave-0007")
    expect(profilePath({ nickname: "Zoé", tag: 1 })).toBe("/player/Zo%C3%A9-0001")
    expect(profilePath({ nickname: "100%", tag: 12 })).toBe("/player/100%25-0012")
    expect(profilePath({ nickname: "A?B&C=D", tag: 12 })).toBe("/player/A%3FB%26C%3DD-0012")
  })

  it("says where the link is drawn, when it is told", () => {
    expect(profilePath({ nickname: "Alex", tag: 42 }, "leaderboard")).toBe("/player/Alex-0042?from=leaderboard")
  })
})

describe("parseProfileSegment", () => {
  it("reads the nickname and the tag", () => {
    expect(parseProfileSegment("Alex-0042")).toEqual({ nickname: "Alex", tag: 42 })
    expect(parseProfileSegment("alex-9999")).toEqual({ nickname: "alex", tag: 9999 })
  })

  it("takes the tag from the end, so that the nickname may hold dashes and digits", () => {
    expect(parseProfileSegment("Jean-Luc-0007")).toEqual({ nickname: "Jean-Luc", tag: 7 })
    expect(parseProfileSegment("A-1234-0042")).toEqual({ nickname: "A-1234", tag: 42 })
    expect(parseProfileSegment("2-1-0001")).toEqual({ nickname: "2-1", tag: 1 })
  })

  it("reads an address that is written for a path, or that came decoded", () => {
    expect(parseProfileSegment("Marly%20the%20Brave-0007")).toEqual({ nickname: "Marly the Brave", tag: 7 })
    expect(parseProfileSegment("Marly the Brave-0007")).toEqual({ nickname: "Marly the Brave", tag: 7 })
    expect(parseProfileSegment("Zo%C3%A9-0001")).toEqual({ nickname: "Zoé", tag: 1 })
    expect(parseProfileSegment("🎲-0001")).toEqual({ nickname: "🎲", tag: 1 })
    expect(parseProfileSegment("100%25-0012")).toEqual({ nickname: "100%", tag: 12 })
    // A "%" that starts no escape came decoded already
    expect(parseProfileSegment("100%-0012")).toEqual({ nickname: "100%", tag: 12 })
  })

  it("answers null for what no profile can be", () => {
    for (const segment of ["", "-0042", "Alex", "Alex-", "Alex-42", "Alex-004", "Alex-00420", "Alex-abcd", "Alex-0000", "Alex 0042", "Alex_0042"]) expect(parseProfileSegment(segment), segment).toBeNull()
  })

  it("answers null for a nickname that the profiles refuse", () => {
    expect(parseProfileSegment(`${"a".repeat(21)}-0042`)).toBeNull()
    expect(parseProfileSegment(`${"a".repeat(20)}-0042`)).not.toBeNull()
    expect(parseProfileSegment(`${"🎲".repeat(21)}-0042`)).toBeNull()
    for (const segment of ["A%2FB-0042", "A%5CB-0042", "A%23B-0042", "A%2F%2E%2E-0042", " Alex-0042", "Alex%20-0042", "A%20%20B-0042", "A%0AB-0042"]) expect(parseProfileSegment(segment), segment).toBeNull()
  })

  it("comes back to the handle that the path was made from", () => {
    for (const nickname of ["Alex", "Marly the Brave", "Zoé", "🎲🎲", "Jean-Luc", "100%", "A?B&C=D", "a.b", "(pro)", "It's", "~x~", "Ünï cödé", "日本語"]) {
      const path = profilePath({ nickname, tag: 123 })
      expect(parseProfileSegment(path.slice(`${PROFILE_PATH}/`.length)), path).toEqual({ nickname, tag: 123 })
    }
  })
})

describe("checkTag", () => {
  it("takes a tag as a member types it", () => {
    expect(checkTag("42")).toEqual({ ok: true, tag: 42 })
    expect(checkTag("0042")).toEqual({ ok: true, tag: 42 })
    expect(checkTag(" #0042 ")).toEqual({ ok: true, tag: 42 })
    expect(checkTag("9999")).toEqual({ ok: true, tag: TAG_MAX })
    expect(checkTag("1")).toEqual({ ok: true, tag: TAG_MIN })
  })

  it("asks for one", () => {
    expect(checkTag("")).toEqual({ ok: false, problem: "Enter a tag." })
    expect(checkTag("  #  ")).toEqual({ ok: false, problem: "Enter a tag." })
  })

  it("refuses what is not four digits at most", () => {
    for (const text of ["12345", "00001", "4a", "-4", "4.2", "1e3", "٣٣", "42 7"]) expect(checkTag(text), text).toEqual({ ok: false, problem: "A tag is up to 4 digits." })
  })

  it("refuses 0, which is no tag", () => {
    expect(checkTag("0")).toEqual({ ok: false, problem: "A tag is 0001 or more." })
    expect(checkTag("0000")).toEqual({ ok: false, problem: "A tag is 0001 or more." })
  })
})

describe("tagOfRequest", () => {
  it("takes a whole number in range, or the text a member typed", () => {
    expect(tagOfRequest(42)).toBe(42)
    expect(tagOfRequest("0042")).toBe(42)
    expect(tagOfRequest("#7")).toBe(7)
  })

  it("answers null for the rest", () => {
    for (const value of [0, 10000, -1, 4.2, Number.NaN, "0", "10000", "", "x", null, undefined, true, {}, [42]]) expect(tagOfRequest(value), String(value)).toBeNull()
  })
})

describe("profileSourceOf", () => {
  it("knows the places a link is drawn", () => {
    for (const source of PROFILE_SOURCES) expect(profileSourceOf(source)).toBe(source)
  })

  it("takes nothing else a link might say", () => {
    for (const value of ["", "other", "SEAT", null, undefined, 3, ["seat"], "seat&x=1"]) expect(profileSourceOf(value)).toBeNull()
  })
})

describe("profileViewOf", () => {
  const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
  const BOB = "5c3e1d8a-1f2b-4c47-8a9e-6d0b7e2f4a90"
  const open = { userId: ANN, hideHistory: false }
  const hidden = { userId: ANN, hideHistory: true }

  it("shows the games of a member who does not hide them to everybody, a guest included", () => {
    expect(profileViewOf(open, null)).toEqual({ own: false, showGames: true })
    expect(profileViewOf(open, { id: BOB })).toEqual({ own: false, showGames: true })
    expect(profileViewOf(open, { id: ANN })).toEqual({ own: true, showGames: true })
  })

  it("shows the games of a member who hides them to nobody but themselves", () => {
    expect(profileViewOf(hidden, null)).toEqual({ own: false, showGames: false })
    expect(profileViewOf(hidden, { id: BOB })).toEqual({ own: false, showGames: false })
    expect(profileViewOf(hidden, { id: ANN })).toEqual({ own: true, showGames: true })
  })

  it("never takes the development account for a member: its id is no account's", () => {
    expect(profileViewOf(hidden, { id: "demo" })).toEqual({ own: false, showGames: false })
    expect(profileViewOf(open, { id: "demo" })).toEqual({ own: false, showGames: true })
  })

  it("compares accounts exactly: an account that looks like the member's is not the member", () => {
    expect(profileViewOf(hidden, { id: ANN.toUpperCase() }).own).toBe(false)
    expect(profileViewOf(hidden, { id: ` ${ANN}` }).showGames).toBe(false)
  })
})

describe("ownHandleOf", () => {
  it("reads the nickname and the tag that the route answers", () => {
    expect(ownHandleOf({ nickname: "Alex", tag: 42 })).toEqual({ nickname: "Alex", tag: 42 })
    expect(ownHandleOf({ nickname: "🎲".repeat(20), tag: TAG_MAX })).toEqual({ nickname: "🎲".repeat(20), tag: TAG_MAX })
    expect(ownHandleOf({ nickname: "Alex", tag: TAG_MIN, extra: "ignored" })).toEqual({ nickname: "Alex", tag: TAG_MIN })
  })

  it("reads a name with no tag, which is where the database has no profile for the member", () => {
    expect(ownHandleOf({ nickname: "Alex", tag: null })).toEqual({ nickname: "Alex", tag: null })
  })

  it("answers null for what the route never sends, so that a browser draws nothing it was not told", () => {
    for (const body of [null, undefined, "Alex#0042", 42, [], { tag: 42 }, { nickname: "", tag: 42 }, { nickname: 7, tag: 42 }, { nickname: "a".repeat(21), tag: 42 }, { nickname: "Alex" }, { nickname: "Alex", tag: 0 }, { nickname: "Alex", tag: 10000 }, { nickname: "Alex", tag: 4.2 }, { nickname: "Alex", tag: "42" }]) {
      expect(ownHandleOf(body), JSON.stringify(body)).toBeNull()
    }
  })
})
