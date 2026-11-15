import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Friend } from "./friends"
import type { Group, GroupMember } from "./groups"
import type { FriendRequest } from "./social"
import { AddFriendForm } from "./platform/add-friend-form"
import { FriendsPanel, FriendsRoster } from "./platform/friends-panel"
import { GroupPane } from "./platform/group-panel"
import { SocialPanel } from "./platform/social-panel"

// The friends' list of a real account (PLT-23) by its markup: who it names, what is masked in a recording, which buttons it has. The menu of a friend is behind its button, so what is checked is the button.

const BOB: Friend = { id: "bob#42", nickname: "Bob", tag: "0042", avatarUrl: null, status: "online", game: { slug: "courtisans", name: "Courtisans" }, activity: "In the lobby" }
const CAT: Friend = { id: "cat#7", nickname: "Cat", tag: "0007", avatarUrl: null, status: "offline" }
const REQUEST: FriendRequest = { id: "incoming:dan#4", nickname: "Dan", tag: "0004", avatarUrl: null, direction: "incoming" }
const nothing = () => {}

const roster = (props: Partial<React.ComponentProps<typeof FriendsRoster>> = {}) => renderToStaticMarkup(React.createElement(FriendsRoster, { friends: [BOB, CAT], ...props }))

describe("FriendsRoster", () => {
  it("names each friend with their tag, masked in a recording", () => {
    const html = roster()
    expect(html).toContain('<p class="ph-mask truncate text-sm text-foreground">Bob<span class="text-muted-foreground">#0042</span></p>')
    expect(html).toContain("Cat")
    expect(html.match(/ph-mask/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("has no menu when the page gives none of its handlers", () => {
    expect(roster()).not.toContain("More about")
  })

  it.each([
    ["onViewProfile", { onViewProfile: nothing }],
    ["onRemove", { onRemove: nothing }],
    ["onBlock", { onBlock: nothing }],
  ])("has the menu of each friend as soon as the page gives %s", (_name, handlers) => {
    const html = roster(handlers)
    expect(html).toContain('aria-label="More about Bob"')
    expect(html).toContain('aria-label="More about Cat"')
    expect(html.match(/aria-label="More about /g)).toHaveLength(2)
  })

  it("draws the button of the menu as a button of its own, on the row and not inside the one that opens a conversation", () => {
    const html = roster({ onRemove: nothing, onOpen: nothing })
    const row = /<li[^>]*data-status="online"[\s\S]*?<\/li>/.exec(html)?.[0] ?? ""
    expect(row).toContain('title="Message Bob"')
    expect(row.indexOf('title="Message Bob"')).toBeLessThan(row.indexOf("More about Bob"))
    // The menu is not nested in the button that opens the chat
    expect(/<button[^>]*title="Message Bob"[\s\S]*?<\/button>/.exec(row)?.[0]).not.toContain("More about")
  })

  it("opens no conversation without a handler for it: a row is not a button", () => {
    const html = roster({ onRemove: nothing })
    expect(html).not.toContain('title="Message')
  })

  it("says it has no friends, and shows no search, for a list with nobody in it", () => {
    const html = roster({ friends: [] })
    expect(html).toContain("No friends yet")
    expect(html).not.toContain("Search friends")
  })

  it("shows a friend in the lobby of a game under that game, with no join or invite button when the page gives none", () => {
    const html = roster()
    expect(html).toContain("Courtisans")
    expect(html).toContain("In the lobby")
    expect(html).not.toMatch(/>Join<|>Invite</)
  })
})

// What a row does about groups: invite a friend who is connected and in none, ask to join the group of one who is in one. The button is drawn where the page can do it; the menu is behind its button, so what is checked is the button, and the menu's own.
describe("FriendsRoster, groups", () => {
  const button = (html: string, label: string) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0]
  // The attribute, not the classes of a button that is off while it is off (`disabled:opacity-50`)
  const isOff = (tag: string | undefined) => / disabled=""/.test(tag ?? "")

  it("has the button that invites a friend who is connected and in no group, named for the friend", () => {
    const html = roster({ onInvite: nothing })
    const invite = button(html, "Invite Bob to your group")
    expect(invite, "a button that invites Bob").toBeTruthy()
    expect(invite).toContain('title="Invite to your group"')
    expect(html).toContain(">Invite</button>")
    expect(isOff(invite)).toBe(false)
  })

  it("has none for a friend who is away: the invitation waits for them, and is sent from the picker of the group", () => {
    expect(roster({ onInvite: nothing })).not.toContain("Invite Cat")
  })

  it("has the button that asks to join the group of a friend who is in one", () => {
    const html = roster({ friends: [{ ...BOB, group: "other" }, CAT], onJoin: nothing, onInvite: nothing })
    const join = button(html, "Ask to join the group of Bob")
    expect(join, "a button that asks to join Bob's group").toBeTruthy()
    expect(join).toContain('title="Ask to join their group"')
    expect(html).toContain(">Join</button>")
    expect(html).not.toContain("Invite Bob")
  })

  it("has no button for a friend who is in the visitor's own group", () => {
    const html = roster({ friends: [{ ...BOB, group: "yours" }], onJoin: nothing, onInvite: nothing })
    expect(html).not.toMatch(/>Join<|>Invite</)
    expect(html).not.toContain("Ask to join")
  })

  it("has no button without the handler that does it: a page that cannot invite does not offer to", () => {
    expect(roster({ friends: [BOB, { ...CAT, group: "other" }], onJoin: nothing })).not.toContain(">Invite<")
    expect(roster({ friends: [{ ...BOB, group: "other" }], onInvite: nothing })).not.toContain(">Join<")
  })

  it("says that what was sent waits: the button is off, says Invited or Requested, and stays in view", () => {
    const invited = roster({ friends: [{ ...BOB, pending: "invited" }], onInvite: nothing })
    const waiting = button(invited, "Waiting for the answer of Bob")
    expect(isOff(waiting)).toBe(true)
    expect(waiting).not.toContain(" opacity-0")
    expect(invited).toContain(">Invited</button>")
    const requested = roster({ friends: [{ ...BOB, group: "other", pending: "requested" }], onJoin: nothing })
    expect(isOff(button(requested, "Waiting for the answer of Bob"))).toBe(true)
    expect(requested).toContain(">Requested</button>")
  })

  it("keeps the button of what can be sent for the pointer, the focus and a touch screen", () => {
    expect(button(roster({ onInvite: nothing }), "Invite Bob to your group")).toContain("group-hover/friend:opacity-100")
  })

  it("does not join a friend's table from a row: the table of a friend, or their playing, only makes them somebody to invite", () => {
    const table = { ...BOB, table: { code: "K7Q", size: 2, max: 4 } }
    const html = roster({ friends: [table, { ...BOB, id: "ann#1", nickname: "Ann", status: "playing" }], onJoin: nothing, onInvite: nothing })
    expect(html).not.toContain(">Join<")
    expect(html.match(/>Invite</g)).toHaveLength(2)
  })

  it("has the menu of a friend as soon as there is something to do about groups with them, and not for one with nothing", () => {
    const html = roster({ onInvite: nothing })
    expect(html).toContain('aria-label="More about Bob"')
    expect(html).not.toContain('aria-label="More about Cat"')
  })

  it("says in the line under the name which group a friend is in", () => {
    expect(roster({ friends: [{ ...BOB, group: "yours" }] })).toContain("In the lobby · In your group")
    expect(roster({ friends: [{ ...BOB, group: "other" }] })).toContain("In the lobby · In a group")
    expect(roster({ friends: [{ ...BOB, activity: undefined, group: "other" }] })).toContain(">In a group<")
    expect(roster()).not.toContain("In a group")
  })
})

describe("FriendsPanel", () => {
  it("gives the menu to its list", () => {
    const html = renderToStaticMarkup(React.createElement(FriendsPanel, { friends: [BOB], onRemove: nothing, onBlock: nothing }))
    expect(html).toContain('aria-label="More about Bob"')
  })
})

describe("SocialPanel", () => {
  const panel = (props: Partial<React.ComponentProps<typeof SocialPanel>> = {}) =>
    renderToStaticMarkup(React.createElement(SocialPanel, { friends: [BOB, CAT], conversations: [], requests: [REQUEST], ...props }))

  it("gives the menu to the roster of its first tab", () => {
    expect(panel({ onViewProfile: nothing, onRemove: nothing, onBlock: nothing })).toContain('aria-label="More about Bob"')
    expect(panel()).not.toContain("More about")
  })

  it("counts the requests to answer on the tab that adds a friend", () => {
    expect(panel()).toContain('aria-label="Add a friend, 1 requests"')
  })
})

describe("AddFriendForm", () => {
  const form = (props: Partial<React.ComponentProps<typeof AddFriendForm>> = {}) => renderToStaticMarkup(React.createElement(AddFriendForm, props))

  it("is off without what sending does", () => {
    expect(form().match(/disabled=""/g)).toHaveLength(3)
  })

  it("takes a username and a tag as soon as it has something to do with them, and its button waits for both", () => {
    const html = form({ onSend: nothing })
    expect(html).toContain('placeholder="Username"')
    expect(html).toContain('placeholder="Tag"')
    // The two fields are on, and the button, which waits for both, is the only thing that is off
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    expect(/<button[^>]*type="submit"[^>]*>/.exec(html)?.[0]).toContain('disabled=""')
  })

  it("tells the password managers to leave the username alone", () => {
    expect(form({ onSend: nothing })).toContain("data-1p-ignore")
  })
})

describe("RequestRow", () => {
  it("names the sender masked in a recording, with the answers when the page gives them", () => {
    const html = renderToStaticMarkup(React.createElement(SocialPanel, { friends: [], conversations: [], requests: [REQUEST], defaultTab: "add", onAnswerRequest: nothing }))
    expect(html).toContain('<span class="ph-mask block truncate text-sm text-foreground">Dan</span>')
    expect(html).toContain('aria-label="Accept Dan"')
    expect(html).toContain('aria-label="Decline Dan"')
  })

  it("has no answers without the handler", () => {
    const html = renderToStaticMarkup(React.createElement(SocialPanel, { friends: [], conversations: [], requests: [REQUEST], defaultTab: "add" }))
    expect(html).not.toContain('aria-label="Accept Dan"')
  })
})

// The group tab: a fourth tab for a page that has groups, between the friends and the conversations, and its pane
const ANN: GroupMember = { id: "ann#1", nickname: "Ann", tag: "0001", avatarUrl: null, status: "online", leader: false, you: true }
const MEMBER_BOB: GroupMember = { id: "bob#42", nickname: "Bob", tag: "0042", avatarUrl: null, status: "playing", game: { slug: "hanabi", name: "Hanabi" }, leader: true, you: false }
const MEMBER_CAT: GroupMember = { id: "cat#7", nickname: "Cat", tag: "0007", avatarUrl: null, status: "online", activity: "In the lobby", game: { slug: "courtisans", name: "Courtisans" }, leader: false, you: false }
const GROUP: Group = { members: [ANN, MEMBER_BOB, MEMBER_CAT], max: 8 }
const YOU_LEAD: Group = { members: [{ ...ANN, leader: true }, { ...MEMBER_BOB, leader: false }, MEMBER_CAT], max: 8 }

describe("GroupPane", () => {
  const pane = (props: Partial<React.ComponentProps<typeof GroupPane>> = {}) => renderToStaticMarkup(React.createElement(GroupPane, { group: GROUP, ...props }))

  it("says it is the visitor's group, with how many are in it out of how many it takes", () => {
    const html = pane()
    expect(html).toContain("Your group")
    expect(html).toContain("3 of 8")
  })

  it("lists every member with their picture and presence, and what they are doing", () => {
    const html = pane()
    expect(html.match(/data-slot="group-member"/g)).toHaveLength(3)
    expect(html).toContain('data-status="playing"')
    expect(html).toContain("Hanabi")
    expect(html).toContain("Courtisans · In the lobby")
    expect(html).toContain("Online")
  })

  it("names each member with their tag, masked in a recording, and says which one is the visitor", () => {
    const html = pane()
    expect(html).toContain('<p class="ph-mask truncate">Bob<span class="text-muted-foreground">#0042</span></p>')
    expect(html.match(/ph-mask/g)).toHaveLength(3)
    expect(html.match(/\(you\)/g)).toHaveLength(1)
    expect(/<li[^>]*>(?:(?!<\/li>)[\s\S])*Ann(?:(?!<\/li>)[\s\S])*\(you\)/.test(html)).toBe(true)
  })

  it("puts the leader first, with a crown that a screen reader names", () => {
    const html = pane()
    expect(html.indexOf("Bob")).toBeLessThan(html.indexOf("Ann"))
    expect(html.indexOf("Bob")).toBeLessThan(html.indexOf("Cat"))
    expect(html.match(/<span class="sr-only">Leader<\/span>/g)).toHaveLength(1)
    expect(html.match(/data-leader/g)).toHaveLength(1)
  })

  it("has no menu without a handler for it: a pane that decides nothing offers nothing", () => {
    expect(pane()).not.toContain("More about")
    expect(pane({ group: YOU_LEAD })).not.toContain("More about")
  })

  it("has the leader's menu on every member but the visitor, as soon as the page gives its handlers", () => {
    const html = pane({ group: YOU_LEAD, onKick: nothing, onMakeLeader: nothing })
    expect(html).toContain('aria-label="More about Bob"')
    expect(html).toContain('aria-label="More about Cat"')
    expect(html).not.toContain('aria-label="More about Ann"')
    expect(html.match(/aria-label="More about /g)).toHaveLength(2)
  })

  it("has no menu to hand the lead over or to remove for a member who does not lead, but still the profile of the others", () => {
    expect(pane({ onKick: nothing, onMakeLeader: nothing })).not.toContain("More about")
    const html = pane({ onKick: nothing, onMakeLeader: nothing, onViewProfile: nothing })
    expect(html).toContain('aria-label="More about Bob"')
    expect(html).toContain('aria-label="More about Cat"')
    expect(html).not.toContain('aria-label="More about Ann"')
  })

  it("has the menu on a member's row, in a button of its own, only under the pointer and the focus (always on a touch screen)", () => {
    const row = /<button[^>]*aria-label="More about Bob"[^>]*>/.exec(pane({ group: YOU_LEAD, onKick: nothing }))?.[0] ?? ""
    expect(row).toContain("group-hover/member:opacity-100")
    expect(row).toContain("[@media(hover:none)]:opacity-100")
  })

  it("has the buttons that invite a friend and that leave, each only where the page does it", () => {
    const html = pane({ onInvite: nothing, onLeave: nothing })
    expect(html).toContain("Invite a friend")
    expect(html).toContain("Leave group")
    expect(pane()).not.toContain("<button")
    expect(pane({ onInvite: nothing })).not.toContain("Leave group")
    expect(pane({ onLeave: nothing })).not.toContain("Invite a friend")
  })

  it("says the group is full in place of the button that invites, once it has all the members it takes", () => {
    const html = pane({ group: { members: GROUP.members, max: 3 }, onInvite: nothing, onLeave: nothing })
    expect(html).toContain("The group is full")
    expect(html).not.toContain("Invite a friend")
    expect(html).toContain("Leave group")
    expect(pane({ group: { members: GROUP.members, max: 3 } })).not.toContain("The group is full")
  })

  it("is an empty state with no group, that says what a group is and offers the one thing that makes one", () => {
    const html = pane({ group: null, onInvite: nothing, onLeave: nothing })
    expect(html).toContain("No group")
    expect(html).toContain("Invite a friend to play together. A group needs two players.")
    expect(html).toContain("Invite a friend")
    expect(html).not.toContain("Leave group")
    expect(html).not.toContain("Your group")
    expect(pane({ group: null })).not.toContain("<button")
  })
})

describe("SocialPanel, the group tab", () => {
  const panel = (props: Partial<React.ComponentProps<typeof SocialPanel>> = {}) =>
    renderToStaticMarkup(React.createElement(SocialPanel, { friends: [BOB, CAT], conversations: [], requests: [], ...props }))

  it("has three tabs for a page that has no groups", () => {
    const html = panel()
    expect(html).not.toContain('aria-label="Group"')
    expect(html.match(/role="tab"/g)).toHaveLength(3)
  })

  it("has a fourth tab, between the friends and the conversations, as soon as the page has groups, with or without one", () => {
    for (const group of [null, GROUP]) {
      const html = panel({ group })
      expect(html.match(/role="tab"/g)).toHaveLength(4)
      const at = (label: string) => html.indexOf(`aria-label="${label}"`)
      expect(at("Friends")).toBeLessThan(at("Group"))
      expect(at("Group")).toBeLessThan(at("Messages"))
      expect(at("Messages")).toBeLessThan(at("Add a friend"))
    }
  })

  it("shows the pane of the group on that tab, with what the page gives it", () => {
    const html = panel({ group: YOU_LEAD, defaultTab: "group", onInviteToGroup: nothing, onLeaveGroup: nothing, onKickMember: nothing, onMakeLeader: nothing, onViewMember: nothing })
    expect(html).toContain('data-slot="group-pane"')
    expect(html).toContain("Your group")
    expect(html).toContain("Invite a friend")
    expect(html).toContain("Leave group")
    expect(html).toContain('aria-label="More about Bob"')
    expect(html).not.toContain('data-slot="friends-roster"')
  })

  it("shows the empty state of the group tab for a visitor who is in none", () => {
    const html = panel({ group: null, defaultTab: "group", onInviteToGroup: nothing })
    expect(html).toContain("No group")
    expect(html).toContain("Invite a friend")
  })

  it("falls back on the friends when a page with no groups asks for the group tab", () => {
    const html = panel({ defaultTab: "group" })
    expect(html).toContain('data-slot="friends-roster"')
    expect(html).not.toContain('data-slot="group-pane"')
  })

  it("gives the roster of its first tab the buttons that invite and that ask to join", () => {
    const html = panel({ friends: [BOB, { ...CAT, status: "online", group: "other" }], group: null, onInvite: nothing, onJoin: nothing })
    expect(html).toContain("Invite Bob to your group")
    expect(html).toContain("Ask to join the group of Cat")
  })
})
