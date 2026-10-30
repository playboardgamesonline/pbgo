import type { Metadata } from "next"

/**
 * The pages of `/design` and the sections of each one: a single list for the side navigation, the headings and the routes, so that the three cannot drift. A section is on one page only, and its id is its anchor. The pages are
 * grouped in three families, Foundations (the tokens), Components (the pieces of `@pbgo/ui/platform`, in five pages) and In-game UI (what every game shares, drawn in two games' looks).
 */
export const PAGES = [
  {
    slug: "foundations",
    family: "Foundations",
    href: "/design/foundations",
    title: "Foundations",
    description: "The principles of the platform's look and the tokens it is made of: colour, type, radius, spacing, depth, glass and motion.",
    sections: [
      { id: "principles", title: "Principles" },
      { id: "layers", title: "Layers and boundary" },
      { id: "colors", title: "Colors" },
      { id: "typography", title: "Typography" },
      { id: "radius", title: "Radius" },
      { id: "layout", title: "Spacing and layout" },
      { id: "depth", title: "Shadows and rings" },
      { id: "glass", title: "Glass" },
      { id: "motion", title: "Motion" },
      { id: "playful-motion", title: "Playful motion" },
      { id: "utilities", title: "Utilities" },
    ],
  },
  {
    slug: "controls",
    family: "Components",
    href: "/design/components/controls",
    title: "Controls",
    description: "What a visitor presses, types in or picks: buttons, badges, fields, selects, sliders, meters, tabs and toggles.",
    sections: [
      { id: "button", title: "Button" },
      { id: "provider-button", title: "Provider button" },
      { id: "badge", title: "Badge" },
      { id: "input", title: "Input and fields" },
      { id: "checkbox", title: "Checkbox and switch" },
      { id: "select", title: "Select" },
      { id: "combobox", title: "Combobox" },
      { id: "slider", title: "Slider" },
      { id: "meter", title: "Meter" },
      { id: "tabs", title: "Tabs" },
      { id: "toggle-group", title: "Toggle group" },
    ],
  },
  {
    slug: "navigation",
    family: "Components",
    href: "/design/components/navigation",
    title: "Navigation and brand",
    description: "The bars that take a visitor from page to page, and the marks of the brand: the logo, the wordmark, the pieces of the home's title.",
    sections: [
      { id: "logo", title: "Logo" },
      { id: "wordmark", title: "Wordmark" },
      { id: "face-cycle", title: "Face cycle" },
      { id: "navbar", title: "Navbar" },
      { id: "search-bar", title: "Search bar" },
      { id: "board-pattern", title: "Board pattern" },
      { id: "title-pieces", title: "Title pieces" },
      { id: "stats", title: "Stats" },
    ],
  },
  {
    slug: "overlays",
    family: "Components",
    href: "/design/components/overlays",
    title: "Overlays",
    description: "What appears over the page: dialogs, sheets, menus, popovers, tooltips, toasts and the cookie banner.",
    sections: [
      { id: "dialog", title: "Dialog" },
      { id: "sheet", title: "Sheet" },
      { id: "dropdown-menu", title: "Dropdown menu" },
      { id: "popover", title: "Popover" },
      { id: "tooltip", title: "Tooltip" },
      { id: "toast", title: "Toast" },
      { id: "cookie-banner", title: "Cookie banner" },
    ],
  },
  {
    slug: "surfaces",
    family: "Components",
    href: "/design/components/surfaces",
    title: "Surfaces and data",
    description: "The containers and what they hold: cards, plans, games, credits, avatars, alerts, progress, lists, empty states and tables.",
    sections: [
      { id: "card", title: "Card" },
      { id: "plan-card", title: "Plan card" },
      { id: "game-card", title: "Game card" },
      { id: "credit-link", title: "Credit link" },
      { id: "section", title: "Section" },
      { id: "avatar", title: "Avatar" },
      { id: "alert", title: "Alert" },
      { id: "progress", title: "Progress, spinner, skeleton" },
      { id: "separator", title: "Separator" },
      { id: "empty", title: "Empty" },
      { id: "item", title: "Item" },
      { id: "table", title: "Table" },
    ],
  },
  {
    slug: "social",
    family: "Components",
    href: "/design/components/social",
    title: "Social",
    description: "The friends of a signed-in visitor: the panel, the bar and the dock that turns from one into the other.",
    sections: [
      { id: "friends-panel", title: "Friends panel" },
      { id: "friends-bar", title: "Friends bar" },
      { id: "social-panel", title: "Social panel" },
    ],
  },
  {
    slug: "in-game",
    family: "In-game UI",
    href: "/design/in-game",
    title: "In-game UI",
    description: "What every game shares around its board, drawn in the look of two games side by side: each game owns its universe, the platform's look stops at the table's edge.",
    sections: [
      { id: "game-themes", title: "Game themes" },
      { id: "seat-label", title: "Seat label" },
      { id: "players-strip", title: "Players strip" },
      { id: "announcements", title: "Announcements" },
      { id: "game-over", title: "Game over" },
    ],
  },
] as const

export type DesignPage = (typeof PAGES)[number]
export type PageSlug = DesignPage["slug"]
export type SectionId = DesignPage["sections"][number]["id"]

/** The families of pages, in the order of the navigation. */
export const FAMILIES = ["Foundations", "Components", "In-game UI"] as const

export function pageOf(slug: PageSlug): DesignPage {
  const page = PAGES.find((candidate) => candidate.slug === slug)
  if (!page) throw new Error(`Unknown page of /design: ${slug}`)
  return page
}

/** What a page of `/design` tells the browser: its title, what it holds and its own address (the root layout of the hub says the home's). The layout keeps every page out of the search engines. */
export function pageMetadata(slug: PageSlug): Metadata {
  const page = pageOf(slug)
  return { title: `${page.title} · Design system`, description: page.description, alternates: { canonical: page.href } }
}

/** The page a section is on, and its title: what its heading and its anchor say. */
export function sectionOf(id: SectionId): { page: DesignPage; title: string } {
  for (const page of PAGES) {
    const entry = page.sections.find((section) => section.id === id)
    if (entry) return { page, title: entry.title }
  }
  throw new Error(`Unknown section of /design: ${id}`)
}
