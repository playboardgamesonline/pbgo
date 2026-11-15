import { describe, expect, it } from "vitest"
import { NO_GROUP_WATCH, watchGroup } from "./group-toasts"
import type { GroupEntry, GroupMemberEntry } from "./groups"

const member = (nickname: string, tag: number, over: Partial<GroupMemberEntry> = {}): GroupMemberEntry => ({ nickname, tag, avatarUrl: null, leader: false, you: false, online: true, game: null, phase: null, ...over })
const group = (...others: GroupMemberEntry[]): GroupEntry => ({ members: [member("Ann", 1, { you: true, leader: true }), ...others] })
const BOB = member("Bob", 2)
const CAT = member("Cat", 3)
const DAN = member("Dan", 4)

describe("watchGroup", () => {
  it("tells nothing at the first read of a tab, whatever it finds", () => {
    expect(watchGroup(NO_GROUP_WATCH, group(BOB))).toMatchObject({ joined: [], left: [], ended: false })
    expect(watchGroup(NO_GROUP_WATCH, null)).toMatchObject({ joined: [], left: [], ended: false })
  })

  it("tells a member whose invitation was accepted, who leads the group that it made, who is in it", () => {
    const first = watchGroup(NO_GROUP_WATCH, null)
    expect(watchGroup(first.watch, group(BOB))).toMatchObject({ entered: "host", joined: ["Bob"], left: [], ended: false })
    expect(watchGroup(first.watch, group(BOB, CAT)).joined).toEqual(["Bob", "Cat"])
  })

  it("says a member who is not the leader was let in, and lists nobody: the page knows whether they accepted an invitation themselves", () => {
    const first = watchGroup(NO_GROUP_WATCH, null)
    const letIn: GroupEntry = { members: [member("Ann", 1, { you: true }), member("Bob", 2, { leader: true }), CAT] }
    expect(watchGroup(first.watch, letIn)).toMatchObject({ entered: "guest", joined: [], left: [], ended: false })
  })

  it("says nothing of entering at the first read of a tab, for a member who is in a group already, or for one who has none", () => {
    expect(watchGroup(NO_GROUP_WATCH, group(BOB)).entered).toBeNull()
    const inGroup = watchGroup(NO_GROUP_WATCH, group(BOB)).watch
    expect(watchGroup(inGroup, group(BOB, CAT)).entered).toBeNull()
    expect(watchGroup(watchGroup(NO_GROUP_WATCH, null).watch, null).entered).toBeNull()
  })

  it("tells who joined the group since the last read, once", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(BOB)).watch
    const second = watchGroup(first, group(BOB, CAT, DAN))
    expect(second.joined).toEqual(["Cat", "Dan"])
    expect(second.left).toEqual([])
    expect(watchGroup(second.watch, group(BOB, CAT, DAN)).joined).toEqual([])
  })

  it("tells who left the group since the last read, and says nothing of why", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(BOB, CAT)).watch
    const second = watchGroup(first, group(CAT))
    expect(second).toMatchObject({ joined: [], left: ["Bob"], ended: false })
  })

  it("tells that the group is over when the member was in one and is in none", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(BOB)).watch
    const second = watchGroup(first, null)
    expect(second).toMatchObject({ joined: [], left: [], ended: true })
    expect(watchGroup(second.watch, null).ended).toBe(false)
  })

  it("never tells the member about themselves: they are in the group and are not one of the others", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(BOB)).watch
    expect(watchGroup(first, { members: [member("Ann", 1, { you: true }), BOB, CAT] }).joined).toEqual(["Cat"])
  })

  it("keeps a member and a namesake apart: the key is the handle", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(member("Bob", 2))).watch
    const second = watchGroup(first, group(member("Bob", 2), member("Bob", 22)))
    expect(second.joined).toEqual(["Bob"])
    expect(second.left).toEqual([])
  })

  it("tells a member who goes and comes back as left and then joined: they are two reads", () => {
    const first = watchGroup(NO_GROUP_WATCH, group(BOB, CAT)).watch
    const second = watchGroup(first, group(CAT))
    expect(second.left).toEqual(["Bob"])
    expect(watchGroup(second.watch, group(CAT, BOB)).joined).toEqual(["Bob"])
  })
})
