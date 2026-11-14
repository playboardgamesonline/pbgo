// The keyboard of the playground: which key does what, in one list that the help popover prints and the page listens to. Pure: `shortcutFor` takes the fields of a key event and says which shortcut it is, so the table of keys is tested without a browser.

import { PRESET_IDS, type PresetId } from "./presets"

export type Shortcut =
  | "undo"
  | "redo"
  | "deal"
  | "flip"
  | "move"
  | "discard"
  | "playCard"
  | "pass"
  | "nextTurn"
  | "point"
  | "endRound"
  | "roll"
  | "addCard"
  | "addPiece"
  | "remove"
  | "putDown"
  | "search"
  | "help"
  | "above"
  | "reset"

export type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }

/** What a shortcut is for the help: the keys to write, what it does, under which heading */
export const SHORTCUTS: readonly { id: Shortcut | "scene"; keys: string[]; label: string; group: "Edit" | "Transitions" | "Table" | "Scene" }[] = [
  { id: "undo", keys: ["Ctrl/⌘", "Z"], label: "Undo the last change", group: "Edit" },
  { id: "redo", keys: ["Ctrl/⌘", "Shift", "Z"], label: "Do it again", group: "Edit" },
  { id: "reset", keys: ["Shift", "R"], label: "Reset the scene", group: "Edit" },
  { id: "deal", keys: ["D"], label: "Deal a card from the draw pile", group: "Transitions" },
  { id: "flip", keys: ["F"], label: "Flip a card (the picked one)", group: "Transitions" },
  { id: "move", keys: ["M"], label: "Move a piece to the next cell", group: "Transitions" },
  { id: "playCard", keys: ["H"], label: "Play a card from the hand", group: "Transitions" },
  { id: "discard", keys: ["X"], label: "Discard a card from the hand", group: "Transitions" },
  { id: "pass", keys: ["T"], label: "Pass a card to the next seat", group: "Transitions" },
  { id: "nextTurn", keys: ["N"], label: "Next turn", group: "Table" },
  { id: "point", keys: ["+"], label: "A point for the seat whose turn it is", group: "Table" },
  { id: "endRound", keys: ["E"], label: "End the round", group: "Table" },
  { id: "roll", keys: ["R"], label: "Roll the dice", group: "Table" },
  { id: "addCard", keys: ["C"], label: "Add a card", group: "Table" },
  { id: "addPiece", keys: ["P"], label: "Add a piece", group: "Table" },
  { id: "remove", keys: ["Del"], label: "Remove the picked thing", group: "Table" },
  { id: "putDown", keys: ["Esc"], label: "Put the picked thing down", group: "Table" },
  { id: "above", keys: ["V"], label: "Seen from above, or not", group: "Table" },
  { id: "search", keys: ["/"], label: "Search the parts and the settings", group: "Scene" },
  { id: "scene", keys: ["1", "–", String(PRESET_IDS.length)], label: "Start from a scene", group: "Scene" },
  { id: "help", keys: ["?"], label: "This list", group: "Scene" },
]

const BY_KEY: Record<string, Shortcut> = {
  d: "deal",
  f: "flip",
  m: "move",
  x: "discard",
  h: "playCard",
  t: "pass",
  n: "nextTurn",
  "+": "point",
  "=": "point",
  e: "endRound",
  r: "roll",
  c: "addCard",
  p: "addPiece",
  delete: "remove",
  backspace: "remove",
  escape: "putDown",
  "/": "search",
  "?": "help",
  v: "above",
}

/** The shortcut a key is, or the scene a digit picks, or null for a key that is not one. Ctrl or ⌘ with Z is undo (with Shift, redo; Ctrl+Y is redo); every other key is a shortcut with no Ctrl, ⌘ or Alt held, and Shift only for the keys that need it (?, +, and Shift+R for the reset). */
export function shortcutFor(event: KeyLike): Shortcut | { scene: PresetId } | null {
  const key = event.key.toLowerCase()
  if (event.ctrlKey || event.metaKey) {
    if (event.altKey) return null
    if (key === "z") return event.shiftKey ? "redo" : "undo"
    return key === "y" ? "redo" : null
  }
  if (event.altKey) return null
  if (key === "r") return event.shiftKey ? "reset" : "roll"
  if (/^[1-9]$/.test(key)) {
    const scene = PRESET_IDS[Number(key) - 1]
    return scene && !event.shiftKey ? { scene } : null
  }
  if (event.shiftKey && !["?", "+", "/"].includes(key) && key.length === 1 && /[a-z]/.test(key)) return null
  return BY_KEY[key] ?? null
}

/** Whether a key pressed in this element is the page's: not while the visitor types in a field, a menu or a dialog */
export function isTyping(target: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null): boolean {
  if (!target) return false
  const tag = target.tagName?.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest?.('[role="dialog"], [role="menu"], [role="listbox"]'))
}
