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
      { id: "dialog", title: "Dialog" },
      { id: "sheet", title: "Sheet" },
      { id: "dropdown-menu", title: "Dropdown menu" },
      { id: "tooltip", title: "Tooltip" },
      { id: "toast", title: "Toast" },
      { id: "card", title: "Card" },
      { id: "game-card", title: "Game card" },
      { id: "avatar", title: "Avatar" },
      { id: "alert", title: "Alert" },
      { id: "progress", title: "Progress, spinner, skeleton" },
      { id: "separator", title: "Separator" },
      { id: "empty", title: "Empty" },
      { id: "item", title: "Item" },
      { id: "table", title: "Table" },
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
