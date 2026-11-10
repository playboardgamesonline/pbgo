import type { Doc, FiguresStore, Mutation } from "./figures.ts"
import type { BggThing } from "./xml.ts"

// What the tests of the figures from BoardGameGeek share: an item as BGG answers it, a game of the Studio, and a dataset in memory that applies what is written to it.

export const thing = (id: number, over: Partial<BggThing> = {}): BggThing => ({
  id,
  type: "boardgame",
  name: "Azul",
  names: ["Azul"],
  year: 2017,
  minPlayers: 2,
  maxPlayers: 4,
  playingTime: 45,
  minAge: 8,
  weight: 1.7692,
  weights: 500,
  rating: 7.7,
  ratings: 1000,
  rank: 99,
  ...over,
})

/** A game of the Studio, published (`game-azul`) or a draft (`drafts.game-azul`). */
export const game = (slug: string, fields: Record<string, unknown> = {}, { draft = false }: { draft?: boolean } = {}): Doc => ({
  _id: `${draft ? "drafts." : ""}game-${slug}`,
  _type: "game",
  _rev: `rev-${slug}${draft ? "-draft" : ""}`,
  _createdAt: "2026-10-01T00:00:00Z",
  _updatedAt: "2026-11-01T00:00:00Z",
  name: slug === "azul" ? "Azul" : slug.replace(/-/g, " "),
  slug: { _type: "slug", current: slug },
  ...fields,
})

export const things = (...list: BggThing[]) => new Map(list.map((one) => [one.id, one]))

/** A dataset in memory: it applies createIfNotExists and patches the way the real one does, in one go. */
export function memoryStore(initial: Doc[], { lose = false }: { lose?: boolean } = {}): FiguresStore & { docs: Map<string, Doc>; commits: Mutation[][] } {
  const docs = new Map(initial.map((doc) => [doc._id, structuredClone(doc)]))
  const commits: Mutation[][] = []
  return {
    docs,
    commits,
    async documents() {
      return [...docs.values()].map((doc) => structuredClone(doc))
    },
    async commit(mutations) {
      commits.push(mutations)
      if (lose) return
      for (const mutation of mutations) {
        if ("createIfNotExists" in mutation) {
          if (!docs.has(mutation.createIfNotExists._id)) docs.set(mutation.createIfNotExists._id, structuredClone(mutation.createIfNotExists))
        } else {
          const target = docs.get(mutation.patch.id)
          if (!target) throw new Error(`No document ${mutation.patch.id}`)
          Object.assign(target, mutation.patch.set)
        }
      }
    },
  }
}

