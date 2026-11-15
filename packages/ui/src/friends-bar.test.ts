import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Friend } from "./friends"
import type { Invitation } from "./social"
import { ChatWindow } from "./platform/chat-window"
import { Dialog } from "./platform/dialog"
import { FriendsBar } from "./platform/friends-bar"
import { InvitationsCard } from "./platform/invitations-card"
import { InviteFriendHeader, InviteFriendList } from "./platform/invite-friend"

// The connected friends in the dock's bar (their own avatars, before the games they are in) and the picker of the friend to invite, by their markup. What happens under the pointer is not here: the bar is read as the server draws it.

const friend = (nickname: string, status: Friend["status"], rest: Partial<Friend> = {}): Friend => ({ id: `${nickname.toLowerCase()}#1`, nickname, tag: "0001", status, ...rest })
const nothing = () => {}
const bar = (friends: Friend[], props: Partial<React.ComponentProps<typeof FriendsBar>> = {}) => renderToStaticMarkup(React.createElement(FriendsBar, { friends, ...props }))

describe("FriendsBar, connected friends", () => {
  it("draws each connected friend as a button with the dot of their presence, and none for a friend who is away", () => {
    const html = bar([friend("Ann", "online"), friend("Bob", "offline"), friend("Cat", "playing", { game: { slug: "hanabi", name: "Hanabi" } })])
    expect(html).toContain('aria-label="Ann: Online"')
    expect(html).toContain('aria-label="Cat: In a game"')
    expect(html).not.toContain("Bob")
    expect(html.match(/data-slot="friends-bar-friend"/g)).toHaveLength(2)
    expect(html).toContain('data-status="online"')
  })

  it("draws the friends before the games they are in", () => {
    const html = bar([friend("Cat", "playing", { game: { slug: "hanabi", name: "Hanabi" } })])
    expect(html.indexOf("friends-bar-friend")).toBeLessThan(html.indexOf("Hanabi: 1 friend"))
  })

  it("keeps three at the most and counts the others in a +N that is there when the page can open the panel", () => {
    const friends = ["A", "B", "C", "D", "E"].map((name) => friend(name, "online"))
    expect(bar(friends, { onMoreFriends: nothing }).match(/data-slot="friends-bar-friend"/g)).toHaveLength(3)
    expect(bar(friends, { onMoreFriends: nothing })).toContain('aria-label="2 more friends online"')
    expect(bar(friends, { onMoreFriends: nothing })).toContain(">+2<")
    expect(bar(friends)).not.toContain("friends-bar-more")
  })

  it("says one more friend in the singular", () => {
    const friends = ["A", "B", "C", "D"].map((name) => friend(name, "online"))
    expect(bar(friends, { onMoreFriends: nothing })).toContain('aria-label="1 more friend online"')
  })

  it("is the button that invites a friend when nobody is connected nor in a game, and has none without a link to copy", () => {
    expect(bar([friend("Bob", "offline")], { onShareLink: nothing })).toContain('aria-label="Invite a friend"')
    expect(bar([friend("Bob", "offline")])).toBe("")
    expect(bar([friend("Ann", "online")], { onShareLink: nothing })).not.toContain('aria-label="Invite a friend"')
  })

  it("masks nothing it does not draw: a friend's name is only in the label of their button", () => {
    expect(bar([friend("Ann", "online")])).not.toContain("ph-mask")
  })
})

describe("InviteFriendList", () => {
  const list = (friends: Friend[]) => renderToStaticMarkup(React.createElement(InviteFriendList, { friends, onInvite: nothing }))
  const friends = [friend("Zed", "offline"), friend("Ann", "playing", { game: { slug: "hanabi", name: "Hanabi" } }), friend("Bob", "online", { activity: "In the lobby", game: { slug: "courtisans", name: "Courtisans" } })]

  it("lists the connected friends first, under Online, with what they are doing, and the others under Offline", () => {
    const html = list(friends)
    expect(html.indexOf('aria-label="Online"')).toBeLessThan(html.indexOf('aria-label="Offline"'))
    expect(html.indexOf("Invite Bob")).toBeLessThan(html.indexOf("Invite Ann"))
    expect(html.indexOf("Invite Ann")).toBeLessThan(html.indexOf("Invite Zed"))
    expect(html).toContain("Courtisans · In the lobby")
    expect(html).toContain("Hanabi")
  })

  it("masks the names in a recording and has a search field", () => {
    const html = list(friends)
    expect(html).toContain('aria-label="Search your friends"')
    expect(html.match(/ph-mask/g)).toHaveLength(3)
  })

  it("says it when the visitor has no friend", () => {
    expect(list([])).toContain("You have no friends yet")
  })

  it("shows the friends who were invited already as sent, and cannot press them", () => {
    const html = renderToStaticMarkup(React.createElement(InviteFriendList, { friends, onInvite: nothing, invited: new Set(["bob#1"]) }))
    expect(html).toContain('aria-label="Bob is invited"')
    expect(html).toContain("Invited")
    expect(/<button[^>]*aria-label="Bob is invited"/.exec(html)?.[0]).toContain("disabled")
  })
})

