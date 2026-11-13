import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Friend } from "./friends"
import { FriendsBar } from "./platform/friends-bar"
import { InvitationsCard } from "./platform/invitations-card"
import { InviteFriendList } from "./platform/invite-friend"

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

describe("InvitationsCard", () => {
  const invitation = { id: "i1", nickname: "Bob", tag: "0042", avatarUrl: null, game: { slug: "hanabi", name: "Hanabi" }, expiresAt: "2026-11-13T10:30:00.000Z" }
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
})
