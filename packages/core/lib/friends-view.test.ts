import { describe, expect, it } from "vitest"
import { conversationsOf, friendOf, groupMemberOf, groupOfEntry, handleOfPerson, invitationOfEntry, messageOfChat, panelOf, personKey, requestOf } from "./friends-view"
import type { FriendEntry, RequestEntry } from "./friends"
import { MAX_GROUP_MEMBERS, type GroupEntry, type GroupMemberEntry } from "./groups"

const person = { nickname: "Bob", tag: 42, avatarUrl: "https://cdn.example/bob.png" }
const entry = (over: Partial<FriendEntry> = {}): FriendEntry => ({ ...person, online: true, game: null, phase: null, group: "none", pending: null, ...over })
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

  it("says whether a friend is in a group, and what waits for their answer, only when there is something to say", () => {
    expect(friendOf(entry({ group: "yours" })).group).toBe("yours")
    expect(friendOf(entry({ group: "other", pending: "requested" }))).toMatchObject({ group: "other", pending: "requested" })
    expect(friendOf(entry({ pending: "invited" }))).toMatchObject({ pending: "invited" })
    const plain = friendOf(entry())
    expect("group" in plain).toBe(false)
    expect("pending" in plain).toBe(false)
  })
})

describe("the group", () => {
  const member = (over: Partial<GroupMemberEntry> = {}): GroupMemberEntry => ({ ...person, leader: false, you: false, online: true, game: null, phase: null, ...over })
  const group: GroupEntry = { members: [member({ nickname: "Ann", tag: 1, leader: true, you: true }), member(), member({ nickname: "Cat", tag: 3, online: false })] }

  it("draws a member the way a friend is drawn, with who leads and who the visitor is", () => {
    expect(groupMemberOf(member({ game: COURTISANS, phase: "lobby" }))).toEqual({
      id: "bob#42",
      nickname: "Bob",
      tag: "0042",
      avatarUrl: "https://cdn.example/bob.png",
      status: "online",
      game: COURTISANS,
      activity: "In the lobby",
      leader: false,
      you: false,
    })
    expect(groupMemberOf(member({ game: COURTISANS, phase: "playing" })).status).toBe("playing")
    expect(groupMemberOf(member({ online: false })).status).toBe("offline")
    expect(groupMemberOf(member({ online: false, game: COURTISANS, phase: "playing" })).game).toBeUndefined()
  })

  it("draws the visitor as online whatever the last beat of their tab said: they are here", () => {
    expect(groupMemberOf(member({ you: true, online: false })).status).toBe("online")
  })

  it("is the group the panel draws, with the most it can hold, or none", () => {
    expect(groupOfEntry(group)).toMatchObject({ max: MAX_GROUP_MEMBERS })
    expect(groupOfEntry(group)?.members.map((one) => [one.nickname, one.leader, one.you])).toEqual([["Ann", true, true], ["Bob", false, false], ["Cat", false, false]])
    expect(groupOfEntry(null)).toBeNull()
  })

  it("comes with the state of the panel, none by default", () => {
    expect(panelOf({ friends: [], incoming: [], outgoing: [], group }).group?.members).toHaveLength(3)
    expect(panelOf({ friends: [], incoming: [], outgoing: [] }).group).toBeNull()
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
    expect(panelOf({ friends: [], incoming: [], outgoing: [] })).toEqual({ friends: [], requests: [], invitations: [], conversations: [], group: null })
  })

  it("draw the invitations to a table with who invited, the game and the time, and never a code", () => {
    const invitation = { kind: "table" as const, id: "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e", from: { nickname: "Cat", tag: 3, avatarUrl: null }, game: COURTISANS, at, expiresAt: "2026-11-09T10:30:00.000Z" }
    const { invitations } = panelOf({ friends: [], incoming: [], outgoing: [], invitations: [invitation] })
    expect(invitations).toEqual([{ kind: "table", id: invitation.id, nickname: "Cat", tag: "0003", avatarUrl: null, game: COURTISANS, expiresAt: "2026-11-09T10:30:00.000Z" }])
  })

  it("draw an invitation to a group, or a request to join one, with who sent it and no game", () => {
    const base = { id: "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e", from: { nickname: "Cat", tag: 3, avatarUrl: null }, at, expiresAt: "2026-11-09T10:30:00.000Z" }
    expect(invitationOfEntry({ ...base, kind: "group" })).toEqual({ kind: "group", id: base.id, nickname: "Cat", tag: "0003", avatarUrl: null, expiresAt: base.expiresAt })
    expect(invitationOfEntry({ ...base, kind: "join" })).toEqual({ kind: "join", id: base.id, nickname: "Cat", tag: "0003", avatarUrl: null, expiresAt: base.expiresAt })
    expect("game" in invitationOfEntry({ ...base, kind: "group" })).toBe(false)
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

describe("conversationsOf", () => {
  const bob = friendOf(entry())
  const last = { ...person, unread: 2, lastText: "see you", lastAt: "2026-11-13T10:00:00.000Z", lastMine: false }

  it("draws a conversation with its friend, the count of what is not read and the last message, who wrote it said", () => {
    expect(conversationsOf([last], [bob])).toEqual([{ id: "chat:bob#42", friend: bob, unread: 2, messages: [{ id: "last:bob#42", from: "them", text: "see you", at: "2026-11-13T10:00:00.000Z" }] }])
    expect(conversationsOf([{ ...last, lastMine: true }], [bob])[0]?.messages[0]?.from).toBe("me")
  })

  it("leaves out a conversation with somebody who is not a friend of the list, and keeps the order it was given", () => {
    const cat = { ...last, nickname: "Cat", tag: 7 }
    expect(conversationsOf([cat, last], [bob]).map((conversation) => conversation.friend.id)).toEqual(["bob#42"])
  })

  it("comes with the state of the panel", () => {
    expect(panelOf({ friends: [entry()], incoming: [], outgoing: [], conversations: [last] }).conversations).toHaveLength(1)
  })
})

describe("messageOfChat", () => {
  it("is the message the chat window draws, its id as text", () => {
    expect(messageOfChat({ id: 5, mine: true, text: "x", at: "2026-11-13T10:00:00.000Z" })).toEqual({ id: "5", from: "me", text: "x", at: "2026-11-13T10:00:00.000Z" })
    expect(messageOfChat({ id: 6, mine: false, text: "y", at: "2026-11-13T10:00:00.000Z" }).from).toBe("them")
  })
})
