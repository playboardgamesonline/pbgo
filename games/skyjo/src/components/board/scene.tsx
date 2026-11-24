"use client"

import type { CardFace, PlayerView, PublicCell, PublicSeat } from "@skyjo/engine"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { ActionLabel, cardRise, effectiveState, FloorButton, NO_TOUCH, Pile, pileAboveAt, pileFootprint, PlayerSeat, type Pose, type Spot, Table, type Touch, useSequence, useSettings, useViewport, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useMemo, useState } from "react"
import type { ClientCatalog } from "../../lib/catalog"
import { fill, type Vocabulary } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { type Landing, removalSequence, type RemovalState, restoredCells, type Stage, shownColumns } from "./columns"
import { cardScaleOf, cellOrigin, cellPose, chairsOf, discardPose, flightFrom, floorPlan, heldPose, LAYOUT_FIELDS, LAYOUT_SETTINGS, landingOn, pilePlaces, plateSettings, seatsOf } from "./layout"
import { cardKey, cellKey, type Entrance, HELD_KEY, type Origin, PACE_FIELDS, PACE_SETTINGS, type Removal } from "./pacing"
import { ThrownColumn } from "./thrown-column"
import { CARD_SIZE, matOf, useFaces } from "./textures"

/** The most cards under the top of the discard that are drawn: a deeper pile looks no different */
const DISCARD_DEPTH = 8

