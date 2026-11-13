import { describe, expect, it } from "vitest"
import { INVITATION_TOASTS_MAX, NO_INVITATION_WATCH, invitationToastId, watchInvitations } from "./invitation-toasts"
import type { InvitationEntry } from "./invitations"

const entry = (n: number, minute = n): InvitationEntry => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  from: { nickname: `Friend${n}`, tag: n, avatarUrl: null },
  game: { slug: "hanabi", name: "Hanabi" },
  at: new Date(Date.UTC(2026, 10, 13, 10, minute)).toISOString(),
  expiresAt: new Date(Date.UTC(2026, 10, 13, 10, minute + 30)).toISOString(),
})

describe("watchInvitations", () => {
  it("tells nothing at the first read of a tab: what waits is the card's", () => {
    const news = watchInvitations(NO_INVITATION_WATCH, [entry(1), entry(2)])
    expect(news).toMatchObject({ tell: [], more: 0, gone: [] })
    expect(news.watch.seen).toEqual(new Set([entry(1).id, entry(2).id]))
  })

  it("tells an invitation that came in since the last read, once", () => {
    const first = watchInvitations(NO_INVITATION_WATCH, [entry(1)])
    const second = watchInvitations(first.watch, [entry(1), entry(2)])
    expect(second.tell.map((one) => one.id)).toEqual([entry(2).id])
    const third = watchInvitations(second.watch, [entry(1), entry(2)])
    expect(third.tell).toEqual([])
  })

  it("never tells an invitation twice, even one that goes and comes back", () => {
    const first = watchInvitations(NO_INVITATION_WATCH, [])
    const told = watchInvitations(first.watch, [entry(1)])
    const away = watchInvitations(told.watch, [])
    expect(away.gone).toEqual([entry(1).id])
    expect(watchInvitations(away.watch, [entry(1)]).tell).toEqual([])
  })

  it("says which toasts are out of date: the invitations that were waiting and are not", () => {
    const first = watchInvitations(NO_INVITATION_WATCH, [entry(1), entry(2)])
    expect(watchInvitations(first.watch, [entry(2)]).gone).toEqual([entry(1).id])
  })

  it("tells a burst by its newest and counts the others", () => {
    const first = watchInvitations(NO_INVITATION_WATCH, [])
    const burst = [entry(1, 1), entry(2, 2), entry(3, 3), entry(4, 4), entry(5, 5)]
    const news = watchInvitations(first.watch, burst)
    expect(news.tell.map((one) => one.id)).toEqual([entry(4).id, entry(5).id])
    expect(news.tell).toHaveLength(INVITATION_TOASTS_MAX - 1)
    expect(news.more).toBe(3)
  })

  it("names the toast of an invitation by its id alone", () => {
    expect(invitationToastId(entry(1).id)).toBe(`table-invitation:${entry(1).id}`)
  })
})
