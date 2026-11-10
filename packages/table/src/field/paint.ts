import type { Box, SheetLayout } from "./layout"

/** Pixels the canvas of a sheet has for each world unit: a line of writing is read at the size a card's text is, so this is sharp without being heavy */
export const PX_PER_UNIT = 200

/** What a sheet is dressed in */
export type SheetStyle = {
  paper: string
  ink: string
  /** The colour of the edge while the player is writing */
  accent: string
  /** The CSS font of the letters */
  font: string
  weight: number
}

/** What a sheet looks like at the moment */
export type SheetLook = {
  /** The player is writing on it: its edge takes the accent colour */
  focused: boolean
  /** Nobody can write on it: its ink is dimmed */
  disabled: boolean
  /** What is drawn is the sentence that says what to write, not a text: it is drawn in faint ink */
  faint: boolean
}

/** The margin all round a sheet, and the room the writing has inside it: the lines are laid out in `inner` */
export function innerBox(box: Box): { pad: number; inner: Box } {
  const pad = Math.round((box.height / box.lines) * 0.16)
  return { pad, inner: { width: box.width - 2 * pad, height: box.height - 2 * pad, lines: box.lines } }
}

/** Where the baseline of the letters of a line is, in pixels from the top of the canvas */
export const baselineOf = (row: number, pad: number, pitch: number) => pad + row * pitch + pitch * 0.74

/**
 * Paints a sheet: the paper with its rounded corners and its edge, a faint rule under each line, and the rows of the layout in the ink. The paper has no light of its own; the table lights nothing.
 * `layout` is the one `layoutSheet` made for the room `innerBox` leaves.
 */
export function paintSheet(g: CanvasRenderingContext2D, box: Box, layout: SheetLayout, style: SheetStyle, look: SheetLook): void {
  const { pad } = innerBox(box)
  g.clearRect(0, 0, box.width, box.height)

  g.beginPath()
  g.roundRect(0, 0, box.width, box.height, Math.min(box.width, box.height) * 0.09)
  g.fillStyle = style.paper
  g.fill()
  g.lineWidth = look.focused ? 6 : 3
  g.strokeStyle = look.focused ? style.accent : "rgba(0, 0, 0, 0.16)"
  g.stroke()

  g.fillStyle = style.ink
  g.globalAlpha = 0.14
  for (let row = 0; row < box.lines; row++) g.fillRect(pad, baselineOf(row, pad, layout.pitch) + layout.pitch * 0.12, box.width - 2 * pad, 2)

  g.save()
  g.beginPath()
  g.rect(pad, 0, box.width - 2 * pad, box.height)
  g.clip()
  g.globalAlpha = look.disabled ? 0.5 : look.faint ? 0.4 : 1
  g.fillStyle = style.ink
  g.font = `${style.weight} ${layout.size}px ${style.font}`
  g.textAlign = "left"
  g.textBaseline = "alphabetic"
  layout.rows.forEach((row, i) => g.fillText(row.text, pad, baselineOf(i, pad, layout.pitch)))
  g.restore()
  g.globalAlpha = 1
}