export type SceneProps = {
  view: PlayerView
  /** The pictures of the cards and the words of the board, from Sanity */
  catalog: ClientCatalog
  /** A player's total as the line under their name, in the visitor's language (`pointsShort` of the skin) */
  pointsText: (points: number) => string
  /** The viewer turns a card of their grid over to open the round */
  onReveal: (position: number) => void
  /** The viewer takes the top of the discard */
  onTake: () => void
  /** The viewer draws the top of the pile */
  onDraw: () => void
  /** The viewer puts the card in hand in this cell of their grid */
  onPlace: (position: number) => void
  /** The viewer throws the card they drew away */
  onThrow: () => void
  /** The viewer turns this card of their grid over, after throwing the drawn card away */
  onFlip: (position: number) => void
  /** The viewer, the dealer, deals the next round */
  onDeal: () => void
  /** Where what the last move brought comes from, and the seconds it waits before it sets out (`timelineOf`) */
  entrances: ReadonlyMap<string, Entrance>
  /** The columns the last move threw away, in the order they go and when each begins (`timelineOf`): each lies where it did until its turn, then the three cards slide together into a stack, the stack flies to the discard, and the columns left close the gap */
  removals: readonly Removal[]
  /** The card that a placement put on the discard in the move that threw a column away: the stack lands on it */
  replaced: CardFace | null
  /** The version of the table that the last move gave (`Timeline.v`): a move that throws columns away has its own film */
  v: number
  /** The visitor asks for less motion: what moves is where it ends at once */
  reduced: boolean
  /** The last move is still playing out: the seats say what the table said before it, until it has */
  busy: boolean
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`), and the cards of the deal wait with it */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

/** The word under a player's name while the round is on: they ended it (every card face up) or have one last turn to play. Nobody has one before somebody ends the round. */
const lastTurnOf = (lastTurn: PublicSeat["lastTurn"], words: Vocabulary) => (lastTurn === "ender" ? words.ended : lastTurn === "pending" ? words.lastTurn : undefined)

/** What pressing the top card of the discard does when it can be pressed: the word over it, which says it, and the press */
type DiscardAction = { label: string; onPress: () => void }

/**
 * The discard: a zone whose top card can be pressed on the viewer's choice, to take it, or to throw the card they drew onto it, and the word over it that says which. The card is `interactive` while it can be pressed and the word is drawn with it; the two light each
 * other, as the pile's word and top card do (`Pile`): the word is lit by what the pointer does to the card (`touch`) and the card by what it does to the word (`onTouch`).
 */
function Discard({ frame, layout, cards, action }: { frame: Spot; layout: Pose[]; cards: ZoneCard[]; action: DiscardAction | null }) {
  const [touch, setTouch] = useState<Touch>(NO_TOUCH)
  const [over, setOver] = useState(false)
  // A card that goes, or a word that goes, takes the pointer with it: the pair starts again from nothing, so that a card that comes under a pointer that has not moved is not lit
  const topKey = cards.at(-1)?.key
  const [seen, setSeen] = useState({ topKey, acting: action !== null })
  if (seen.topKey !== topKey || seen.acting !== (action !== null)) {
    setSeen({ topKey, acting: action !== null })
    setOver(false)
  }
  const last = cards.length - 1
  const lit = action ? cards.map((card, i): ZoneCard => (i === last ? { ...card, state: effectiveState("interactive", touch), onPress: action.onPress, ariaLabel: action.label, onHover: setOver } : card)) : cards
  const topPose = layout[last]
  return (
    <>
      <Zone frame={frame} layout={layout} size={CARD_SIZE} cards={lit} />
      {action && topPose && (
        <ActionLabel
          at={pileAboveAt(frame, topPose.position.y)}
          over={pileFootprint(frame, CARD_SIZE, topPose.scale)}
          label={action.label}
          onPress={action.onPress}
          touch={{ ...NO_TOUCH, hovered: over }}
          onTouch={setTouch}
          rise={cardRise(CARD_SIZE, topPose.scale)}
        />
      )}
    </>
  )
}

/** The cells of a seat the viewer may press right now, by position: the face-down ones while the round opens (two of them) or after a throw-away, any card while holding one */
function pressable(view: PlayerView): ReadonlySet<number> {
  const { phase, me } = view
  const mine = view.players.find((player) => player.id === me)
  const none = new Set<number>()
  if (!mine) return none
  const cells = mine.cells.flatMap((cell, position) => (cell === null ? [] : [{ cell, position }]))
  if (phase.kind === "reveal" && phase.waiting.includes(mine.id)) return new Set(cells.filter(({ cell }) => !cell.up).map(({ position }) => position))
  if (phase.kind === "flip" && phase.player === me) return new Set(cells.filter(({ cell }) => !cell.up).map(({ position }) => position))
  if (phase.kind === "place" && phase.player === me) return new Set(cells.map(({ position }) => position))
  return none
}

/** How long a card takes to settle on a new slot when the visitor asks for less motion: no time at all, it is there */
const SNAP = 0.001

function World({ view, catalog, pointsText, onReveal, onTake, onDraw, onPlace, onThrow, onFlip, onDeal, entrances, removals, replaced, v, reduced, busy, held }: SceneProps) {
  // The table's own folders (camera, cards, seats, lights...) are made by the shared `Table`; the game binds the knobs of its layout and of its pace
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  const faces = useFaces(catalog)
  const { words } = catalog
  const meId = view.me
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const laid = useMemo(() => seatsOf(ids, meId), [key, meId])
  // the chairs of the table, and the size every card on it has, the viewer's grid and the piles too: the middle of the table is laid out for it
  const chairs = chairsOf(view.players.length, meId !== null)
  const scale = cardScaleOf(chairs)
  const { deck, held: handAt, discard } = pilePlaces()
  const plan = floorPlan(chairs)
  const phase = view.phase
  const viewerChooses = phase.kind === "choose" && phase.player === meId
  const viewerThrows = phase.kind === "place" && phase.player === meId && phase.from === "deck"
  const dealing = phase.kind === "between" && phase.dealer === meId
  const presses = useMemo(() => pressable(view), [view])
  const pressCell = phase.kind === "reveal" ? onReveal : phase.kind === "place" ? onPlace : onFlip

  // What a seat says, the total and the word under the name, is what the table said before the last move until the move has played out: a total does not change before the count has landed
  const now = useMemo(() => new Map(view.players.map((player) => [player.id, { lastTurn: player.lastTurn, total: player.total, rounds: view.rounds.length }])), [view.players, view.rounds.length])
  const [settled, setSettled] = useState(now)
  if (!busy && settled !== now) setSettled(now)
  const said = busy ? settled : now

  // The columns the last move threw away go one after the other, each in its turn (`removalSequence`): until then it lies where it did, then the three cards slide together into a stack, the stack flies to the discard and lands on it, and the columns left slide together to
  // close the gap. The view already has the move done, so this is what the board holds back: a table that is opened or reloaded has no removals to play and draws the grids as they are, closed. A move that has come has not begun when it is drawn the first time, whatever
  // the sequence says of the move before it
  const film = useMemo(() => removalSequence(v, removals), [v, removals])
  const sequence = useSequence<RemovalState>({ active: removals.length > 0, start: film.start, final: film.final, steps: film.steps, key: v })
  const progress = removals.length === 0 ? null : sequence.state?.v === v ? sequence.state : film.start
  const stageOf = (k: number): Stage => progress?.stages[k] ?? "landed"
  const closedOf = (k: number) => progress?.closed[k] ?? true
  const filming = progress !== null && progress.stages.some((stage) => stage !== "landed")

  // What each seat lays out: the columns it still has in the view and those whose removal has not closed yet (their room is kept, a column that waits has its cards in it), so that the grid is centred on what is there. The cells that lie in it: the view's, and the three
  // of every column that waits its turn, as they lay before the move
  const seatsGrid = new Map(
    view.players.map((player) => {
      const own = removals.flatMap((removal, k) => (removal.player === player.id ? [{ removal, k }] : []))
      const shown = shownColumns(player.cells, own.filter(({ k }) => !closedOf(k)).map(({ removal }) => removal.column))
      const present = player.cells.flatMap((cell, position) => (cell === null ? [] : [{ cell, position }]))
      const waiting = own.filter(({ k }) => stageOf(k) === "waiting").flatMap(({ removal }) => restoredCells(removal))
      return [player.id, { shown, cells: [...present, ...waiting].sort((a, b) => a.position - b.position) }] as const
    }),
  )

  // The top two cards of the discard keep their place: the one that was on top stays face up under the one that comes, so that the pile never shows a back where a card lay a moment ago
  const top = view.discard.top
  const [pair, setPair] = useState<{ top: CardFace | null; under: CardFace | null }>({ top, under: null })
  if (pair.top?.id !== top?.id) setPair({ top, under: pair.top })
  const under = pair.under

  /** A pose on the table: where a card flies in from */
  const poseOf = (origin: Origin, delay: number): Pose => {
    const withDelay = (pose: Pose): Pose => ({ ...pose, delay })
    switch (origin.kind) {
      case "deck":
      case "discard":
      case "held":
        return withDelay(flightFrom(origin.kind, chairs))
      case "cell": {
        const seat = laid.get(origin.player)
        if (!seat) return withDelay(flightFrom("deck", chairs))
        // where the cell lies in the grid as it is laid out now: a grid that lost a column is closed over it
        return withDelay(cellOrigin(seat, origin.position, origin.up, seatsGrid.get(origin.player)?.shown))
      }
    }
  }
  const fromOf = (entranceKey: string): Pose | null => {
    if (held) return null
    const entrance = entrances.get(entranceKey)
    return entrance ? poseOf(entrance.origin, entrance.delay) : null
  }

  // The cards of the viewer's grid they can press are `interactive`: the table lights them and lifts them under the pointer, and keeps a hidden button for each so that the keyboard reaches it. The others are as they lie. A visitor who asks for less motion has a card
  // that is laid out again, a grid that closes over a gap, there at once
  const cardOf = (cell: Exclude<PublicCell, null>, player: string, position: number): ZoneCard => {
    const chosen = player === meId && presses.has(position)
    const choice: Pick<ZoneCard, "state" | "onPress" | "ariaLabel" | "speed"> = chosen
      ? { state: "interactive", onPress: () => pressCell(position), ariaLabel: fill(words.cell, { column: Math.floor(position / 3) + 1, row: (position % 3) + 1 }) }
      : {}
    const settle = reduced ? { speed: SNAP } : {}
    return cell.up
      ? { key: `c-${cell.card.id}`, id: cell.card.id, front: faces.face(cell.card.type), back: faces.back, from: fromOf(cellKey(player, position)), ...settle, ...choice }
      : { key: `h-${player}-${position}`, front: faces.back, back: faces.back, from: fromOf(cellKey(player, position)), ...settle, ...choice }
  }

  // The card in hand: seen by the viewer when it came from the pile, by everybody when it came from the discard, a back for the others
  const inHand = phase.kind === "place" ? phase : null
  const handFace = inHand?.card ? faces.face(inHand.card.type) : faces.back
  const handCard: ZoneCard[] = inHand
    ? [{ key: HELD_KEY, id: inHand.card?.id, front: handFace, back: faces.back, state: inHand.player === meId ? "selected" : "base", from: fromOf(HELD_KEY) }]
    : []

  // The discard: a few cards of depth as backs, the card that was on top and the top card. While columns are on their way to it the top card of the view is not there yet (it is the first card of the last column, which has not landed): the pile shows the card that was on top,
  // the card a placement put on it, and the last column that has landed, which lies on them
  const depth = Math.max(0, Math.min(view.discard.size - (top ? 1 : 0) - (under ? 1 : 0), DISCARD_DEPTH))
  const faceUp = (card: CardFace, extra: Partial<ZoneCard> = {}): ZoneCard => ({ key: `c-${card.id}`, id: card.id, front: faces.face(card.type), back: faces.back, ...extra })
  const underCard = under && under.id !== top?.id ? [faceUp(under)] : []
  // what lies on the card that was on top while columns are on their way: the card a placement put there, and the last stack that landed, its first card (the top card of the view) on top; once they have all landed, the top card of the view alone
  const landedLast = filming ? removals.filter((_, k) => stageOf(k) === "landed").at(-1) : undefined
  const replacedCard = filming && replaced ? [faceUp(replaced, { from: fromOf(cardKey(replaced.id)) })] : []
  const landedStack = landedLast ? [...landedLast.cards].reverse().map((card) => faceUp(card)) : []
  const topCard = !filming && top ? [faceUp(top, { from: fromOf(cardKey(top.id)) })] : []
  const discardCards: ZoneCard[] = [...Array.from({ length: depth }, (_, i): ZoneCard => ({ key: `under-${i}`, front: faces.back, back: faces.back })), ...underCard, ...replacedCard, ...landedStack, ...topCard]
  const beneath = depth + underCard.length + replacedCard.length
  // What pressing the discard does: take its top card on the viewer's choice, or throw the card they drew onto it. A card taken from the discard cannot be thrown back: it must be placed
  const discardAction: DiscardAction | null = viewerChooses ? { label: words.takeDiscard, onPress: onTake } : viewerThrows ? { label: words.throwAway, onPress: onThrow } : null
  const discardPoses: Pose[] = discardCards.map((_, i) => discardPose(i, i >= depth, chairs))
  // where a stack lands: on the card that lies on top of the pile, which is the last stack that landed when there is one, at the height of the bottom card of the stack
  const landing: Landing = landingOn(0.03 + 0.02 * (beneath + landedStack.length), chairs)

  return (
    <>
      {view.players.map((player) => {
        const place = laid.get(player.id)!
        const seat = said.get(player.id) ?? now.get(player.id)!
        const mine = view.players.findIndex((p) => p.id === player.id)
        const roundOver = phase.kind === "between" || phase.kind === "over"
        const roundScore = view.rounds.at(-1)?.[mine]
        // the points of the round just counted, doubled when the count is not what the cards show (the ender's penalty)
        const doubled = roundScore !== undefined && roundScore !== player.score
        const status = roundOver && roundScore !== undefined ? fill(doubled ? words.roundPointsDoubled : words.roundPoints, { points: roundScore > 0 ? `+${roundScore}` : roundScore }) : lastTurnOf(seat.lastTurn, words)
        const { shown, cells } = seatsGrid.get(player.id)!
        return (
          <group key={player.id}>
            {/* The plate stands on the middle's side of the grid, in the frame of the seat, turned as the name is */}
            <PlayerSeat id={player.id} frame={place.frame} above={place.above} line={pointsText(seat.total)} status={status} settings={plateSettings()} />
            {/* What lies in front of the player: twelve cells of three rows by four columns, face down until turned, in the frame of the seat, so that the grid faces the middle as the name does. A column that was thrown away leaves no cell, and the grid is closed over it,
                centred on the axis of the seat: the columns slide together when the column has gone (`shown`). The cards of the opening deal are not on the table while the start screen is up: they mount, and are dealt round the table, when it goes (a card that is already
                there when its entrance is given does not fly) */}
            <Zone
              frame={place.frame}
              layout={cells.map(({ cell, position }) => cellPose(position, cell.up, place.scale, shown))}
              size={CARD_SIZE}
              cards={held ? [] : cells.map(({ cell, position }) => cardOf(cell, player.id, position))}
            />
          </group>
        )
      })}

      {/* The columns on their way: the three cards slide together into a stack where the column stood, and the stack flies to the discard */}
      {removals.map((removal, k) => {
        const stage = stageOf(k)
        const seat = laid.get(removal.player)
        if (!seat || (stage !== "gathering" && stage !== "travelling")) return null
        return (
          <ThrownColumn
            key={`${v}:${k}`}
            seat={seat}
            column={removal.column}
            shown={seatsGrid.get(removal.player)?.shown ?? []}
            landing={landing}
            cards={removal.cards.map((card) => ({ id: card.id, front: faces.face(card.type) }))}
            back={faces.back}
            travelling={stage === "travelling"}
            seconds={removal.timing.travel}
          />
        )
      })}

      {/* The draw pile: only its size is known, so it is a count, which it writes under itself. Its top card is pressed to draw, on the viewer's choice, and the word over it says so */}
      <Pile
        frame={{ x: deck.x, z: deck.z }}
        count={view.deck.size}
        size={CARD_SIZE}
        back={faces.back}
        scale={scale}
        limit={14}
        action={viewerChooses ? { label: words.draw, onPress: onDraw } : undefined}
      />

      {/* The discard: the card on top is pressed to take it, or to throw the card the viewer drew onto it, and the word over it says which */}
      <Discard frame={{ x: discard.x, z: discard.z }} layout={discardPoses} cards={discardCards} action={discardAction} />

      {/* The card in hand, between the piles: face up for the player who drew it (and for everybody when it came from the discard), face down for the others */}
      <Zone frame={{ x: handAt.x, z: handAt.z }} layout={[heldPose(!!inHand?.card, chairs)]} size={CARD_SIZE} cards={handCard} />

      {/* Between two rounds the dealer deals the next one: an action with no object on the table, so a button, over the piles */}
      {dealing && <FloorButton at={plan.deal} width={plan.deal.width} depth={plan.deal.depth} tone="primary" label={words.deal} onPress={onDeal} />}
    </>
  )
}

export function Scene(props: SceneProps) {
  const { theme } = useSiteSettings()
  const players = props.view.players.length
  // The camera stands where the whole table is in the window and clear of what the platform draws over it (`fitCamera`): a window that is dragged to another size does not fit the camera at every step, it waits. The Camera folder of the
  // debug panel edits this object: it is made again when the window or the number of players changes
  const viewport = useDeferredValue(useViewport())
  const seated = props.view.me !== null
  const camera = useMemo(() => cameraFor(players, viewport, seated), [players, viewport, seated])
  // The mat is data, from the colours of the game's settings: the table bakes the mosaic once and lights its middle
  const mat = useMemo(() => matOf({ surface: theme.surface, surfaceDark: theme.surfaceDark }), [theme.surface, theme.surfaceDark])
  return (
    <Table camera={camera} photo={PHOTO} surface={mat} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}

