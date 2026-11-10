import type { CatalogEntry } from "@pbgo/catalog"
import type { Editorial } from "@pbgo/catalog/editorial"

// The made-up announcement and changelog entries of the demo account of development (`@pbgo/accounts/demo`), so that the signed-in home can be seen whole on a machine where the platform's Sanity project holds none yet. Their pictures
// are those the games already have in that project (the background, else the cover of a game of the catalog): nothing is drawn or invented here. The demo account does not exist in a deployment, so none of this ever reaches a visitor.

const DAY_MS = 24 * 60 * 60 * 1000

export function demoEditorial(entries: readonly CatalogEntry[], now = new Date()): Editorial {
  const day = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10)
  const withPicture = entries.flatMap((entry) => {
    const image = entry.game.pictures.background ?? entry.game.pictures.cover
    return image ? [{ slug: entry.slug, name: entry.game.name, image }] : []
  })
  const [first, second, third] = withPicture
  return {
    announcements: [
      { id: "demo-announcement", title: "A short break tonight", message: "The tables stay open; the chat may be slow for a few minutes.", tone: "info", link: null, game: null, dismissible: true, startsAt: null, endsAt: null },
    ],
    entries: [
      ...(first ? [{ id: "demo-1", title: `${first.name} is on the platform`, date: day(2), kind: "newGame" as const, text: "Open a table and play it with your friends.", image: first.image, games: [first.slug] }] : []),
      ...(second ? [{ id: "demo-2", title: `${second.name} gets its own page`, date: day(5), kind: "feature" as const, text: "Its rules, its credits and the tables waiting for players.", image: second.image, games: [second.slug] }] : []),
      { id: "demo-3", title: "Tables you can share", date: day(9), kind: "improvement" as const, text: "A table has a link: send it, and your friends sit down in one click.", image: third?.image ?? null, games: [] },
    ],
  }
}
