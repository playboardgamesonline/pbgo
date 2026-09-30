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

/** Barre latérale de l'admin : Setup (réglages du site), Tasks (suivi du projet), Monitoring (état en ligne). */
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
