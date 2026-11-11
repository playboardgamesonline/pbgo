/**
 * The cells of a sheet of paper: the boxes that a player marks or fills (the categories of a scorecard, the houses of Welcome To). A cell is a rectangle on the sheet, as parts of the sheet from 0 to 1 across and down, the origin at its top left,
 * the same places as the points of a `Sketch`. The number of a cell is its place in the list, and a state keeps what is in each cell by that number.
 */
export type SheetCell = {
  /** The left edge of the cell, as a part of the width of the sheet, and its top edge, as a part of its height */
  x: number
  y: number
  /** How wide and how tall it is, in the same parts */
  width: number
  height: number
}

/** The rectangle a grid fills and how it is cut: by default the whole sheet, with no room between the cells */
export type GridOptions = {
  columns: number
  rows: number
  /** Where the grid starts, and how wide and tall it is, as parts of the sheet (default the whole sheet) */
  x?: number
  y?: number
  width?: number
  height?: number
  /** The room between two columns, as a part of the width of the grid, and between two rows, as a part of its height (default none) */
  gapX?: number
  gapY?: number
}

const whole = (value: number, what: string): number => {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`A grid has a whole number of ${what}, one at the least, got ${String(value)}`)
  return value
}

/**
 * The cells of a grid, row by row from the top left: `columns` across and `rows` down, in the rectangle of the grid, so that the cell at column `col` and row `row` is `row * columns + col`, the numbering of a board. A column of scores is a grid of one
 * column. Throws a `RangeError` for a number of columns or rows that is not a whole number above zero, and for a rectangle or a gap that leaves a cell no room.
 */
export function gridCells({ columns, rows, x = 0, y = 0, width = 1, height = 1, gapX = 0, gapY = 0 }: GridOptions): SheetCell[] {
  whole(columns, "columns")
  whole(rows, "rows")
  if (!(width > 0) || !(height > 0)) throw new RangeError(`A grid has a width and a height above zero, got ${String(width)} by ${String(height)}`)
  if (!(gapX >= 0) || !(gapY >= 0)) throw new RangeError(`The room between the cells of a grid is none or more, got ${String(gapX)} and ${String(gapY)}`)
  const cellWidth = (width - gapX * (columns - 1)) / columns
  const cellHeight = (height - gapY * (rows - 1)) / rows
  if (!(cellWidth > 0) || !(cellHeight > 0)) throw new RangeError("The room between the cells of a grid leaves them none")
  return Array.from({ length: columns * rows }, (_, i) => ({ x: x + (i % columns) * (cellWidth + gapX), y: y + Math.floor(i / columns) * (cellHeight + gapY), width: cellWidth, height: cellHeight }))
}

/** The number of the first cell that holds a place on the sheet, `u` across and `v` down, from 0 to 1, or -1 when none does: a cell holds its edges */
export function cellAt(cells: readonly SheetCell[], u: number, v: number): number {
  return cells.findIndex((cell) => u >= cell.x && u <= cell.x + cell.width && v >= cell.y && v <= cell.y + cell.height)
}
