import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FriendRequestReceivedToast, FriendRequestSentToast, GameInvitationToast, type ToastPerson } from "./platform/person-toast"

// The toasts about a person by their markup: a group named by who it is about and what it says, never a status; which buttons each has, and what they are called; what is masked in a recording; and the cross, which only a toast that stays has.

const ALEX: ToastPerson = { nickname: "Alex", tag: "0042", avatarUrl: null }
const nothing = () => {}

const sent = (props: Partial<React.ComponentProps<typeof FriendRequestSentToast>> = {}) => renderToStaticMarkup(React.createElement(FriendRequestSentToast, { person: ALEX, onCancel: nothing, ...props }))
const received = (props: Partial<React.ComponentProps<typeof FriendRequestReceivedToast>> = {}) =>
  renderToStaticMarkup(React.createElement(FriendRequestReceivedToast, { person: ALEX, onAccept: nothing, onDecline: nothing, ...props }))
const invitation = (props: Partial<React.ComponentProps<typeof GameInvitationToast>> = {}) =>
  renderToStaticMarkup(React.createElement(GameInvitationToast, { person: ALEX, game: { name: "Hanabi" }, onAccept: nothing, onDecline: nothing, ...props }))

const BUTTON = /<button\b[^>]*>/g
const buttons = (html: string) => html.match(BUTTON) ?? []

describe("every toast about a person", () => {
  it.each([
    ["a request that was sent", sent()],
    ["a request that came in", received()],
    ["an invitation", invitation()],
  ])("is a group named by the person and what it says, for %s", (_name, html) => {
    expect(html).toContain('role="group"')
    const [, person, message] = /aria-labelledby="([^ "]+-person) ([^ "]+-message)"/.exec(html) ?? []
    expect(person, "the person names the group").toBeTruthy()
    expect(html).toContain(`id="${person}"`)
    expect(html).toContain(`id="${message}"`)
  })

  it.each([
    ["a request that was sent", sent()],
    ["a request that came in", received()],
    ["an invitation", invitation()],
  ])("is not a status that a screen reader reads out and leaves, for %s", (_name, html) => {
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it("names the person with their tag, masked in a recording", () => {
    const html = received()
    expect(html).toContain('<p id="')
    expect(html).toMatch(/class="ph-mask truncate text-base text-foreground">Alex<span class="text-muted-foreground">#0042<\/span><\/p>/)
  })

  it("is a floating surface of the platform, at the roundest step, and what is in it takes its corner less its padding", () => {
    const html = received()
    expect(html).toContain("platform")
    expect(html).toContain("glass")
    expect(html).toContain("nest-4xl/4")
    expect(html).not.toMatch(/class="[^"]*\brounded-4xl\b/)
    // Its buttons are in the padding: one corner for all of them, read from the toast
    expect((html.match(/<button\b[^>]*rounded-nested/g) ?? []).length).toBe(2)
  })

  it("stands in for a picture that is not there with the initials of the person", () => {
    expect(received()).toContain(">A</span>")
  })
})

describe("a friend request that was sent", () => {
  it("says so, and has the one button that takes it back", () => {
    const html = sent()
    expect(html).toContain("Friend request sent")
    expect(buttons(html)).toHaveLength(1)
    expect(html).toContain('aria-label="Cancel the request to Alex"')
    expect(html).toContain(">Cancel</button>")
  })

  it("has no button where the page gives no way to take the request back", () => {
    expect(buttons(sent({ onCancel: undefined }))).toHaveLength(0)
  })

  it("has no cross: it goes by itself", () => {
    expect(sent()).not.toContain('aria-label="Dismiss"')
  })
})

describe("a friend request that came in", () => {
  it("has two buttons, the one that accepts and the one that declines, each with its word and its icon", () => {
    const html = received()
    expect(html).toContain("Wants to be your friend")
    expect(buttons(html)).toHaveLength(2)
    expect(html).toContain('aria-label="Accept Alex"')
    expect(html).toContain('aria-label="Decline Alex"')
    expect(html).toContain("Accept</button>")
    expect(html).toContain("Decline</button>")
    expect(html.match(/<svg/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("has no cross: it goes by itself", () => {
    expect(received()).not.toContain('aria-label="Dismiss"')
  })
})

describe("an invitation to a game", () => {
  it("says who invites and to what, and has the two answers", () => {
    const html = invitation()
    expect(html).toContain("Invited you to play")
    expect(html).toContain("Hanabi")
    expect(html).toContain('aria-label="Accept the invitation of Alex to Hanabi"')
    expect(html).toContain('aria-label="Decline the invitation of Alex to Hanabi"')
  })

  it("has the cross, at the top right corner, once the page says what it does", () => {
    const cross = /<button\b[^>]*aria-label="Dismiss"[^>]*>/.exec(invitation({ onDismiss: nothing }))?.[0]
    expect(cross, "a button called Dismiss").toBeTruthy()
    expect(cross).toContain("absolute top-3 right-3")
  })

  it("has no cross without a way to dismiss it: the page decides, the toast never traps", () => {
    expect(invitation()).not.toContain('aria-label="Dismiss"')
  })

  it("shows the icon of the game when the page has it, and only then", () => {
    expect(invitation({ game: { name: "Hanabi", iconUrl: "https://example.test/hanabi.png" } })).toContain('<img src="https://example.test/hanabi.png"')
    expect(invitation()).not.toContain("<img")
  })

  it("keeps the text clear of the cross", () => {
    expect(invitation({ onDismiss: nothing })).toContain("pr-8")
    expect(invitation()).not.toContain("pr-8")
  })
})
