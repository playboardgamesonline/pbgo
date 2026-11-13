import { describe, expect, it } from "vitest"
import { FRIENDS_PATH, FRIEND_ACTIONS, FRIEND_RELATIONS, FRIEND_REQUEST_SOURCES, MAX_BLOCKS, MAX_FRIENDS, MAX_REQUESTS_RECEIVED, MAX_REQUESTS_SENT, NO_SOCIAL, friendActionPath, handleOfBody, personOf, relationOf, requestSourceOf, socialStateOf } from "./friends"

describe("the limits", () => {
  it("are written here, and are the owner's: 200 friends, 50 requests waiting, 100 sent, 500 blocks", () => {
    expect([MAX_FRIENDS, MAX_REQUESTS_RECEIVED, MAX_REQUESTS_SENT, MAX_BLOCKS]).toEqual([200, 50, 100, 500])
  })
})

describe("the routes", () => {
  it("are one address for each action, under the friends'", () => {
    expect(FRIENDS_PATH).toBe("/api/hub/friends")
    expect(FRIEND_ACTIONS.map(friendActionPath)).toEqual([
      "/api/hub/friends/request",
      "/api/hub/friends/accept",
      "/api/hub/friends/decline",
      "/api/hub/friends/cancel",
      "/api/hub/friends/remove",
      "/api/hub/friends/block",
      "/api/hub/friends/unblock",
    ])
  })
})

describe("handleOfBody", () => {
  it("is the nickname as a profile keeps it and the tag as a number", () => {
    expect(handleOfBody({ nickname: "Alex", tag: 42 })).toEqual({ nickname: "Alex", tag: 42 })
    expect(handleOfBody({ nickname: "  Marly   74 ", tag: "#0042" })).toEqual({ nickname: "Marly 74", tag: 42 })
  })

  it.each([{}, { nickname: "Alex" }, { tag: 42 }, { nickname: 7, tag: 42 }, { nickname: "", tag: 42 }, { nickname: "A#B", tag: 42 }, { nickname: "Alex", tag: 0 }, { nickname: "Alex", tag: 10000 }, { nickname: "Alex", tag: "x" }])("is nobody for %j", (body) => {
    expect(handleOfBody(body)).toBeNull()
  })
})

describe("requestSourceOf", () => {
  it("keeps the two places a request is sent from, and takes any other word for the form", () => {
    expect(FRIEND_REQUEST_SOURCES).toEqual(["form", "profile"])
    expect(requestSourceOf("profile")).toBe("profile")
    expect(requestSourceOf("form")).toBe("form")
    for (const other of [undefined, null, 3, "", "PROFILE", "elsewhere", {}]) expect(requestSourceOf(other)).toBe("form")
  })
})

describe("personOf", () => {
  it("is a nickname of 1 to 20 characters, a tag in range and a picture that is an https address", () => {
    expect(personOf({ nickname: "Ann", tag: 1, avatarUrl: "https://cdn.example/a.png" })).toEqual({ nickname: "Ann", tag: 1, avatarUrl: "https://cdn.example/a.png" })
    expect(personOf({ nickname: "🎲".repeat(20), tag: 9999 })).toEqual({ nickname: "🎲".repeat(20), tag: 9999, avatarUrl: null })
  })

  it.each([null, "Ann", 4, [], { tag: 1 }, { nickname: "", tag: 1 }, { nickname: "a".repeat(21), tag: 1 }, { nickname: "Ann", tag: 0 }, { nickname: "Ann", tag: 10000 }, { nickname: "Ann", tag: 1.5 }, { nickname: "Ann", tag: "1" }])("is nobody for %j", (value) => {
    expect(personOf(value)).toBeNull()
  })

  it("draws no picture that is not an https address, or that is too long", () => {
    expect(personOf({ nickname: "Ann", tag: 1, avatarUrl: "http://cdn.example/a.png" })?.avatarUrl).toBeNull()
    expect(personOf({ nickname: "Ann", tag: 1, avatarUrl: "javascript:alert(1)" })?.avatarUrl).toBeNull()
    expect(personOf({ nickname: "Ann", tag: 1, avatarUrl: `https://cdn.example/${"a".repeat(2100)}` })?.avatarUrl).toBeNull()
  })
})

