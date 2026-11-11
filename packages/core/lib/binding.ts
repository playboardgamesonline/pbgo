import type { ComponentType } from "react"
import type { AnyGameDefinition, OptionValues, Results, Standing } from "@pbgo/engine-kit"
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
  /** The game's own Sanity project: its content and its admin settings, read once one enters the game. The hub reads none: its card and its page are the game in the platform's Sanity project (`@pbgo/catalog`) */
  sanityProjectId: string
  /** Playable in production. Off: its page on the hub says "Coming soon" only, and its tables and API answer 404 (every game stays playable outside production). */
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
  /** The seat label: the avatar and the nickname next to it, on the table, in the strip, the announcements and the game over */
  seat?: {
    /** "disc" (default) or "square" (rounded corners) */
    shape?: "disc" | "square"
    /** Line around the avatar: a CSS colour */
    ring?: string
    /** Font of the initial in the avatar: a CSS font-family value (default: the skin's title font) */
    font?: string
    /** Colour of the nickname where the UI writes it: "seat" (default) is the seat colour, "ink" the text colour around it */
    name?: "seat" | "ink"
  }
  /** The end-of-game card (the podium, how it ended, the buttons): its surface, line, corners and colours */
  gameOver?: {
    /** Background of the card: any CSS `background` value, so a colour, a gradient or a texture (default: the skin's surface) */
    surface?: string
    /** Line around the card: a CSS colour (default: the skin's accent at 60%) */
    border?: string
    /** Corner radius of the card: a CSS length (default: 1.5rem) */
    radius?: string
    /** Colour of the text on the card, the score chips included: a CSS colour (default: the skin's foreground) */
    ink?: string
    /** Colour of the crown, of the winner's score and of the title of a win: a CSS colour (default: the skin's accent) */
    accent?: string
    /** Frame of the share thumbnail, the polaroid of the former panel: a CSS colour (default: cream). The card shares with a button and no longer reads it */
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
  /** The engine. Absent: the game is not playable yet (its page on the hub says "Coming soon"). */
  GAME?: AnyGame
  SOUNDS?: SoundConfig
  DEFAULT_SKIN?: GameSkinDefaults
  /** How the shared in-game UI is tuned to this game; absent: the look the game's skin gives it (`--foreground`, `--surface`, `--accent-game`…) */
  UI_THEME?: UiTheme
  SETTINGS_DEFAULTS?: SettingsDefaults
  /**
   * The codes of the game's own refusals: what its engine throws besides the shared codes (`SHARED_ERROR_CODES` of engine-kit) and the platform's own,
   * which the platform words. Their messages are written in every language in Sanity (Gamemaster › Copy), never in the code:
   * a code with no message there shows as `[missing: errorMessages.<CODE>]`.
   */
  ERROR_CODES?: readonly string[]
  /** Chat reactions added to (or replacing) the built-in ones, same `id` = replaced */
  REACTIONS?: Reaction[]
}

export type LogoProps = { src: string; alt?: string; className?: string }

export type BoardProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  game: PublicGame<any>
  data?: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (game: PublicGame<any>) => void
  onLeave: () => void
  /**
   * The start screen is up (PLT-107): draw the board and load what it needs, but hold everything that starts the game for the eyes and the ears (the camera's entrance, the opening, the first announcement, the sounds) until this turns false, and play it
   * from then on. Absent: no screen, as in the admin's preview.
   */
  held?: boolean
  /**
   * Call it once, when the board is drawn and everything it needs is in (its pictures, its chunks): the board is then loaded, and the player is ready once they have also pressed the button of the screen, "I'm here". The game begins when every player is. A board that never calls it is waited for `READY_LOAD_GRACE_MS`, no longer.
   */
  onLoaded?: () => void
  /**
   * Where the deadline of the game ends, on the page's own clock (`performance.now()`), for a game that has a clock (`GAME.nextDeadline`); null when it has none, or none is running. The platform counts it down and asks the server to play the deadline when
   * it ends: the board only draws the time left, with a `Timer`, which reads this and the length of the step from the game's view.
   */
  deadlineAt?: number | null
  /** Call it as the board loads, with how far it is, 0 to 1 (never back): the collective bar of the start screen is made of the boards' progress. A board that never calls it shows no progress until it is loaded. */
  onProgress?: (progress: number) => void
}

/** Client components of a game (`@pbgo-game/<slug>/ui`). Load the board lazily: the screens around it must not pull in three.js. */
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

/** Server part of a game (`@pbgo-game/<slug>/server`). */
export type ServerBinding = GameBinding & {
  /** Data given to `GAME.setup` (e.g. missions from Sanity) */
  loadSetupData?: (ctx: LoaderContext & { options: OptionValues }) => Promise<unknown>
  /** Data given to the board (`data` prop of `Game`) */
  loadGameData?: (ctx: LoaderContext) => Promise<unknown>
  /** Extra game routes, served at `/api/<slug>/games/<code>/<route>` */
  ROUTES?: Record<string, Partial<Record<"GET" | "POST", GameRouteHandler>>>
}

export type GameModule = GameEntry & { binding: ServerBinding }
export type PlayableGame = GameModule & { binding: ServerBinding & { GAME: AnyGame } }

/**
 * What core reads from a player's view: the results once the game is over, the length of the log and what each player has so far (`standings`, for the list of
 * the players). A view is the game's to shape for its own board. What core needs besides, it takes from the table: who is looking is `PublicGame.meId` and
 * whether the game is over is `PublicGame.status`, so a game names its phase and its `me` as it likes, and gives none to a player who is out.
 */
export type CoreView = {
  results?: Results | null
  log?: readonly unknown[]
  standings?: readonly Standing[]
}

/** Whether the game has an engine, live or not: enough to show its table to the gamemaster in an admin preview. */
export const hasEngine = (game: GameModule): game is PlayableGame => !!game.binding.GAME

/** A game can be played when it has an engine and is live, or anywhere outside production (previews, local). */
export const isPlayable = (game: GameModule): game is PlayableGame =>
  hasEngine(game) && (game.live || process.env.VERCEL_ENV !== "production")
