"use client"

import { type CameraSettings, gridCells, Piece, Sheet } from "@pbgo/table"
import { SHEET } from "../defaults"
import { BONUS, BONUS_ROW, CATEGORIES, CATEGORY_OF, ROWS, scoreOf, TOTAL_ROW, totalOf, upperOf } from "../yahtzee"
import { pageFont } from "../color"
import { palette, tokenFace } from "./art"
import { Stage, TableLabel } from "./parts"

// The scorecard of Yahtzee on a table, with five dice to roll and keep. The card is a `Sheet`: its fifteen boxes are a column of cells (`gridCells`), what is printed beside them, the title and the names of the rows, is drawn by `printed`, and the boxes
// that can be chosen are ringed, with what each would score in faint ink. The dice are tokens, pressed to keep. The scene holds nothing: it shows what it is given and says what was pressed.

const CAMERA: CameraSettings = { tilt: 30, yaw: 0, distance: 12.2, fov: 34, targetX: -0.2, targetZ: 0 }
/** The boxes of the card: one for each row, in a column to the right of the names. */
export const CELLS = gridCells({ columns: 1, rows: ROWS, x: 0.68, y: 0.1, width: 0.28, height: 0.86, gapY: 0.004 })
/** Where the column of dice stands, and how far apart they are. */
const DICE = { x: 2.3, z: -2.3, gap: 1.15 }

export type SheetSceneProps = {
  /** What the five dice show, and whether they were rolled at all */
  dice: readonly number[]
  rolled: boolean
  /** Which dice are kept */
  held: readonly boolean[]
  /** What each category of the card holds, or null */
  scores: readonly (number | null)[]
  /** The rows that can be chosen now */
  rows: readonly number[]
  onRow: (row: number) => void
  onDie: (die: number) => void
}

export function SheetScene({ dice, rolled, held, scores, rows, onRow, onDie }: SheetSceneProps) {
  const colors = palette()
  const font = pageFont()
  const { sum, bonus } = upperOf(scores)
  const total = totalOf(scores)
  return (
    <Stage id="scene-sheet" camera={CAMERA} playIntro={false}>
      <Sheet
        at={SHEET.at}
        width={SHEET.width}
        height={SHEET.height}
        cells={CELLS}
        font={font}
        paper={colors.ivory}
        ink={colors.ink}
        accent={colors.marks[2]}
        printed={(g, { width, height }) => {
          g.fillStyle = colors.ink
          g.textBaseline = "middle"
          g.textAlign = "left"
          g.font = `900 ${height * 0.056}px ${font}`
          g.fillText("YAHTZEE", width * 0.06, height * 0.05)
          g.font = `700 ${height * 0.031}px ${font}`
          CELLS.forEach((cell, row) => {
            const category = CATEGORY_OF[row]
            const name = category === null || category === undefined ? (row === BONUS_ROW ? `Bonus: ${BONUS.needs} makes ${BONUS.worth}` : "Total") : CATEGORIES[category]!
            g.fillText(name, width * 0.06, (cell.y + cell.height / 2) * height + height * 0.002)
          })
        }}
        look={(row) => {
          if (row === BONUS_ROW) return { text: bonus > 0 ? String(bonus) : `${sum}/${BONUS.needs}`, faint: bonus === 0 }
          if (row === TOTAL_ROW) return { text: String(total), fill: colors.marks[2] }
          const category = CATEGORY_OF[row]!
          const score = scores[category]
          if (score !== null && score !== undefined) return { text: String(score) }
          // A box that can be chosen suggests what it would score
          return rows.includes(row) ? { text: String(scoreOf(category, dice)), faint: true } : {}
        }}
        halo={rows}
        onCell={onRow}
      />
      <TableLabel text="Dice" x={DICE.x} z={DICE.z - 1.05} height={0.45} tone="muted" />
      {dice.map((value, die) => (
        <Piece
          key={die}
          model="hex"
          size={0.95}
          color={colors.ivory}
          faces={rolled ? { top: tokenFace(value, colors.ivory) } : undefined}
          at={{ x: DICE.x, z: DICE.z + die * DICE.gap }}
          lift={held[die] ? 0.22 : 0}
          halo={held[die] ? colors.text : null}
          onClick={(event) => {
            event.stopPropagation()
            onDie(die)
          }}
        />
      ))}
      <TableLabel text="Press a die to keep it" x={DICE.x} z={DICE.z + 5 * DICE.gap - 0.2} height={0.36} tone="muted" />
    </Stage>
  )
}