describe("InviteFriendHeader", () => {
  // The window is portaled and draws nothing on the server, so its head is read inside the context of a dialog, which is what names its title
  const header = (props: Partial<React.ComponentProps<typeof InviteFriendHeader>> = {}) =>
    renderToStaticMarkup(React.createElement(Dialog, { open: true }, React.createElement(InviteFriendHeader, props)))

  it("is called Invite a friend, and says what one press does, unless the page says more", () => {
    const html = header()
    expect(html).toContain(">Invite a friend</h2>")
    expect(html).toContain("Friends who are online come first. One press sends the invitation.")
  })

  it("takes the title of what it is for: a group, for instance", () => {
    const html = header({ title: "Invite a friend to your group", description: "One press sends the invitation to your group." })
    expect(html).toContain(">Invite a friend to your group</h2>")
    expect(html).toContain("One press sends the invitation to your group.")
    expect(html).not.toContain("Friends who are online come first")
  })
})

describe("InvitationsCard", () => {
  const invitation: Invitation = { id: "i1", kind: "table", nickname: "Bob", tag: "0042", avatarUrl: null, game: { slug: "hanabi", name: "Hanabi" }, expiresAt: "2026-11-13T10:30:00.000Z" }
  const NOW = Date.parse("2026-11-13T10:00:00.000Z")
  const card = (props: Partial<React.ComponentProps<typeof InvitationsCard>> = {}) => renderToStaticMarkup(React.createElement(InvitationsCard, { invitations: [invitation], now: NOW, ...props }))

  it("is nothing without an invitation", () => {
    expect(card({ invitations: [] })).toBe("")
  })

  it("says who invites, to which game and how long is left, with the name masked in a recording", () => {
    const html = card()
    expect(html).toContain('<span class="ph-mask">Bob</span> invites you')
    expect(html).toContain("Hanabi")
    expect(html).toContain("30 min left")
  })

  it("has the two buttons only when the page gives a way to answer", () => {
    expect(card()).not.toContain("<button")
    const html = card({ onAnswer: nothing })
    expect(html).toContain('aria-label="Accept the invitation of Bob to Hanabi"')
    expect(html).toContain('aria-label="Decline the invitation of Bob"')
  })

  it("can only decline an invitation that has expired", () => {
    const html = card({ onAnswer: nothing, now: Date.parse("2026-11-13T11:00:00.000Z") })
    expect(html).toContain("expired")
    expect(html).not.toContain("Accept the invitation")
    expect(html).toContain("Decline the invitation of Bob")
  })

  it("is called Invitations, whatever they are for, and says which kind each row is", () => {
    const html = card({ invitations: [invitation, { ...invitation, id: "i2", kind: "group" }, { ...invitation, id: "i3", kind: "join" }] })
    expect(html).toContain('aria-label="Invitations"')
    expect(html.match(/data-slot="invitation"/g)).toHaveLength(3)
    expect(html).toContain('data-kind="table"')
    expect(html).toContain('data-kind="group"')
    expect(html).toContain('data-kind="join"')
  })

  it("says who invites the visitor to join their group, with the icon of a group in place of a game", () => {
    const html = card({ invitations: [{ id: "g1", kind: "group", nickname: "Bob", tag: "0042", avatarUrl: null, expiresAt: "2026-11-13T10:30:00.000Z" }], onAnswer: nothing })
    expect(html).toContain('<span class="ph-mask">Bob</span> invites you')
    expect(html).toContain("To join their group")
    expect(html).toContain("30 min left")
    expect(html).not.toContain("Hanabi")
    expect(html).toContain('aria-label="Accept the invitation of Bob to join their group"')
    expect(html).toContain('title="Accept and join the group"')
    expect(html).toContain('aria-label="Decline the invitation of Bob to join their group"')
  })

  it("says who asks to join the visitor's group, and lets them in with the same button as the others accept", () => {
    const html = card({ invitations: [{ id: "j1", kind: "join", nickname: "Bob", tag: "0042", avatarUrl: null, expiresAt: "2026-11-13T10:30:00.000Z" }], onAnswer: nothing })
    expect(html).toContain('<span class="ph-mask">Bob</span> asks to join')
    expect(html).toContain("Your group")
    expect(html).toContain('aria-label="Let Bob join your group"')
    expect(html).toContain('title="Let them join"')
    expect(html).toContain('aria-label="Decline the request of Bob to join your group"')
  })

  it("has no button for a group or a request when the page gives no way to answer, and can only decline one that expired", () => {
    const group: Invitation = { id: "g1", kind: "group", nickname: "Bob", tag: "0042", avatarUrl: null, expiresAt: "2026-11-13T10:30:00.000Z" }
    const late = Date.parse("2026-11-13T11:00:00.000Z")
    expect(card({ invitations: [group] })).not.toContain("<button")
    const html = card({ invitations: [group, { ...group, id: "j1", kind: "join" }], onAnswer: nothing, now: late })
    expect(html).not.toContain("Accept")
    expect(html).not.toContain("Let Bob join")
    expect(html).toContain("Decline the invitation of Bob to join their group")
    expect(html).toContain("Decline the request of Bob to join your group")
  })
})

