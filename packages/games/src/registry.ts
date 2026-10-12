import type { GameEntry } from "@pbgo/core/lib/binding"

/**
 * Every game served by apps/web, at playboardgamesonline.app/<slug>. Pure data: the hub, the sitemap and the router
 * read it without loading any game. The game's code is loaded on demand: `LOADERS` (server, `./index.ts`) and
 * `RUNTIMES` (client, `./runtime.tsx`), keyed by the same slugs.
 *
 * `live`: playable in production (else its home page says "coming soon"; every game stays playable outside production).
 * `indexable`: listed in the sitemap and without `noindex`. Set both when the game goes live.
 */
export const GAMES = [
  {
    slug: "courtisans",
    name: "Courtisans",
    tagline: "The Queen's banquet, online with friends.",
    players: { min: 2, max: 5 },
    sanityProjectId: "2lo2f5sv",
    live: true,
    indexable: true,
  },
  {
    slug: "template",
    name: "La Plus Haute",
    tagline: "Demo game of the shared base: highest card wins the trick.",
    players: { min: 2, max: 6 },
    sanityProjectId: "3t296gee",
    live: false,
    indexable: false,
  },
  {
    slug: "6-nimmt",
    name: "6 qui prend !",
    tagline: "The bullheads card game, online.",
    players: { min: 2, max: 10 },
    sanityProjectId: "t5dwtve1",
    live: false,
    indexable: false,
  },
  {
    slug: "7-wonders",
    name: "7 Wonders",
    tagline: "Build a wonder of the ancient world, online.",
    players: { min: 3, max: 7 },
    sanityProjectId: "xpof03pw",
    live: false,
    indexable: false,
  },
  {
    slug: "cry-baby",
    name: "Cry Baby",
    tagline: "The card game, online.",
    sanityProjectId: "o2gqqcvf",
    live: false,
    indexable: false,
  },
  {
    slug: "dracula-vs-van-helsing",
    name: "Dracula vs Van Helsing",
    tagline: "The card duel between the vampire and the hunter, online.",
    players: { min: 2, max: 2 },
    sanityProjectId: "8kl9j1dh",
    live: false,
    indexable: false,
  },
  {
    slug: "exploding-kittens",
    name: "Exploding Kittens",
    tagline: "The kitty-powered card game, online.",
    players: { min: 2, max: 5 },
    sanityProjectId: "gsfz20b9",
    live: false,
    indexable: false,
  },
  {
    slug: "flip-7",
    name: "Flip 7",
    tagline: "The press-your-luck card game, online.",
    players: { min: 3, max: 18 },
    sanityProjectId: "fj3grahy",
    live: false,
    indexable: false,
  },
  {
    slug: "hanabi",
    name: "Hanabi",
    tagline: "The cooperative fireworks card game by Antoine Bauza.",
    players: { min: 2, max: 5 },
    sanityProjectId: "srffdhjt",
    live: false,
    indexable: false,
  },
  {
    slug: "love-letter",
    name: "Love Letter",
    tagline: "The princess deduction card game, online.",
    players: { min: 2, max: 6 },
    sanityProjectId: "fdbxac71",
    live: false,
    indexable: false,
  },
  {
    slug: "odin",
    name: "Odin",
    tagline: "The Viking card game, online.",
    players: { min: 2, max: 6 },
    sanityProjectId: "2w4tgwae",
    live: false,
    indexable: false,
  },
  {
    slug: "omens",
    name: "Présages",
    tagline: "The card game of omens, online.",
    sanityProjectId: "32lh42h9",
    live: false,
    indexable: false,
  },
  {
    slug: "skull-king",
    name: "Skull King",
    tagline: "The pirate trick-taking game, online.",
    players: { min: 2, max: 8 },
    sanityProjectId: "e9247r0u",
    live: false,
    indexable: false,
  },
  {
    slug: "sky-team",
    name: "Sky Team",
    tagline: "The cooperative two-player landing game, online.",
    players: { min: 2, max: 2 },
    sanityProjectId: "3hw190ly",
    live: false,
    indexable: false,
  },
  {
    slug: "skyjo",
    name: "Skyjo",
    tagline: "The family card game, online.",
    players: { min: 2, max: 8 },
    sanityProjectId: "p5sgvh5w",
    live: false,
    indexable: false,
  },
  {
    slug: "timebomb",
    name: "Timebomb",
    tagline: "The bluffing and hidden-roles game, online.",
    players: { min: 4, max: 8 },
    sanityProjectId: "dxlv9oe9",
    live: false,
    indexable: false,
  },
  {
    slug: "trio",
    name: "Trio",
    tagline: "The memory and deduction game, online.",
    players: { min: 3, max: 6 },
    sanityProjectId: "erf97a0b",
    live: false,
    indexable: false,
  },
  {
    slug: "welcome-to",
    name: "Welcome To",
    tagline: "The dream-neighbourhood flip & write, online.",
    players: { min: 1, max: 100 },
    sanityProjectId: "ljyif8yt",
    live: false,
    indexable: false,
  },
] as const satisfies readonly GameEntry[]

export type GameSlug = (typeof GAMES)[number]["slug"]

/** Registry entry of a slug, null when no game has it. */
export const findGame = (slug: string): GameEntry | null => GAMES.find((g) => g.slug === slug) ?? null

/** Games shown on the hub: the live ones. */
export const listedGames = (): readonly GameEntry[] => GAMES.filter((g) => g.live)
