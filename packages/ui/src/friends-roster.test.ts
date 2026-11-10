import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Friend } from "./friends"
import type { FriendRequest } from "./social"
import { AddFriendForm } from "./platform/add-friend-form"
import { FriendsPanel, FriendsRoster } from "./platform/friends-panel"
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
