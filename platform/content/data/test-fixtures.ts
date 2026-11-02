import type { NotionExpansion, NotionGame } from "../notion/types.ts"
import type { PublisherRow } from "../notion/reader.ts"
import type { Doc } from "@pbgo/content-kit/testing"
import { buildSeedContent } from "./index.ts"
import type { SeedSource } from "./index.ts"

/** A game of Notion with nothing filled but its slug and name (the shape `readNotionGames` gives, which the catalog's own tests keep as a fixture too). */
export const notionGame = (slug: string, overrides: Partial<NotionGame> = {}): NotionGame => ({
  slug,
  name: slug,
  descriptions: {},
  players: null,
  duration: null,
  complexity: null,
  bggId: null,
  releaseDate: null,
  age: null,
  categories: [],
  authors: [],
  illustrators: [],
  publishers: [],
  rules: {},
  art: { logo: false, icon: false, background: false },
  development: { priority: null, status: null, effort: null },
  standaloneOf: null,
  related: [],
  editedAt: "",
  notionPageId: `page-${slug}`,
  ...overrides,
})

/** An expansion of Notion with nothing filled but its slug, its name and the slug of its base game. */
export const notionExpansion = (slug: string, base: string, overrides: Partial<NotionExpansion> = {}): NotionExpansion => ({
  slug,
  name: slug,
  base,
  descriptions: {},
  players: null,
  duration: null,
  bggId: null,
  releaseDate: null,
  age: null,
  authors: [],
  illustrators: [],
  publishers: [],
  rules: {},
  ...overrides,
})

export const publisherRow = (name: string, overrides: Partial<PublisherRow> = {}): PublisherRow => ({ id: `row-${name}`, name, url: null, logo: null, ...overrides })

/**
 * A small catalog that has every case the seed meets: a person who is a designer and an artist of one game, an accent in a name,
 * a publisher listed by two games (with a website given by one only), a game that is "or more" players, a standalone expansion,
 * a game related to another by one row only, a game with nothing filled, a publisher with a logo and one that no game lists, an
 * expansion with everything filled that brings a person and a publisher (with a logo) of its own, and one with nothing filled.
 */
export const source = (): SeedSource => ({
  games: [
    notionGame("hanabi", {
      name: "Hanabi",
      players: { min: 2, max: 5 },
      duration: 25,
      complexity: 1.74,
      bggId: 98778,
      releaseDate: "2010-01-01",
      age: 8,
      categories: ["Cooperation", "Deduction"],
      authors: ["Antoine Bauza"],
      illustrators: ["Antoine Bauza", "Laura Michaud"],
      publishers: [{ name: "Cocktail Games", url: null }],
      descriptions: { en: "A cooperative card game in which nobody sees their own cards.", fr: "Un jeu de cartes coopératif." },
      rules: { fr: "https://example.com/hanabi-fr.pdf", en: "https://example.com/hanabi-en.pdf" },
      art: { logo: true, icon: false, background: true },
      related: ["the-mind"],
    }),
    notionGame("the-mind", {
      name: "The Mind",
      players: { min: 2, max: 4 },
      categories: ["Cooperation"],
      authors: ["Wolfgang Warsch"],
      publishers: [
        { name: "Cocktail Games", url: "https://www.cocktailgames.com" },
        { name: "Pandasaurus", url: "https://pandasaurus.example.com" },
      ],
      art: { logo: true, icon: true, background: false },
    }),
    notionGame("flip-7", { name: "Flip 7", players: { min: 3, max: null }, categories: ["Push your luck"], authors: ["Eric Olsen"], illustrators: ["Émilie Ménard"] }),
    notionGame("flip-7-vengeance", { name: "Flip 7 Vengeance", standaloneOf: "flip-7", related: ["flip-7"], authors: ["Eric Olsen"] }),
    notionGame("bare", { name: "Bare" }),
  ],
  expansions: [
    notionExpansion("hanabi-extra", "hanabi", {
      name: "Hanabi: Extra",
      players: { min: 2, max: 6 },
      duration: 30,
      bggId: 140934,
      releaseDate: "2012-06-01",
      age: 8,
      authors: ["Antoine Bauza", "Ada Marsh"],
      illustrators: ["Ada Marsh"],
      publishers: [
        { name: "Cocktail Games", url: null },
        { name: "Fireworks Press", url: "https://fireworks.example.com" },
      ],
      descriptions: { en: "Rainbow fireworks join the deck.", fr: "Des feux d'artifice arc-en-ciel." },
      rules: { en: "https://example.com/hanabi-extra-en.pdf" },
    }),
    notionExpansion("the-mind-extreme", "the-mind", { name: "The Mind: Extreme" }),
  ],
  publishers: [
    publisherRow("Cocktail Games", { url: "https://www.cocktailgames.com", logo: "https://files.example.com/cocktail.png" }),
    publisherRow("Pandasaurus", { url: "https://pandasaurus.example.com" }),
    publisherRow("Nobody's Games", { logo: "https://files.example.com/nobody.png" }),
    publisherRow("Fireworks Press", { url: "https://fireworks.example.com", logo: "https://files.example.com/fireworks.png" }),
  ],
})

/** A fresh build of every seed document, read loosely by the tests. */
export const seedDocs = (): Doc[] => buildSeedContent(source()).docs as Doc[]
