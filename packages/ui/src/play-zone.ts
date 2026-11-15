// The play zone of the signed-in home, the one central interface: what its switch offers (four modes, each an icon and a name), and the row of places that holds the visitor and the people they play with. No React in this file, so that it is tested as it is. The blocks that draw it are
// `@pbgo/ui/platform/mode-switch` and `@pbgo/ui/platform/player-slots`; which games are listed and what a press does are the page's.

import { QUEUE_MODE_LABELS, type QueueMode } from "./queue"
import { MAX_SEATS } from "./tables"

/** What the switch of the play zone offers: look for a table among players one does not know (`normal`, `ranked`), go to the tournaments, or open a table for friends (`custom`). */
export type PlayZoneMode = "normal" | "ranked" | "tournaments" | "custom"

/** Every mode, in the order the switch has them. */
export const PLAY_ZONE_MODES: readonly PlayZoneMode[] = ["normal", "ranked", "tournaments", "custom"]

/** What each mode is called on the switch. */
export const PLAY_ZONE_LABELS: Record<PlayZoneMode, string> = { ...QUEUE_MODE_LABELS, tournaments: "Tournaments", custom: "Custom" }

/** The kind of search a mode is, or null for a mode that is not a search (the tournaments, a table opened by hand). */
export const searchModeOf = (mode: PlayZoneMode): QueueMode | null => (mode === "normal" || mode === "ranked" ? mode : null)

/** The columns of the row of places: one for each seat of the largest table, so that a whole group sits on one line. */
export const SLOT_COLUMNS = MAX_SEATS

/** The column of the middle of the row, where the visitor stands: the widest, so that their picture is the largest. */
export const SLOT_MIDDLE = Math.floor(SLOT_COLUMNS / 2)

/** The order the places of the row fill in, by column: the visitor in the middle, then one place to its right, one to its left, and so on outwards. For nine columns: 4, 5, 3, 6, 2, 7, 1, 8, 0. */
export const SLOT_ORDER: readonly number[] = Array.from({ length: SLOT_COLUMNS }, (_, index) => (index === 0 ? SLOT_MIDDLE : SLOT_MIDDLE + (index % 2 === 1 ? (index + 1) / 2 : -index / 2)))

/** A column of the row: `null` when the row does not use it (a table of fewer seats), else a place that holds a person or, with `person` null, is free. */
export type SlotCell<T> = { person: T | null } | null

/**
 * The columns of a row of `size` places: the `people` in the order the places fill in (the first, the visitor, in the middle), the free places after them, and no place in a column that the row does not use. A row is never smaller than the people in it
 * and never larger than a table (`MAX_SEATS`), and it holds at least the visitor's place; a person beyond the nine is left out.
 */
export function layoutRow<T>(people: readonly T[], size: number): SlotCell<T>[] {
  const places = Math.min(SLOT_COLUMNS, Math.max(1, Math.floor(size) || 1, people.length))
  const cells: SlotCell<T>[] = Array.from({ length: SLOT_COLUMNS }, () => null)
  for (let index = 0; index < places; index++) cells[SLOT_ORDER[index]!] = { person: people[index] ?? null }
  return cells
}
