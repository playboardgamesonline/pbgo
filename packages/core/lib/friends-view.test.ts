import { describe, expect, it } from "vitest"
import { friendOf, handleOfPerson, panelOf, personKey, requestOf } from "./friends-view"
import type { FriendEntry, RequestEntry } from "./friends"

const person = { nickname: "Bob", tag: 42, avatarUrl: "https://cdn.example/bob.png" }
const entry = (over: Partial<FriendEntry> = {}): FriendEntry => ({ ...person, online: true, game: null, phase: null, ...over })
const COURTISANS = { slug: "courtisans", name: "Courtisans" }

describe("personKey", () => {
  it("is the handle in lower case, so that two members of one name are two keys and one member is one", () => {
    expect(personKey({ nickname: "Bob", tag: 42 })).toBe("bob#42")
    expect(personKey({ nickname: "BOB", tag: 42 })).toBe(personKey({ nickname: "bob", tag: 42 }))
    expect(personKey({ nickname: "Bob", tag: 43 })).not.toBe(personKey({ nickname: "Bob", tag: 42 }))
  })
})

describe("friendOf", () => {
  it("draws a friend who is online and at no game as online, with their handle", () => {
    expect(friendOf(entry())).toEqual({ id: "bob#42", nickname: "Bob", tag: "0042", avatarUrl: "https://cdn.example/bob.png", status: "online" })
  })

  it("draws one who is not online as offline, and at no game even when the entry names one", () => {
    expect(friendOf(entry({ online: false }))).toEqual({ id: "bob#42", nickname: "Bob", tag: "0042", avatarUrl: "https://cdn.example/bob.png", status: "offline" })
    expect(friendOf(entry({ online: false, game: COURTISANS, phase: "playing" })).game).toBeUndefined()
  })

  it("draws one at a game that is played as playing, at that game", () => {
    const friend = friendOf(entry({ game: COURTISANS, phase: "playing" }))
    expect(friend.status).toBe("playing")
    expect(friend.game).toEqual(COURTISANS)
    expect(friend.activity).toBeUndefined()
  })

  it("draws one who waits in the lobby of a game as online at it, and says so", () => {
    const friend = friendOf(entry({ game: COURTISANS, phase: "lobby" }))
    expect(friend.status).toBe("online")
    expect(friend.game).toEqual(COURTISANS)
    expect(friend.activity).toBe("In the lobby")
  })

  it("never draws a table: the panel has none to join", () => {
    expect(friendOf(entry({ game: COURTISANS, phase: "playing" })).table).toBeUndefined()
    expect(Object.keys(friendOf(entry({ game: COURTISANS, phase: "lobby" }))).sort()).toEqual(["activity", "avatarUrl", "game", "id", "nickname", "status", "tag"])
  })

  it("keeps a picture that is none", () => {
    expect(friendOf(entry({ avatarUrl: null })).avatarUrl).toBeNull()
  })
})

describe("requestOf and panelOf", () => {
  const at = "2026-11-09T10:00:00.000Z"
  const request = (nickname: string, tag: number): RequestEntry => ({ nickname, tag, avatarUrl: null, at })

  it("draw a request with its direction, and with a key that no request of the other direction shares", () => {
    expect(requestOf(request("Cat", 3), "incoming")).toEqual({ id: "incoming:cat#3", nickname: "Cat", tag: "0003", avatarUrl: null, direction: "incoming" })
    expect(requestOf(request("Cat", 3), "outgoing").id).toBe("outgoing:cat#3")
  })

  it("put the requests that came in before those that went out, each list in the order it came", () => {
    const panel = panelOf({ friends: [entry()], incoming: [request("Cat", 3), request("Dan", 4)], outgoing: [request("Eve", 5)] })
    expect(panel.friends.map((friend) => friend.id)).toEqual(["bob#42"])
    expect(panel.requests.map((item) => [item.direction, item.nickname])).toEqual([["incoming", "Cat"], ["incoming", "Dan"], ["outgoing", "Eve"]])
  })

  it("draw nobody for a state with nobody", () => {
    expect(panelOf({ friends: [], incoming: [], outgoing: [] })).toEqual({ friends: [], requests: [], invitations: [] })
  })

  it("draw the invitations to a table with who invited, the game and the time, and never a code", () => {
    const invitation = { id: "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e", from: { nickname: "Cat", tag: 3, avatarUrl: null }, game: COURTISANS, at, expiresAt: "2026-11-09T10:30:00.000Z" }
    const { invitations } = panelOf({ friends: [], incoming: [], outgoing: [], invitations: [invitation] })
    expect(invitations).toEqual([{ id: invitation.id, nickname: "Cat", tag: "0003", avatarUrl: null, game: COURTISANS, expiresAt: "2026-11-09T10:30:00.000Z" }])
  })
})

describe("handleOfPerson", () => {
  it("is the handle that names somebody the panel draws, the tag written with its digits or not", () => {
    expect(handleOfPerson({ nickname: "Bob", tag: "0042" })).toEqual({ nickname: "Bob", tag: 42 })
    expect(handleOfPerson({ nickname: "Bob", tag: "7" })).toEqual({ nickname: "Bob", tag: 7 })
    expect(handleOfPerson(friendOf(entry()))).toEqual({ nickname: "Bob", tag: 42 })
  })

  it("is nobody without a tag, with a tag out of range, or without a name", () => {
    for (const bad of [{ nickname: "Bob" }, { nickname: "Bob", tag: null }, { nickname: "Bob", tag: "" }, { nickname: "Bob", tag: "0000" }, { nickname: "Bob", tag: "10000" }, { nickname: "Bob", tag: "4.2" }, { nickname: "Bob", tag: "x" }, { nickname: "", tag: "0042" }]) {
      expect(handleOfPerson(bad)).toBeNull()
    }
  })
})
