// The play zone of the signed-in home, the one central interface: what its switch offers (three modes, each an icon and a name), and the row of places that holds the visitor and the people they play with, the visitor first and the free places after them. No React in this file, so that it is tested as it is. The blocks that draw it are
// `@pbgo/ui/platform/mode-switch` and `@pbgo/ui/platform/player-slots`; which games are listed and what a press does are the page's.

import { QUEUE_MODE_LABELS, type QueueMode } from "./queue"
import { MAX_SEATS } from "./tables"

/** What the switch of the play zone offers: look for a table among players one does not know (`normal`, `ranked`), or open a table for friends (`custom`). */
export type PlayZoneMode = "normal" | "ranked" | "custom"

/** Every mode, in the order the switch has them. */
export const PLAY_ZONE_MODES: readonly PlayZoneMode[] = ["normal", "ranked", "custom"]

/** What each mode is called on the switch. */
export const PLAY_ZONE_LABELS: Record<PlayZoneMode, string> = { ...QUEUE_MODE_LABELS, custom: "Custom" }

/** The kind of search a mode is, or null for a mode that is not a search (a table opened by hand). */
export const searchModeOf = (mode: PlayZoneMode): QueueMode | null => (mode === "normal" || mode === "ranked" ? mode : null)

/** The most places the row has: one for each seat of the largest table, so that a whole group sits on one line. */
export const SLOT_COLUMNS = MAX_SEATS

/** How many places the row has to begin with, however few people are in it: the visitor's and the ones that wait for a friend. */
export const SLOT_BASE = 5

/**
 * How many places the row of a group has: the base, and one more, free, as soon as every place is taken, the way the row of games ends with the tile that adds one, up to the most a table holds. A group of four has the five places it began
 * with, one of them free; a fifth person fills the last and the row gets a sixth, and so on to nine, where it is full.
 */
export const placesFor = (people: number): number => Math.min(SLOT_COLUMNS, Math.max(SLOT_BASE, (Number.isFinite(people) ? Math.floor(people) : 0) + 1))

/** A place of the row: it holds a person or, with `person` null, is free. */
export type SlotCell<T> = { person: T | null }

/**
 * The places of a row of `size` places, from the left: the `people` in the order they are given (the first, the visitor, has the first place) and then the free places. A row is never smaller than the people in it and never larger than a table (`MAX_SEATS`),
 * and it holds at least the visitor's place; a person beyond the nine is left out.
 */
export function layoutRow<T>(people: readonly T[], size: number): SlotCell<T>[] {
  const places = Math.min(SLOT_COLUMNS, Math.max(1, Math.floor(size) || 1, people.length))
  return Array.from({ length: places }, (_, index) => ({ person: people[index] ?? null }))
}