describe("socialStateOf", () => {
  const good = {
    friends: [{ nickname: "Bob", tag: 2, avatarUrl: null, online: true, game: { slug: "courtisans", name: "Courtisans" }, phase: "lobby" }],
    incoming: [{ nickname: "Cat", tag: 3, avatarUrl: null, at: "2026-11-09T10:00:00.000Z" }],
    outgoing: [{ nickname: "Dan", tag: 4, avatarUrl: null, at: "2026-11-08T10:00:00.000Z" }],
    blocked: [{ nickname: "Eve", tag: 5, avatarUrl: null }],
    invitations: [{ id: "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e", from: { nickname: "Fay", tag: 6, avatarUrl: null }, game: { slug: "hanabi", name: "Hanabi" }, at: "2026-11-13T10:00:00.000Z", expiresAt: "2026-11-13T10:30:00.000Z" }],
  }

  it("reads an answer of a server that has no invitations as one with none", () => {
    const { invitations: _, ...older } = good
    expect(socialStateOf(older)?.invitations).toEqual([])
  })

  it("leaves out an invitation that is not one", () => {
    const [one] = good.invitations
    expect(socialStateOf({ ...good, invitations: [one, { ...one, id: "7" }, { ...one, game: { slug: "" , name: "x" } }, { ...one, at: "never" }, null, "x"] })?.invitations).toEqual([one])
  })

  it("reads the state a route answers", () => {
    expect(socialStateOf(good)).toEqual(good)
    expect(socialStateOf(NO_SOCIAL)).toEqual(NO_SOCIAL)
  })

  it("is none for what is not a state", () => {
    for (const body of [null, undefined, "x", 3, [], {}, { friends: [] }, { friends: [], incoming: [], outgoing: [], blocked: "x" }]) expect(socialStateOf(body)).toBeNull()
  })

  it("shows a friend at a game only while they are online, with its name and its phase", () => {
    const { friends } = socialStateOf({
      ...good,
      friends: [
        { nickname: "Bob", tag: 1, online: false, game: { slug: "courtisans", name: "Courtisans" }, phase: "lobby" },
        { nickname: "Cat", tag: 2, online: true, game: { slug: "courtisans" }, phase: "lobby" },
        { nickname: "Dan", tag: 3, online: true, game: { slug: "courtisans", name: "Courtisans" }, phase: "later" },
        { nickname: "Eve", tag: 4, online: true, game: { slug: "courtisans", name: "Courtisans" }, phase: "playing" },
      ],
    })!
    expect(friends.map((friend) => friend.game?.slug ?? null)).toEqual([null, null, null, "courtisans"])
    expect(friends.map((friend) => friend.phase)).toEqual([null, null, null, "playing"])
  })

  it("drops the entries that are not what they should be, and the requests that have no date", () => {
    const state = socialStateOf({
      friends: [{ nickname: "Bob", tag: 0, online: true }, { nickname: "Ann", tag: 1, online: "yes" }, { nickname: "Cat", tag: 3, online: false }],
      incoming: [{ nickname: "Dan", tag: 4 }, { nickname: "Eve", tag: 5, at: "yesterday" }],
      outgoing: "none",
      blocked: [null, { nickname: "Fay", tag: 6 }],
    } as never)
    expect(state).toBeNull()
    const lenient = socialStateOf({
      friends: [{ nickname: "Bob", tag: 0, online: true }, { nickname: "Ann", tag: 1, online: "yes" }, { nickname: "Cat", tag: 3, online: false }],
      incoming: [{ nickname: "Dan", tag: 4 }, { nickname: "Eve", tag: 5, at: "yesterday" }],
      outgoing: [],
      blocked: [null, { nickname: "Fay", tag: 6 }],
    })!
    expect(lenient.friends.map((friend) => friend.nickname)).toEqual(["Cat"])
    expect(lenient.incoming).toEqual([])
    expect(lenient.blocked).toEqual([{ nickname: "Fay", tag: 6, avatarUrl: null }])
  })
})

describe("relationOf", () => {
  it("keeps the five relations, and takes any other word for none", () => {
    expect(FRIEND_RELATIONS).toEqual(["none", "friends", "incoming", "outgoing", "blocked"])
    for (const relation of FRIEND_RELATIONS) expect(relationOf(relation)).toBe(relation)
    for (const other of [undefined, null, 1, "", "Friends", "enemies", {}]) expect(relationOf(other)).toBe("none")
  })
})
