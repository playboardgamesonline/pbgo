import {
  Activity01Icon,
  Analytics01Icon,
  Bug01Icon,
  DiceIcon,
  GameController01Icon,
  IdIcon,
  Message01Icon,
  MusicNote01Icon,
  PaintBoardIcon,
  Rocket01Icon,
  TaskDone01Icon,
  TextIcon,
} from "@hugeicons/core-free-icons"

export type AdminPath =
  | "identity"
  | "mechanics"
  | "visual"
  | "audio"
  | "copy"
  | "tasks/launch"
  | "tasks/backlog"
  | "tasks/bugs"
  | "tasks/feedback"
  | "monitoring/games"
  | "monitoring/audience"
  | "monitoring/health"

export type CountKey = "launch" | "backlog" | "bugs" | "feedback"

export type NavItem = { path: AdminPath; label: string; description: string; icon: typeof IdIcon; count?: CountKey }

/** Sidebar of a game in the gamemaster: Setup (site settings), Tasks (project follow-up), Monitoring (live status). Paths are relative to `/gamemaster/<slug>`. */
export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Setup",
    items: [
      { path: "identity", label: "Identity", description: "Name, description, credits, favicon, logo and share image.", icon: IdIcon },
      { path: "mechanics", label: "Mechanics", description: "Players, game options, rules and absent players.", icon: DiceIcon },
      { path: "visual", label: "Visual", description: "Colors, fonts, decorations and table.", icon: PaintBoardIcon },
      { path: "audio", label: "Audio", description: "Music, ambience, sound effects and default volumes.", icon: MusicNote01Icon },
      { path: "copy", label: "Copy", description: "Every text of the game, screen by screen.", icon: TextIcon },
    ],
  },
  {
    group: "Tasks",
    items: [
      { path: "tasks/launch", label: "Launch", description: "What is left before going live, checked automatically.", icon: Rocket01Icon },
      { path: "tasks/backlog", label: "Backlog", description: "Features and improvements, by category and priority.", icon: TaskDone01Icon, count: "backlog" },
      { path: "tasks/bugs", label: "Bugs", description: "Problems to fix, by severity.", icon: Bug01Icon, count: "bugs" },
      { path: "tasks/feedback", label: "Feedback", description: "Messages sent by players from the game.", icon: Message01Icon, count: "feedback" },
    ],
  },
  {
    group: "Monitoring",
    items: [
      { path: "monitoring/games", label: "Games", description: "Games played, players and completion.", icon: GameController01Icon },
      { path: "monitoring/audience", label: "Audience", description: "Visitors, pages and countries (Vercel Web Analytics).", icon: Analytics01Icon },
      { path: "monitoring/health", label: "Health", description: "Services, deployment and the other PBGO games.", icon: Activity01Icon },
    ],
  },
]

export const ADMIN_ITEMS = ADMIN_NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))

export const findAdminItem = (path: string) => ADMIN_ITEMS.find((i) => i.path === path)

/** The gamemaster: one back office for every game (`/gamemaster`), with a game switcher in its sidebar. */
export const GAMEMASTER_PATH = "/gamemaster"

/** Where a visitor without a session signs in. */
export const LOGIN_PATH = `${GAMEMASTER_PATH}/login`

/**
 * Where the login page goes once signed in: its `next` parameter, but only a page of the gamemaster. Anything else (another site,
 * `//host`, a backslash that browsers read as a slash, the login page or the API) goes to the overview, so the parameter cannot be
 * used as an open redirect.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !/^\/gamemaster(?:[/?#]|$)/.test(next) || /[\\\u0000-\u001f\u007f]/.test(next)) return GAMEMASTER_PATH
  const path = next.split(/[?#]/, 1)[0]
  const own = (base: string) => path === base || path.startsWith(`${base}/`)
  return own(LOGIN_PATH) || own(`${GAMEMASTER_PATH}/api`) ? GAMEMASTER_PATH : next
}

/** URL of a gamemaster page of a game: `/gamemaster/<slug>/<path>` (`/gamemaster/<slug>` for the first page). */
export const adminHref = (slug: string, path?: AdminPath | "") => (path ? `${GAMEMASTER_PATH}/${slug}/${path}` : `${GAMEMASTER_PATH}/${slug}`)

/** Admin API of a game: `/gamemaster/api/<slug>`, below the path of the session cookie like the pages. */
export const adminApiBase = (slug: string) => `${GAMEMASTER_PATH}/api/${slug}`

/**
 * Preview of a game (`home` or `game`) for the iframe of Setup pages. It sits below `/gamemaster` so the session cookie reaches it;
 * `next.config.ts` rewrites it to `/<slug>/preview/<kind>`, which renders in the game's own layout and skin.
 */
export const previewHref = (slug: string, kind: "home" | "game") => `${GAMEMASTER_PATH}/${slug}/preview/${kind}`

/** Page of the sidebar shown by an admin pathname (`/gamemaster/<slug>/<path>`), null on the overview and unknown pages. */
export function sectionOf(pathname: string | null | undefined): AdminPath | null {
  const [, root, , ...path] = (pathname ?? "").split("/")
  return root === "gamemaster" ? (findAdminItem(path.join("/"))?.path ?? null) : null
}

/** Where the game switcher goes: the same page of the chosen game, else its first page (Identity). Every game has every page. */
export const switchHref = (slug: string, pathname: string | null | undefined) => adminHref(slug, sectionOf(pathname) ?? "identity")
