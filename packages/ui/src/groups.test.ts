import { describe, expect, it } from "vitest"
import { isFull, orderedMembers, sizeLine, youLead, type Group, type GroupMember } from "./groups"

const member = (id: string, rest: Partial<GroupMember> = {}): GroupMember => ({ id, nickname: id, status: "online", leader: false, you: false, ...rest })
const group = (members: GroupMember[], max = 8): Group => ({ members, max })

describe("youLead", () => {
  it("is true when the visitor is the leader, and not when somebody else is, or when the visitor is not in the list", () => {
    expect(youLead(group([member("a", { you: true, leader: true }), member("b")]))).toBe(true)
    expect(youLead(group([member("a", { leader: true }), member("b", { you: true })]))).toBe(false)
    expect(youLead(group([member("a", { leader: true }), member("b")]))).toBe(false)
  })
})

describe("isFull and sizeLine", () => {
  it("is full with all the members the group takes, and says how many are in it out of how many it takes", () => {
    expect(isFull(group([member("a"), member("b")], 2))).toBe(true)
    expect(isFull(group([member("a"), member("b")], 8))).toBe(false)
    expect(sizeLine(group([member("a"), member("b"), member("c")], 8))).toBe("3 of 8")
  })
})

describe("orderedMembers", () => {
  it("puts the leader first and keeps the others in the order they came", () => {
    const list = group([member("a"), member("b"), member("c", { leader: true }), member("d")])
    expect(orderedMembers(list).map((one) => one.id)).toEqual(["c", "a", "b", "d"])
  })

  it("leaves the group it is given as it is", () => {
    const list = group([member("a"), member("b", { leader: true })])
    orderedMembers(list)
    expect(list.members.map((one) => one.id)).toEqual(["a", "b"])
  })
})
