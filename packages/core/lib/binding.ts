import type { ComponentType } from "react"
import type { GameDefinition, OptionValues, Results } from "@pbgo/engine-kit"
import type { SanityClient } from "@sanity/client"
import type { PublicGame } from "./game-types"
import type { Locale } from "./i18n"
import type { SiteSettings, ThemeColors } from "./settings"
import type { GameI18n, SkinDefaults } from "./skin"
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
  /** The game's own Sanity project (content, admin settings) */
  sanityProjectId: string
  /** Playable in production. Off: home page "coming soon" only (every page stays playable outside production). */
  live: boolean
  /** Listed in the sitemap and without `noindex` */
  indexable: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDefinition<any, any, any, any>

export type Author = { name: string; signature?: string; url: string }

/** Settings defaults of a game when Sanity has nothing (theme, fonts, credits…). */
export type SettingsDefaults = Partial<Omit<SiteSettings, "theme">> & { theme?: Partial<ThemeColors> }

/** Isomorphic part of a game (`@pbgo-game/<slug>`). */
export type GameBinding = {
  SLUG: string
  /** Default title of the game (Sanity Identity overrides it) */
  NAME: string
  TAGLINE: string
  DESCRIPTION: string
  KEYWORDS?: readonly string[]
  AUTHOR: Author
  CONTACT: string
  GOOGLE_SITE_VERIFICATION?: string
  /** Sanity Studio of the game (default: the project's page on sanity.io) */
  STUDIO_URL?: string
  /** The engine. Absent: the game is not playable yet (home page "coming soon"). */
  GAME?: AnyGame
  SOUNDS?: SoundConfig
  /** Texts of the game in the languages other than French */
  I18N?: Partial<Record<Locale, GameI18n>>
  DEFAULT_SKIN?: SkinDefaults
  SETTINGS_DEFAULTS?: SettingsDefaults
  /** French messages of the engine's error codes */
  ERROR_MESSAGES?: Record<string, string>
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

/** Search engines: genres and platform of the JSON-LD, sentence of the hidden home heading. */
export type HomeSeo = { genres?: readonly string[]; platform?: string; heading?: string }

/** Server part of a game (`@pbgo-game/<slug>/server`). */
export type ServerBinding = GameBinding & {
  /** Data given to `GAME.setup` (e.g. missions from Sanity) */
  loadSetupData?: (ctx: LoaderContext & { options: OptionValues }) => Promise<unknown>
  /** Data given to the board (`data` prop of `Game`) */
  loadGameData?: (ctx: LoaderContext) => Promise<unknown>
  /** Extra game routes, served at `/api/<slug>/games/<code>/<route>` */
  ROUTES?: Record<string, Partial<Record<"GET" | "POST", GameRouteHandler>>>
  SEO?: (locale: Locale) => HomeSeo
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

/** A game can be played when it has an engine and is live, or anywhere outside production (previews, local). */
export const isPlayable = (game: GameModule): game is PlayableGame =>
  !!game.binding.GAME && (game.live || process.env.VERCEL_ENV !== "production")
