import type { ComponentType } from "react"
import type { AnyGameDefinition, OptionValues, Results } from "@pbgo/engine-kit"
import type { SanityClient } from "@sanity/client"
import type { PublicGame } from "./game-types"
import type { Locale } from "./i18n"
import type { Credits, SiteSettings, ThemeColors } from "./settings"
import type { GameSkinDefaults } from "./skin"
import type { SoundConfig } from "./sound-config"
import type { Reaction } from "./soundboard"

/**
 * Contract between `@pbgo/core` and a game. One app serves every game, so core never imports a game:
 * the server receives the game module (`GameModule`, from the `@pbgo/games` registry) as an argument,
 * the client reads it from `BindingProvider` (`lib/binding-context.tsx`).
 *
 * A game is the package `@pbgo-game/<slug>`:
 * - `.` : `GameBinding` (constants, engine), isomorphic
 * - `./ui` : `UiBinding` (logo, board), client
 * - `./server` : `ServerBinding` (loaders, extra API routes), server only
 * - `./runtime` : client component that loads the game's styles and provides the binding
 */

/** Registry entry (`@pbgo/games`): what the hub and the router know about a game without loading it. */
export type GameEntry = {
  slug: string
  /** Name shown by the hub */
  name: string
  /** One English line for the hub */
  tagline: string
  /** Shown by the hub; absent while the game's rules are not written yet */
  players?: { min: number; max: number }
  /** Length of a game in minutes, shown by the hub ("30 min", "20–40 min"); absent while unknown */
  duration?: { min: number; max: number }
  /** The game's own Sanity project: content, admin settings and the art that its hub card and its page on the hub draw (`settings.logo`, `interface.background`) */
  sanityProjectId: string
  /** Playable in production. Off: home page "coming soon" only (every page stays playable outside production). */
  live: boolean
  /** Listed in the sitemap and without `noindex` */
  indexable: boolean
}

/** The engine of any game (`GameDefinition` of the engine-kit with every type parameter open). */
export type AnyGame = AnyGameDefinition

export type Author = { name: string; signature?: string; url: string }

/**
 * Settings defaults of a game when Sanity has nothing: theme, fonts, player counts, options and who published the original game.
 * Never an image (logo, favicon and share image come from Sanity only) and never a text (the description and the authors of the
 * credits come from Sanity only).
 */
export type SettingsDefaults = Partial<Omit<SiteSettings, "theme" | "logo" | "favicon" | "shareImage" | "description" | "descriptions" | "creditsAuthors" | "credits">> & {
  theme?: Partial<ThemeColors>
  credits?: Partial<Pick<Credits, "publisher" | "publisherUrl">>
}

/**
 * How a game tunes the shared in-game UI: its look, never its logic. The announcements, the seat label and the game over have a
 * group each; the ticker, the takeover pill, the chat and the toolbar have no setting, they take the game's skin.
 * Every field is optional and a CSS value, so a game can point at its own tokens (`"var(--accent-game)"`). Nothing set: the
 * defaults of `lib/ui-theme.ts`, the look the games had before they could tune it, drawn with the game's skin (`--surface`,
 * `--accent-game`, `--font-title`, `--font-accent`…).
 */
export type UiTheme = {
  /** "calm" (default): fades and short slides · "lively": also confetti, springs and the emoji burst. Reduced motion always wins. */
  motion?: "calm" | "lively"
  /** The full-screen announcements (start, round, your turn, victory): their type, colours, veil over the table, hairlines and confetti */
  announcement?: {
    /** Font of the title and the subtitle: a CSS font-family value (default: the skin's accent font, else its title font) */
    font?: string
    /** Colour of the letters: a CSS colour (default: white) */
    color?: string
    /** Line drawn around the letters: a CSS colour, null for none (default: gold) */
    outline?: string | null
    /** Tint of the shadow under the letters: a CSS colour (default: black) */
    shadow?: string
    /** Colour of the veil that dims the table behind the text: a CSS colour (default: black) */
    veil?: string
    /** The two hairlines that frame the title: a CSS colour, null for none (default: gold) */
    rule?: string | null
    /** Confetti of the victory, lively motion only: its colour and shape, null for none (default: gold stars) */
    confetti?: { color: string; shape: "star" | "dot" } | null
  }
  /** The seat label: the avatar and the nickname next to it, on the table, in the strip, the lobby, the announcements and the game over */
  seat?: {
    /** "disc" (default) or "square" (rounded corners) */
    shape?: "disc" | "square"
    /** Line around the avatar: a CSS colour */
    ring?: string
    /** Font of the initial in the avatar: a CSS font-family value (default: the skin's title font) */
    font?: string
    /** Colour of the nickname where the UI writes it (lobby, game over): "seat" (default) is the seat colour, "ink" the text colour around it */
    name?: "seat" | "ink"
  }
  /** The end-of-game panel (winner, ranking, share thumbnail): its surface, line, corners and colours */
  gameOver?: {
    /** Background of the panel: any CSS `background` value, so a colour, a gradient or a texture (default: the skin's surface) */
    surface?: string
    /** Line around the panel: a CSS colour (default: the skin's accent at 60%) */
    border?: string
    /** Corner radius of the panel: a CSS length (default: 1.5rem) */
    radius?: string
    /** Colour of the text on the panel, the score chips included: a CSS colour (default: the skin's foreground) */
    ink?: string
    /** Colour of the crown and of the winner's points: a CSS colour (default: the skin's accent) */
    accent?: string
    /** Frame of the share thumbnail, the polaroid on the panel's corner: a CSS colour (default: cream) */
    frame?: string
  }
}

