/** The sections of `/design`: one list for the side navigation and for the headings, so the two cannot drift. */
export const NAV = [
  {
    group: "Foundations",
    items: [
      { id: "principles", title: "Principles" },
      { id: "layers", title: "Layers and boundary" },
      { id: "colors", title: "Colors" },
      { id: "typography", title: "Typography" },
      { id: "radius", title: "Radius" },
      { id: "layout", title: "Spacing and layout" },
      { id: "depth", title: "Shadows and rings" },
      { id: "motion", title: "Motion" },
      { id: "utilities", title: "Utilities" },
    ],
  },
  {
    group: "Components",
    items: [
      { id: "button", title: "Button" },
      { id: "badge", title: "Badge" },
      { id: "input", title: "Input and fields" },
      { id: "checkbox", title: "Checkbox and switch" },
      { id: "select", title: "Select" },
      { id: "tabs", title: "Tabs" },
      { id: "toggle-group", title: "Toggle group" },
      { id: "logo", title: "Logo" },
      { id: "wordmark", title: "Wordmark" },
      { id: "face-cycle", title: "Face cycle" },
      { id: "navbar", title: "Navbar" },
      { id: "search-bar", title: "Search bar" },
      { id: "dialog", title: "Dialog" },
      { id: "sheet", title: "Sheet" },
      { id: "dropdown-menu", title: "Dropdown menu" },
      { id: "popover", title: "Popover" },
      { id: "tooltip", title: "Tooltip" },
      { id: "toast", title: "Toast" },
      { id: "cookie-banner", title: "Cookie banner" },
      { id: "card", title: "Card" },
      { id: "game-card", title: "Game card" },
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
    group: "In-game UI",
    items: [
      { id: "game-themes", title: "Game themes" },
      { id: "seat-label", title: "Seat label" },
      { id: "players-strip", title: "Players strip" },
      { id: "announcements", title: "Announcements" },
      { id: "game-over", title: "Game over" },
    ],
  },
] as const

export type SectionId = (typeof NAV)[number]["items"][number]["id"]

type Entry = { id: SectionId; title: string }

export const GROUPS: readonly { group: string; items: readonly Entry[] }[] = NAV

export function sectionOf(id: SectionId): { group: string; title: string } {
  for (const { group, items } of GROUPS) {
    const entry = items.find((item) => item.id === id)
    if (entry) return { group, title: entry.title }
  }
  throw new Error(`Unknown section of /design: ${id}`)
}
