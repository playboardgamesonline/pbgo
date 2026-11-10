import { EngineError } from "./errors"

/**
 * Drawings. A drawing is what a player draws on a sheet: a list of strokes, each a line of points in one colour of the game's palette and one width of its brushes. It is kept in the state as plain numbers, so that it stays lean (ids and numbers
 * only), is the same for every viewer and can be read back from `jsonb`, and it is bounded, so that a player cannot fill the table with it: the number of strokes, the points of a stroke and the points of the whole drawing have limits that a
 * game can narrow. The points lie on a grid of whole numbers, `DRAWING_GRID` on each side, whatever size the sheet is drawn at: the board maps them to the sheet, and the engine never knows a pixel.
 *
 * A board sends strokes in actions, the engine cleans them here and keeps what comes back, as it does for any answer (`cleanText`, `cleanNumber`). It shows the others a drawing through its view, or keeps it secret in a `Submissions<Drawing>` until
 * every player has drawn.
 */

/** The grid a drawing lies on: every point is a whole number from 0 to `DRAWING_GRID` on both axes, the origin at the top left of the sheet and `y` growing downward */
export const DRAWING_GRID = 1000

/** One stroke: the colour (an index of the game's palette), the width (an index of its brushes) and the points as a flat list, `x` then `y` for each, along the way the pen went. A single point is a dot */
export type Stroke = { color: number; width: number; points: number[] }

/** What a player drew, the strokes in the order they were drawn */
export type Drawing = Stroke[]

/** What a game allows. `colors` and `widths` are how many there are in its palette and its brushes: a stroke takes one of each, counted from 0 */
export type DrawingRules = {
  colors: number
  widths: number
  /** The most strokes a drawing holds (default `DRAWING_LIMITS.strokes`) */
  strokes?: number
  /** The most points in all (default `DRAWING_LIMITS.points`) */
  points?: number
  /** The most points in one stroke (default `DRAWING_LIMITS.strokePoints`) */
  strokePoints?: number
}

/** What a drawing may hold unless a game says less: a sheet that a player draws on for a minute is well under it */
export const DRAWING_LIMITS = { strokes: 60, points: 2500, strokePoints: 400 } as const

const count = (value: unknown, what: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new RangeError(`${what} must be a whole number above zero, got ${String(value)}`)
  return value
}

/** The rules with their defaults, checked: a rule that is no number of the kind is a bug of the game, not a move of a player */
function limitsOf(rules: DrawingRules) {
  return {
    colors: count(rules.colors, "The number of colours"),
    widths: count(rules.widths, "The number of widths"),
    strokes: count(rules.strokes ?? DRAWING_LIMITS.strokes, "The most strokes"),
    points: count(rules.points ?? DRAWING_LIMITS.points, "The most points"),
    strokePoints: count(rules.strokePoints ?? DRAWING_LIMITS.strokePoints, "The most points in a stroke"),
  }
}

/** A drawing with nothing drawn on it */
export const emptyDrawing = (): Drawing => []

/** How many points a drawing holds in all: what the limit of the whole drawing counts */
export const drawingPoints = (drawing: readonly Stroke[]): number => drawing.reduce((total, stroke) => total + stroke.points.length / 2, 0)

const refuse = (message: string): never => {
  throw new EngineError("INVALID_DRAWING", message)
}

/** An index of a list of `size`: a whole number from 0 to `size - 1` */
const paletteIndex = (value: unknown, size: number, what: string): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < size ? value : refuse(`${what} must be one of the ${size} there are`)

/**
 * The stroke a player drew, checked against the rules and given back as a new object with nothing but its three fields. Numbers that are not whole are rounded, as a board that works in pixels would send them, and a point that is twice in a row
 * is kept once. Throws `EngineError("INVALID_DRAWING")` for anything that is not a stroke: a colour or a width that is not one of the palette's, points that are not pairs of numbers on the grid, no points, or more than a stroke may have
 * (counted as they are sent, so that a request cannot make the engine walk a million points: a board takes its own repeats out before it sends them).
 */
export function cleanStroke(input: unknown, rules: DrawingRules): Stroke {
  const limits = limitsOf(rules)
  if (typeof input !== "object" || input === null || Array.isArray(input)) return refuse("A stroke was expected")
  const { color, width, points } = input as Record<string, unknown>
  const colour = paletteIndex(color, limits.colors, "The colour")
  const brush = paletteIndex(width, limits.widths, "The width")
  if (!Array.isArray(points) || points.length === 0 || points.length % 2 !== 0) return refuse("A stroke has points, two numbers each")
  if (points.length > limits.strokePoints * 2) return refuse("That stroke has too many points")
  const cleaned: number[] = []
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return refuse("A point is two numbers")
    if (x < -0.5 || y < -0.5 || x > DRAWING_GRID + 0.5 || y > DRAWING_GRID + 0.5) return refuse("A point lies outside the sheet")
    // Adding 0 turns a -0 into 0: the state never holds a negative zero
    const roundedX = Math.round(x) + 0
    const roundedY = Math.round(y) + 0
    if (cleaned.length >= 2 && cleaned[cleaned.length - 2] === roundedX && cleaned[cleaned.length - 1] === roundedY) continue
    cleaned.push(roundedX, roundedY)
  }
  return { color: colour, width: brush, points: cleaned }
}

/**
 * The drawing with the strokes of `input` added to it, as a new list (the drawing it is given is left alone). `input` is the list of strokes an action carries, at least one, each cleaned by `cleanStroke`. Throws `EngineError("INVALID_DRAWING")`
 * for what is not a list of strokes, and `EngineError("DRAWING_FULL")` when the strokes or the points would pass the limits: the sheet has no room left, which is no fault of the stroke.
 */
export function addStrokes(drawing: readonly Stroke[], input: unknown, rules: DrawingRules): Drawing {
  const limits = limitsOf(rules)
  if (!Array.isArray(input) || input.length === 0) return refuse("A list of strokes was expected")
  const added = input.map((stroke) => cleanStroke(stroke, rules))
  if (drawing.length + added.length > limits.strokes) throw new EngineError("DRAWING_FULL", "There is no room for more strokes")
  if (drawingPoints(drawing) + drawingPoints(added) > limits.points) throw new EngineError("DRAWING_FULL", "There is no room for more points")
  return [...drawing, ...added]
}

/** A whole drawing a player sends at once (a drawing handed in when they are done), checked as the strokes added to an empty sheet; an empty list is a drawing with nothing on it */
export function cleanDrawing(input: unknown, rules: DrawingRules): Drawing {
  if (!Array.isArray(input)) return refuse("A drawing was expected")
  limitsOf(rules)
  return input.length === 0 ? emptyDrawing() : addStrokes([], input, rules)
}

/** The drawing without its last stroke, as a new list: what undoing does. A drawing with nothing on it stays as it is */
export const undoStroke = (drawing: readonly Stroke[]): Drawing => drawing.slice(0, -1)