/**
 * Isomorphic part of a game (`@pbgo-game/<slug>`). A game's own texts and their translations are not in it: they live in the
 * game's Sanity project only (`texts`), and a text that is missing there shows as `[missing: <key>]` (`lib/missing.ts`).
 */
export type GameBinding = {
  SLUG: string
  /** Default title of the game (Sanity Identity overrides it) */
  NAME: string
  KEYWORDS?: readonly string[]
  AUTHOR: Author
  CONTACT: string
  GOOGLE_SITE_VERIFICATION?: string
  /** Sanity Studio of the game (default: the project's page on sanity.io) */
  STUDIO_URL?: string
  /** The engine. Absent: the game is not playable yet (home page "coming soon"). */
  GAME?: AnyGame
  SOUNDS?: SoundConfig
  DEFAULT_SKIN?: GameSkinDefaults
  /** How the shared in-game UI is tuned to this game; absent: the look the game's skin gives it (`--foreground`, `--surface`, `--accent-game`…) */
  UI_THEME?: UiTheme
  SETTINGS_DEFAULTS?: SettingsDefaults
  /**
   * The error codes the game's engine can throw, besides the platform's own. Their messages are written in every language in
   * Sanity (Gamemaster › Copy), never in the code: a code with no message there shows as `[missing: errorMessages.<CODE>]`.
   */
  ERROR_CODES?: readonly string[]
  /** Chat reactions added to (or replacing) the built-in ones, same `id` = replaced */
  REACTIONS?: Reaction[]
}

export type LogoProps = { src: string; alt?: string; className?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BoardProps = { game: PublicGame<any>; data?: unknown; onUpdate: (game: PublicGame<any>) => void; onLeave: () => void }

/** Client components of a game (`@pbgo-game/<slug>/ui`). Load the board lazily: the home page must not pull in three.js. */
export type UiBinding = {
  Logo: ComponentType<LogoProps>
  Game?: ComponentType<BoardProps>
}

export type ClientBinding = GameBinding & UiBinding

/** `sanity`: read client of the game's Sanity project, null when the registry has no project id. */
export type LoaderContext = { game: GameModule; locale: Locale; sanity: SanityClient | null }

export type GameRouteContext = { game: PlayableGame; params: Record<string, string> }
export type GameRouteHandler = (request: Request, ctx: GameRouteContext) => Promise<Response>

/** The gamemaster (`/gamemaster/api/<slug>/...`) manages any game of the registry, playable here or not. */
export type GamemasterRouteContext = { game: GameModule; params: Record<string, string> }
export type GamemasterRouteHandler = (request: Request, ctx: GamemasterRouteContext) => Promise<Response>

/** What a game tells search engines, read from its Sanity project: the genres and the platform of the structured data and the sentence of the hidden home heading. Left out when Sanity has none. */
export type HomeSeo = { genres?: readonly string[]; platform?: string; heading?: string }

/** Server part of a game (`@pbgo-game/<slug>/server`). */
export type ServerBinding = GameBinding & {
  /** Data given to `GAME.setup` (e.g. missions from Sanity) */
  loadSetupData?: (ctx: LoaderContext & { options: OptionValues }) => Promise<unknown>
  /** Data given to the board (`data` prop of `Game`) */
  loadGameData?: (ctx: LoaderContext) => Promise<unknown>
  /** Extra game routes, served at `/api/<slug>/games/<code>/<route>` */
  ROUTES?: Record<string, Partial<Record<"GET" | "POST", GameRouteHandler>>>
  /** Search-engine texts of the home page, in the visitor's language */
  SEO?: (ctx: LoaderContext) => HomeSeo | Promise<HomeSeo>
}

export type GameModule = GameEntry & { binding: ServerBinding }
export type PlayableGame = GameModule & { binding: ServerBinding & { GAME: AnyGame } }

/** What core reads from a player's view; each game's view has at least these fields. */
export type CoreView = {
  phase?: string
  log?: readonly unknown[]
  results?: Results | null
  me?: { id: string } | null
}

/** Whether the game has an engine, live or not: enough to show its table to the gamemaster in an admin preview. */
export const hasEngine = (game: GameModule): game is PlayableGame => !!game.binding.GAME

/** A game can be played when it has an engine and is live, or anywhere outside production (previews, local). */
export const isPlayable = (game: GameModule): game is PlayableGame =>
  hasEngine(game) && (game.live || process.env.VERCEL_ENV !== "production")
