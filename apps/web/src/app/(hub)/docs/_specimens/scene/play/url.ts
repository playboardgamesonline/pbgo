// The scene in the address: a scene's name and what differs from it (the parts switched on or off, the number of players, the layout of the hand, the shape of the board, the view), in the hash of the page, so a link opens the same table. What lies on the table, the
// score and the log are not in it: the link is a starting point, not a save. Pure: it reads and writes strings.

import { BOARD_SHAPES, type BoardShape, HAND_PLACES, type HandPlace, LAYOUTS, type LayoutName, PILE_PLACES, type PilePlace, PLAY_LIMITS, PLAY_PARTS, PLAY_PLAYERS, type PlayPart, type PlayState } from "../defaults"
import { DEFAULT_PRESET, PRESET_IDS, type PresetId, presetState } from "./presets"
import { reshapeBoard } from "./state"

const SEPARATOR = "."
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const pick = <T extends string>(list: readonly T[], value: string | null): T | undefined => list.find((one) => one === value)
const number = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** The hash of a table that began as `scene`: only the fields that differ from that scene are written, so a table nobody changed has a short link (`#s=card`) */
export function encodeScene(state: PlayState): string {
  const scene = state.scene
  const start = presetState(scene)
  const params = new URLSearchParams({ s: scene })
  const on = PLAY_PARTS.filter((part) => state.parts[part] && !start.parts[part])
  const off = PLAY_PARTS.filter((part) => !state.parts[part] && start.parts[part])
  if (on.length) params.set("on", on.join(SEPARATOR))
  if (off.length) params.set("off", off.join(SEPARATOR))
  if (state.players !== start.players) params.set("pl", String(state.players))
  if (state.hand.layout !== start.hand.layout) params.set("hl", state.hand.layout)
  if (state.layout.hand !== start.layout.hand) params.set("hp", state.layout.hand)
  if (state.layout.piles !== start.layout.piles) params.set("pp", state.layout.piles)
  if (state.board.shape !== start.board.shape) params.set("bs", state.board.shape)
  if (state.board.centre !== start.board.centre) params.set("bc", state.board.centre ? "1" : "0")
  if (state.zoom !== start.zoom) params.set("z", String(Math.round(state.zoom * 10) / 10))
  if (state.tilt !== start.tilt) params.set("t", String(Math.round(state.tilt)))
  if (state.above !== start.above) params.set("up", state.above ? "1" : "0")
  return params.toString()
}

/** The table a hash describes, and the scene it began as; null when the hash names no scene we know. Anything unknown in it (a part that is gone, a number out of range) is left out or brought into range, never an error */
export function decodeScene(hash: string): { state: PlayState; scene: PresetId } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const scene = pick(PRESET_IDS, params.get("s"))
  if (!scene) return null
  const state = presetState(scene)
  const parts = (key: string) => (params.get(key) ?? "").split(SEPARATOR).filter((part): part is PlayPart => (PLAY_PARTS as readonly string[]).includes(part))
  const next: PlayState = { ...state, parts: { ...state.parts } }
  for (const part of parts("on")) next.parts[part] = true
  for (const part of parts("off")) next.parts[part] = false
  const players = number(params.get("pl"))
  if (players !== undefined) next.players = clamp(Math.round(players), PLAY_PLAYERS.min, PLAY_PLAYERS.max)
  const layout: LayoutName | undefined = pick(LAYOUTS, params.get("hl"))
  if (layout) next.hand = { ...next.hand, layout }
  const handAt: HandPlace | undefined = pick(HAND_PLACES, params.get("hp"))
  const pilesAt: PilePlace | undefined = pick(PILE_PLACES, params.get("pp"))
  if (handAt || pilesAt) next.layout = { hand: handAt ?? next.layout.hand, piles: pilesAt ?? next.layout.piles }
  const shape: BoardShape | undefined = pick(BOARD_SHAPES, params.get("bs"))
  const centre = params.get("bc")
  const zoom = number(params.get("z"))
  if (zoom !== undefined) next.zoom = clamp(zoom, PLAY_LIMITS.zoom.min, PLAY_LIMITS.zoom.max + 8)
  const tilt = number(params.get("t"))
  if (tilt !== undefined) next.tilt = clamp(tilt, PLAY_LIMITS.tilt.min, PLAY_LIMITS.tilt.max)
  if (params.get("up") !== null) next.above = params.get("up") === "1"
  const reshaped = shape || centre !== null ? reshapeBoard(next, { ...(shape ? { shape } : {}), ...(centre !== null ? { centre: centre === "1" } : {}) }) : next
  return { state: reshaped, scene }
}

export { DEFAULT_PRESET }
