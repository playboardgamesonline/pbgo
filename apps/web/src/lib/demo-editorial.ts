import type { Editorial } from "@pbgo/catalog/editorial"

// The made-up announcement of the demo account of development (`@pbgo/accounts/demo`), so that the signed-in home can be seen whole on a machine where the platform's Sanity project holds none yet. The demo account does not exist in a deployment, so none of this ever reaches a visitor.

export function demoEditorial(): Editorial {
  return {
    announcements: [
      { id: "demo-announcement", title: "A short break tonight", message: "The tables stay open; the chat may be slow for a few minutes.", tone: "info", link: { url: "/about#whats-new", label: "Read more" }, game: null, dismissible: false, startsAt: null, endsAt: null },
    ],
    entries: [],
  }
}
