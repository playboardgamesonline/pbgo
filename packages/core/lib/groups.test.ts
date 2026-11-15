import { describe, expect, it } from "vitest"
import { GROUPS_PATH, GROUP_ACTIONS, MAX_GROUP_MEMBERS, groupActionPath, groupEntryOf, groupRelationOf, isUuid, pendingOf, youLeadGroup } from "./groups"

const member = (nickname: string, tag: number, over: Record<string, unknown> = {}) => ({ nickname, tag, avatarUrl: null, leader: false, you: false, online: true, game: null, phase: null, ...over })
const GROUP = { members: [member("Ann", 1, { leader: true, you: true }), member("Bob", 2), member("Cat", 3, { online: false })] }

describe("the groups' constants", () => {
  it("cap a group at eight members, the leader included", () => {
    expect(MAX_GROUP_MEMBERS).toBe(8)
  })

  it("are one address for each action, under the groups'", () => {
    expect(GROUPS_PATH).toBe("/api/hub/groups")
    expect(GROUP_ACTIONS.map(groupActionPath)).toEqual(["/api/hub/groups/leave", "/api/hub/groups/kick", "/api/hub/groups/lead"])
  })
})

describe("isUuid", () => {
  it("is a UUID and nothing else", () => {
    const id = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
    expect(isUuid(id)).toBe(true)
    expect(isUuid(id.toUpperCase())).toBe(true)
    for (const value of ["", "1", `${id}x`, ` ${id}`, 7, null, undefined, { id }]) expect(isUuid(value)).toBe(false)
  })
})

describe("groupRelationOf and pendingOf", () => {
  it("keep the words of the wire and take any other for none", () => {
    expect(["yours", "other", "none", "mine", undefined, 4].map(groupRelationOf)).toEqual(["yours", "other", "none", "none", "none", "none"])
    expect(["invited", "requested", "waiting", undefined, null].map(pendingOf)).toEqual(["invited", "requested", null, null, null])
  })
})

describe("groupEntryOf", () => {
  it("reads the group the server says: its members, who leads, who the visitor is", () => {
    expect(groupEntryOf(GROUP)).toEqual(GROUP)
  })

  it("shows a member at a game only while they are online and the game has a name, with its phase", () => {
    const named = { slug: "hanabi", name: "Hanabi" }
    const entry = groupEntryOf({
      members: [
        member("Ann", 1, { you: true, leader: true, game: named, phase: "playing" }),
        member("Bob", 2, { online: false, game: named, phase: "lobby" }),
        member("Cat", 3, { game: { slug: "hanabi" }, phase: "lobby" }),
        member("Dan", 4, { game: named, phase: "later" }),
      ],
    })!
    expect(entry.members.map((one) => one.game?.slug ?? null)).toEqual(["hanabi", null, null, null])
    expect(entry.members.map((one) => one.phase)).toEqual(["playing", null, null, null])
  })

  it("is none for a group of one person, one the member is not in, or what is not a group", () => {
    expect(groupEntryOf({ members: [member("Ann", 1, { you: true })] })).toBeNull()
    expect(groupEntryOf({ members: [member("Ann", 1), member("Bob", 2)] })).toBeNull()
    for (const bad of [null, undefined, "x", 3, [], {}, { members: "x" }]) expect(groupEntryOf(bad)).toBeNull()
  })

  it("leaves out a member that is not what it should be, and a group that is then too small is nobody's", () => {
    expect(groupEntryOf({ members: [...GROUP.members, { nickname: "Dan" }, member("Eve", 0), { ...member("Fay", 6), leader: "yes" }, null] })?.members.map((one) => one.nickname)).toEqual(["Ann", "Bob", "Cat"])
    expect(groupEntryOf({ members: [member("Ann", 1, { you: true }), { nickname: "Bob" }] })).toBeNull()
  })

  it("never carries an account's id or a table's code, whatever the answer holds", () => {
    const text = JSON.stringify(groupEntryOf({ members: GROUP.members.map((one) => ({ ...one, user_id: "ACCOUNT-1", code: "K7Q2" })) }))
    expect(text).not.toContain("ACCOUNT-1")
    expect(text).not.toContain("K7Q2")
  })
})

describe("youLeadGroup", () => {
  it("is whether the member who is the visitor leads the group they are in", () => {
    expect(youLeadGroup(groupEntryOf(GROUP))).toBe(true)
    expect(youLeadGroup(groupEntryOf({ members: [member("Ann", 1, { leader: true }), member("Bob", 2, { you: true })] }))).toBe(false)
    expect(youLeadGroup(null)).toBe(false)
  })
})
