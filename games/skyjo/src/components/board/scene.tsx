"use client"

import type { Face, PlayerView, PublicCell, PublicSeat } from "@skyjo/engine"
import { useGame } from "@pbgo/core/components/game/context"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { shortName } from "@pbgo/core/lib/short-name"
import { FloorButton, grainTexture, onTable, Pile, PlayerSeat, type Pose, Table, TableText, useSettings, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { AdditiveBlending } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { FLOOR_TONES } from "../../lib/floor-tones"
import { fill, type Vocabulary } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { GLOWS } from "./glows"
import { cellPlace, cellPose, cellZone, fitPrompt, floorPlan, type Grid, grids, LAYOUT_FIELDS, LAYOUT_SETTINGS, pilePlaces, plateAt, seatSpots } from "./layout"
import { cardKey, cellKey, type Entrance, HELD_KEY, type Origin, PACE_FIELDS, PACE_SETTINGS } from "./pacing"
import { CARD_SIZE, matTexture, useFaces } from "./textures"
import { useViewport } from "./viewport"

/** The pool of light of the mat: how far across it spreads, in world units. Past it the table is the plain colour it fades into. */
const MAT_SIZE = 44

/** How many world units one repeat of the table's grain covers */
const GRAIN_TILE = 2

/** The most cards under the top of the discard that are drawn: a deeper pile looks no different */
const DISCARD_DEPTH = 8

/** The felt of the table: a grain painted in code (`grainTexture` of the kit, a 256-pixel tile) in the edge colour of the table, strong enough to be seen up close and quiet from the camera's distance, so that cards and plates keep their contrast */
function useGrain(base: string) {
  const grain = useMemo(() => grainTexture({ base, strength: 0.3 }), [base])
  useEffect(() => () => grain.dispose(), [grain])
  return grain
}

/** The pool of light the cards lie on: `surface` of the game's settings in the middle, falling away to `surfaceDark`, which is the colour of the endless table around it. It is added to the felt (additive blending), not laid over it, so the grain shows through it and it has no edge. */
function Mat({ inner, outer }: { inner: string; outer: string }) {
  const map = useMemo(() => matTexture(inner, outer), [inner, outer])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={-1} raycast={() => null}>
      <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
      <meshBasicMaterial map={map} blending={AdditiveBlending} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

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
  /** The cards of the columns the last move threw away: they lie on the discard until it has played out */
  columns: readonly Face[]
  /** The last move is still playing out: the seats say what the table said before it, until it has */
  busy: boolean
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`), and the cards of the deal wait with it */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

/** The word under a player's name while the round is on: they ended it (every card face up) or have one last turn to play. Nobody has one before somebody ends the round. */
const lastTurnOf = (lastTurn: PublicSeat["lastTurn"], words: Vocabulary) => (lastTurn === "ender" ? words.ended : lastTurn === "pending" ? words.lastTurn : undefined)

/** A sentence written flat on the table, in the room above the piles: broken into lines that fit it, the lines centred in the room */
function Prompt({ text, plan, color }: { text: string; plan: { x: number; z: number; width: number; depth: number }; color: string }) {
  const { lines, height, step } = fitPrompt(text, plan.width, plan.depth)
  return (
    <>
      {lines.map((line, i) => (
        <TableText key={i} text={line} style={{ color, weight: 800, shadow: "rgba(0,0,0,0.6)|10|3" }} height={height} position={[plan.x, 0.02, plan.z + (i - (lines.length - 1) / 2) * step]} />
      ))}
    </>
  )
}

/** The instruction of the moment, for the viewer or for somebody looking on, in the game's words */
function promptOf(view: PlayerView, words: Vocabulary, name: (id: string) => string): string | null {
  const { phase, me } = view
  const mine = view.players.find((player) => player.id === me)
  switch (phase.kind) {
    case "reveal":
      return mine && phase.waiting.includes(mine.id) ? words.promptReveal : words.promptRevealWait
    case "choose":
      return phase.player === me ? words.promptChoose : fill(words.promptWait, { player: name(phase.player) })
    case "place":
      return phase.player === me ? (phase.from === "deck" ? words.promptPlaceDrawn : words.promptPlaceTaken) : fill(words.promptWait, { player: name(phase.player) })
    case "flip":
      return phase.player === me ? words.promptFlip : fill(words.promptWait, { player: name(phase.player) })
    case "between":
      return phase.dealer === me ? words.promptDeal : fill(words.promptBetween, { player: name(phase.dealer) })
    case "over":
      return null
  }
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

function World({ view, catalog, pointsText, onReveal, onTake, onDraw, onPlace, onThrow, onFlip, onDeal, entrances, columns, busy, held }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout and of its pace
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  const { theme } = useSiteSettings()
  const faces = useFaces(catalog)
  const { words } = catalog
  const { nickname } = useGame()
  const meId = view.me
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const spots = useMemo(() => seatSpots(ids, meId), [key, meId])
  const placed = useMemo(() => grids(spots, meId), [spots, meId])
  const R = LAYOUT_SETTINGS
  const { deck, held: handAt, discard } = pilePlaces()
  const plan = floorPlan()
  const phase = view.phase
  const viewerChooses = phase.kind === "choose" && phase.player === meId
  const viewerThrows = phase.kind === "place" && phase.player === meId && phase.from === "deck"
  const dealing = phase.kind === "between" && phase.dealer === meId
  const presses = useMemo(() => pressable(view), [view])
  const pressCell = phase.kind === "reveal" ? onReveal : phase.kind === "place" ? onPlace : onFlip
  const prompt = promptOf(view, words, (id) => shortName(nickname(id)))

  // What a seat says, the total and the word under the name, is what the table said before the last move until the move has played out: a total does not change before the count has landed
  const now = useMemo(() => new Map(view.players.map((player) => [player.id, { lastTurn: player.lastTurn, total: player.total, rounds: view.rounds.length }])), [view.players, view.rounds.length])
  const [settled, setSettled] = useState(now)
  if (!busy && settled !== now) setSettled(now)
  const said = busy ? settled : now

  // The top two cards of the discard keep their place: the one that was on top stays face up under the one that comes, so that the pile never shows a back where a card lay a moment ago
  const top = view.discard.top
  const [pair, setPair] = useState<{ top: Face | null; under: Face | null }>({ top, under: null })
  if (pair.top?.id !== top?.id) setPair({ top, under: pair.top })
  const under = pair.under

  /** A pose on the table: where a card flies in from */
  const poseOf = (origin: Origin, delay: number): Pose => {
    const withDelay = (pose: Pose): Pose => ({ ...pose, delay })
    switch (origin.kind) {
      case "deck":
        return withDelay(onTable(deck.x, deck.z, { y: 1.4, face: "down", scale: R.pileScale }))
      case "discard":
        return withDelay(onTable(discard.x, discard.z, { y: 0.4, face: "up", scale: R.pileScale }))
      case "held":
        return withDelay(onTable(handAt.x, handAt.z, { y: 0.8, face: "up", scale: R.heldScale }))
      case "cell": {
        const grid = placed.get(origin.player)
        if (!grid) return withDelay(onTable(deck.x, deck.z, { y: 1.4, face: "down", scale: R.pileScale }))
        const cell = cellPlace(grid, origin.position)
        return withDelay(onTable(cell.x, cell.z, { y: 0.3, face: origin.up ? "up" : "down", yaw: grid.yaw, scale: grid.scale }))
      }
    }
  }
  const fromOf = (entranceKey: string): Pose | null => {
    if (held) return null
    const entrance = entrances.get(entranceKey)
    return entrance ? poseOf(entrance.origin, entrance.delay) : null
  }

  const cardOf = (cell: Exclude<PublicCell, null>, player: string, position: number): ZoneCard =>
    cell.up
      ? { key: `c-${cell.card.id}`, id: cell.card.id, front: faces.face(cell.card.type), back: faces.back, from: fromOf(cellKey(player, position)) }
      : { key: `h-${player}-${position}`, front: faces.back, back: faces.back, from: fromOf(cellKey(player, position)) }

  // The card in hand: seen by the viewer when it came from the pile, by everybody when it came from the discard, a back for the others
  const inHand = phase.kind === "place" ? phase : null
  const handFace = inHand?.card ? faces.face(inHand.card.type) : faces.back
  const handCard: ZoneCard[] = inHand
    ? [{ key: HELD_KEY, id: inHand.card?.id, front: handFace, back: faces.back, glow: inHand.player === meId ? GLOWS.hand : null, from: fromOf(HELD_KEY) }]
    : []

  // The discard: a few cards of depth as backs, the card that was on top, the cards of the column that was just thrown (until the move has played out) and the top card
  const depth = Math.max(0, Math.min(view.discard.size - (top ? 1 : 0) - (under ? 1 : 0), DISCARD_DEPTH))
  const thrown = busy ? columns.filter((card) => card.id !== top?.id) : []
  const discardCards: ZoneCard[] = [
    ...Array.from({ length: depth }, (_, i): ZoneCard => ({ key: `under-${i}`, front: faces.back, back: faces.back })),
    ...(under && under.id !== top?.id ? [under] : []).map((card): ZoneCard => ({ key: `c-${card.id}`, id: card.id, front: faces.face(card.type), back: faces.back })),
    ...thrown.map((card): ZoneCard => ({ key: `c-${card.id}`, id: card.id, front: faces.face(card.type), back: faces.back, from: fromOf(cardKey(card.id)) })),
    ...(top
      ? [
          {
            key: `c-${top.id}`,
            id: top.id,
            front: faces.face(top.type),
            back: faces.back,
            from: fromOf(cardKey(top.id)),
            glow: viewerChooses ? GLOWS.pile : null,
            gloss: viewerChooses,
            onClick: viewerChooses
              ? (event: { stopPropagation: () => void }) => {
                  event.stopPropagation()
                  onTake()
                }
              : undefined,
          } satisfies ZoneCard,
        ]
      : []),
  ]
  const discardPoses: Pose[] = discardCards.map((_, i) => onTable(0, 0, { y: 0.03 + 0.02 * i, face: i < depth ? "down" : "up", lean: `discard-${i}`, scale: R.pileScale }))

  return (
    <>
      {view.players.map((player) => {
        const grid = placed.get(player.id) as Grid
        const spot = spots.get(player.id)!
        const plate = plateAt(spot, grid)
        const seat = said.get(player.id) ?? now.get(player.id)!
        const viewer = player.id === meId
        const mine = view.players.findIndex((p) => p.id === player.id)
        const roundOver = phase.kind === "between" || phase.kind === "over"
        const roundScore = view.rounds.at(-1)?.[mine]
        // the points of the round just counted, doubled when the count is not what the cards show (the ender's penalty)
        const doubled = roundScore !== undefined && roundScore !== player.score
        const status = roundOver && roundScore !== undefined ? fill(doubled ? words.roundPointsDoubled : words.roundPoints, { points: roundScore }) : lastTurnOf(seat.lastTurn, words)
        const cells = player.cells.flatMap((cell, position) => (cell === null ? [] : [{ cell, position }]))
        return (
          <group key={player.id}>
            {/* The plate stands beyond its grid, turned the way its text reads (never upside down): the seat is drawn in its own frame, with its centre at the plate's */}
            <group position={[plate.x, 0, plate.z]} rotation-y={plate.yaw}>
              <PlayerSeat id={player.id} spot={{ x: 0, z: 0, yaw: 0 }} viewer={false} line={pointsText(seat.total)} status={status} />
            </group>
            {/* What lies in front of the player: twelve cells of three rows by four columns, face down until turned, a hole where a column was thrown away; the grid turns to face its player (`faceSeat`) */}
            <Zone
              frame={{ x: grid.at.x, z: grid.at.z, yaw: grid.yaw }}
              layout={cells.map(({ cell, position }) => cellPose(position, cell.up, grid.scale))}
              size={CARD_SIZE}
              cards={cells.map(({ cell, position }) => cardOf(cell, player.id, position))}
            />
            {/* The cells of the viewer's grid they can press: a floor zone each, the card plus the room around it, drawn only while there is a card to choose */}
            {viewer &&
              [...presses].map((position) => {
                const zone = cellZone(grid, position)
                return (
                  <FloorButton
                    key={position}
                    at={{ x: zone.x, z: zone.z, yaw: zone.yaw }}
                    width={zone.halfWidth * 2}
                    depth={zone.halfDepth * 2}
                    tone={FLOOR_TONES.cell}
                    tint={0.22}
                    ariaLabel={fill(words.cell, { column: Math.floor(position / 3) + 1, row: (position % 3) + 1 })}
                    onPress={() => pressCell(position)}
                  />
                )
              })}
          </group>
        )
      })}

      {/* The draw pile: pressing its top card draws, on the viewer's choice. Only its size is known, so it is a count. Its top card is turned up with the back for its picture: the halo, the outline and the shine of a card lie on the side of its face, and a card lying face down shows none of them */}
      <Pile
        frame={{ x: deck.x, z: deck.z }}
        count={view.deck.size}
        size={CARD_SIZE}
        back={faces.back}
        scale={R.pileScale}
        limit={14}
        top={{
          front: faces.back,
          glow: viewerChooses ? GLOWS.pile : null,
          gloss: viewerChooses,
          onClick: viewerChooses
            ? (event) => {
                event.stopPropagation()
                onDraw()
              }
            : undefined,
          // the number of cards left, written on the back of the top card: a stack that is only a count has no other place for it that the stack does not hide from the camera
          children: (
            <group rotation-x={Math.PI / 2} position={[0, 0, 0.02]}>
              <TableText text={String(view.deck.size)} style={{ color: theme.foreground, outline: theme.surfaceDark, weight: 900 }} height={0.62} position={[0, 0, 0]} />
            </group>
          ),
        }}
      />

      {/* The discard: the card on top is the one that can be taken */}
      <Zone frame={{ x: discard.x, z: discard.z }} layout={discardPoses} size={CARD_SIZE} cards={discardCards} />

      {/* The card in hand, between the piles: face up for the player who drew it (and for everybody when it came from the discard), face down for the others */}
      <Zone frame={{ x: handAt.x, z: handAt.z }} layout={[onTable(0, 0, { y: 0.2, face: inHand?.card ? "up" : "down", scale: R.heldScale })]} size={CARD_SIZE} cards={handCard} />

      {/* The instruction of the moment, written flat on the table above the piles */}
      {prompt && !held && <Prompt text={prompt} plan={plan.prompt} color={theme.accent} />}

      {/* The viewer's choice: Draw under the pile, Take under the discard; after a draw, Throw away under the discard. The cells of the grid are the other half of the choice */}
      {viewerChooses && (
        <>
          <FloorButton at={plan.draw} width={plan.draw.width} depth={plan.draw.depth} tone={FLOOR_TONES.draw} label={words.draw} onPress={onDraw} />
          <FloorButton at={plan.take} width={plan.take.width} depth={plan.take.depth} tone={FLOOR_TONES.take} label={words.takeDiscard} onPress={onTake} />
        </>
      )}
      {viewerThrows && <FloorButton at={plan.throwAway} width={plan.throwAway.width} depth={plan.throwAway.depth} tone={FLOOR_TONES.throwAway} label={words.throwAway} onPress={onThrow} />}

      {/* Between two rounds the dealer deals the next one, from one pad across the room of the two */}
      {dealing && <FloorButton at={plan.deal} width={plan.deal.width} depth={plan.deal.depth} tone={FLOOR_TONES.deal} label={words.deal} onPress={onDeal} />}
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
  // The endless table beyond the mat is the same felt, in the edge colour, and fades into it with distance
  const felt = useGrain(theme.surfaceDark)
  return (
    <Table camera={camera} photo={PHOTO} surface={{ color: theme.surfaceDark, map: felt, tile: GRAIN_TILE }} held={props.held} onLoaded={props.onLoaded}>
      <Mat inner={theme.surface} outer={theme.surfaceDark} />
      <World {...props} />
    </Table>
  )
}