describe("ChatWindow", () => {
  const messages = [
    { id: "1", from: "me" as const, text: "<b>hi</b>\nthere", at: "2026-11-13T10:00:00.000Z" },
    { id: "2", from: "them" as const, text: "hello", at: "2026-11-13T10:01:00.000Z" },
  ]
  const chat = (props: Partial<React.ComponentProps<typeof ChatWindow>> = {}) => renderToStaticMarkup(React.createElement(ChatWindow, { friend: friend("Bob", "online"), messages, onSend: nothing, onClose: nothing, ...props }))

  it("draws a message as text, never as markup, masked in a recording, keeping its line breaks", () => {
    const html = chat()
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;\nthere")
    expect(html).not.toContain("<b>hi</b>")
    expect(html.match(/ph-mask max-w-11\/12/g)).toHaveLength(2)
    expect(html).toContain("whitespace-pre-wrap")
  })

  it("limits the field to what the page says and masks what is typed in it", () => {
    const html = chat({ maxLength: 1000 })
    expect(html).toContain('maxLength="1000"')
    expect(/<input[^>]*class="[^"]*ph-mask/.test(html)).toBe(true)
  })

  // The menu is behind its button: what is checked is that there is one, which takes something to put in it
  it("has no menu when the page gives it nothing to put in it", () => {
    expect(chat()).not.toContain("More about")
  })

  it("has the menu as soon as there is something to do about groups with the friend: invite them when they are connected and in none, ask to join when they are in one", () => {
    expect(chat({ onInvite: nothing })).toContain('aria-label="More about Bob"')
    expect(chat({ friend: friend("Bob", "online", { group: "other" }), onJoin: nothing })).toContain('aria-label="More about Bob"')
  })

  it("has no group entry to offer for a friend who is away, nor for one in the visitor's group, nor for a handler the page does not give", () => {
    expect(chat({ friend: friend("Bob", "offline"), onInvite: nothing, onJoin: nothing })).not.toContain("More about")
    expect(chat({ friend: friend("Bob", "online", { group: "yours" }), onInvite: nothing, onJoin: nothing })).not.toContain("More about")
    expect(chat({ friend: friend("Bob", "online", { group: "other" }), onInvite: nothing })).not.toContain("More about")
    expect(chat({ onJoin: nothing })).not.toContain("More about")
  })

  it("keeps the menu for removing and blocking whatever the friend is doing", () => {
    expect(chat({ friend: friend("Bob", "offline"), onRemove: nothing })).toContain('aria-label="More about Bob"')
    expect(chat({ friend: friend("Bob", "online", { group: "yours" }), onBlock: nothing })).toContain('aria-label="More about Bob"')
  })
})
