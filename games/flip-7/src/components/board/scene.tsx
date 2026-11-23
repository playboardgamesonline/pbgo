"use client"

import type { CardFace, PlayerView, PublicSeat } from "@flip-7/engine"
import { useGame } from "@pbgo/core/components/game/context"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { FloorButton, onTable, Pile, pile, PlayerSeat, Table, TableText, useLettering, useSettings, useViewport, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useMemo, useState } from "react"
import type { ClientCatalog } from "../../lib/catalog"
import { FLOOR_TONES } from "../../lib/floor-tones"
import { madeFlip7 } from "../../lib/flip7-line"
import { fill, type Vocabulary } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { GLOWS } from "./glows"
import { dealtFrom, fitPrompt, floorPlan, heldPlace, heldPoses, LAYOUT_FIELDS, LAYOUT_SETTINGS, linePoses, lines, pilePlaces, plateAt, seatSpots, stickerPlaces, zones } from "./layout"
import { PACE_FIELDS, PACE_SETTINGS } from "./pacing"
import { Sticker } from "./stickers"
import { CARD_SIZE, useFaces } from "./textures"

/** How far the pool of light of the mat reaches, in world units: a little past the far seats of a table of eight. Past it the table is the plain colour it fades into */
const POOL_RADIUS = 22

export type SceneProps = {
  view: PlayerView
  /** The pictures of the cards, the names of the action cards and the words of the board, from Sanity */
  catalog: ClientCatalog
  /** A player's total as the line under their name, in the visitor's language (`pointsShort` of the skin) */
  pointsText: (points: number) => string
  /** The viewer turns the next card over (they pressed the draw pile) */
  onHit: () => void
  /** The viewer banks their line */
  onStay: () => void
  /** The viewer, the dealer, deals the next round */
  onDeal: () => void
  /** The viewer gives the action card they hold to this player */
  onTarget: (playerId: string) => void
  /** Seconds that each card turned over by the last move waits before it comes in from the draw pile, by id (`timelineOf`): the three cards of a Flip Three come one after the other */
  entrances: ReadonlyMap<number, number>
  /** The last move is still playing out: the seats say what the table said before it, until it has */
  busy: boolean
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`), and the cards of the opening deal wait with it */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

/** The word under a player's line when they are out of the round: bust, frozen or stayed. A player still in has none. */
const statusOf = (status: PublicSeat["status"], words: ClientCatalog["words"]) =>
  status === "busted" ? words.busted : status === "frozen" ? words.frozen : status === "stayed" ? words.stayed : undefined

/** What the holder of an action card is told, in the game's words: one sentence for each action card */
const promptOf = (type: string, words: Vocabulary) => (type === "freeze" ? words.targetFreeze : type === "flip-three" ? words.targetFlipThree : words.targetSecondChance)

/** A sentence written flat on the table, in the room beside the action card: broken into lines that fit it, the lines centred in the room */
function Prompt({ text, plan, color }: { text: string; plan: { x: number; z: number; width: number; depth: number }; color: string }) {
  const { body, weight } = useLettering()
  const { lines, height, step } = fitPrompt(text, plan.width, plan.depth)
  return (
    <>
      {lines.map((line, i) => (
        <TableText key={i} text={line} style={{ color, weight, shadow: "rgba(0,0,0,0.6)|10|3" }} height={height} position={[plan.x, 0.02, plan.z + (i - (lines.length - 1) / 2) * step]} font={body} />
      ))}
    </>
  )
}

function World({ view, catalog, pointsText, onHit, onStay, onDeal, onTarget, entrances, busy, held }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout and of its pace
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  const { theme } = useSiteSettings()
  // The lettering on the table is the kit's (`useLettering`): the fonts the game uploaded to its Sanity project, the display font for names, buttons and counts, the body font for the sentences, else the kit's own
  const lettering = useLettering()
  const faces = useFaces(catalog)
  const { words } = catalog
  const meId = view.me
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const spots = useMemo(() => seatSpots(ids, meId), [key, meId])
  const placed = useMemo(() => lines(spots, meId), [spots, meId])
  const pressZones = useMemo(() => zones(spots, placed, meId), [spots, placed, meId])
  const { nickname } = useGame()
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const phase = view.phase
  const myTurn = phase.kind === "turn" && phase.player === meId
  const choosing = phase.kind === "target" && phase.player === meId
  const dealing = phase.kind === "between" && phase.dealer === meId
  const dealt = dealtFrom()
  const plan = floorPlan()

  // What a seat says, the word under the name and the total, is what the table said before the last move until the move has played out: a player who busts with the third card of a Flip Three is not out before that card has landed
  const now = useMemo(() => new Map(view.players.map((player) => [player.id, { status: player.status, total: player.total }])), [view.players])
  const [settled, setSettled] = useState(now)
  if (!busy && settled !== now) setSettled(now)
  const said = busy ? settled : now

  // A card the last move turned over comes in from above the draw pile after the time the timeline gives it, so that they come one after the other. Every other card is where it was, or flies from where it lay: the table remembers
  // where a card with the same id was a moment ago. The cards of the opening deal wait for the start screen to go
  const cardsOf = (list: readonly CardFace[], out = false): ZoneCard[] =>
    (held ? [] : list).map((face) => {
      const delay = entrances.get(face.id)
      return { key: face.id, id: face.id, front: faces.face(face.type), back: faces.back, out, from: delay === undefined ? null : { ...dealt, delay } }
    })
  // The engine's discard is top first and a pile layout is bottom first
  const discarded = [...view.discard].reverse()

  return (
    <>
      {view.players.map((player) => {
        const line = placed.get(player.id)!
        const viewer = player.id === meId
        const pickable = choosing && phase.targets.includes(player.id)
        const heldAt = heldPlace(line, viewer)
        const seat = said.get(player.id) ?? now.get(player.id)!
        // A busted player can no longer play: all their cards go grey and dark until the next round (a frozen or a stayed one has banked their points and keeps the colour of their cards; the word under the name says which)
        const out = seat.status === "busted"
        const spot = spots.get(player.id)!
        const plate = plateAt(spot, line)
        // The BUST! stamp and the "+15 point bonus" badge lie on the table when the table says so, that is once the move has played out (`said`), and stay until the next round. A stamp is drawn only if the game document has its picture
        const { bust, bonus } = faces.stickers
        const places = stickerPlaces(line, bust?.aspect ?? 1.8, bonus?.aspect ?? 1.65)
        const bonusEarned = seat.status === "stayed" && madeFlip7(player.cards)
        return (
          <group key={player.id}>
            {/* The plate stands beyond its line, turned the way its text reads (never upside down): the seat is drawn in its own frame, with its centre at the plate's */}
            <group position={[plate.x, 0, plate.z]} rotation-y={plate.yaw}>
              <PlayerSeat
                id={player.id}
                spot={{ x: 0, z: 0, yaw: 0 }}
                viewer={false}
                line={pointsText(seat.total)}
                status={statusOf(seat.status, words)}
                font={lettering.display}
                nameStyle={{ weight: lettering.weight }}
                lineStyle={{ weight: lettering.weight }}
              />
            </group>
            {/* What lies in front of the player: every card is face up, and the line turns to face its player (`faceSeat`) */}
            <Zone frame={{ x: line.at.x, z: line.at.z, yaw: line.yaw }} layout={linePoses(player.cards.length, line)} size={CARD_SIZE} cards={cardsOf(player.cards, out)} />
            {/* The Freeze and Flip Three cards flipped during a Flip Three wait, face up, until its three cards are done */}
            <Zone frame={{ x: heldAt.x, z: heldAt.z, yaw: line.yaw }} layout={heldPoses(player.held.length, line)} size={CARD_SIZE} cards={cardsOf(player.held, out)} />
            {/* The sector of the table in front of the seat, a floor zone: pressed to give this player the card the viewer holds. It lies only while a target is to be chosen */}
            {pickable && (
              <FloorButton
                at={{ x: pressZones.get(player.id)!.x, z: pressZones.get(player.id)!.z, yaw: pressZones.get(player.id)!.yaw }}
                width={pressZones.get(player.id)!.halfWidth * 2}
                depth={pressZones.get(player.id)!.halfDepth * 2}
                tone={FLOOR_TONES.target}
                tint={0.3}
                hitY={0.35}
                ariaLabel={fill(words.targetPlayer, { target: nickname(player.id) })}
                onPress={() => onTarget(player.id)}
              />
            )}
            {!held && out && bust && <Sticker picture={bust} {...places.bust} />}
            {!held && bonusEarned && bonus && <Sticker picture={bonus} {...places.bonus} />}
          </group>
        )
      })}

      {/* The draw pile: pressing its top card turns the next card over, on the viewer's turn. Only its size is known, so it is a count, which the pile writes under itself. Its top card is turned up with the back for its picture: the halo, the outline and the shine of a
          card lie on the side of its face, and a card lying face down shows none of them */}
      <Pile
        frame={{ x: deck.x, z: deck.z }}
        count={view.deck.size}
        size={CARD_SIZE}
        back={faces.back}
        scale={R.pileScale}
        limit={14}
        top={{
          front: faces.back,
          glow: myTurn ? GLOWS.deck : null,
          gloss: myTurn,
          onClick: myTurn
            ? (event) => {
                event.stopPropagation()
                onHit()
              }
            : undefined,
        }}
      />

      {/* The discard: every card of it keeps its id, so the cards of a line fly there when the next round is dealt */}
      <Zone
        frame={{ x: discard.x, z: discard.z }}
        // the discard grows to most of the box: its cards are laid closer as it grows, so that it never stands taller than a thin stack
        layout={pile(discarded.length, { face: "up", lean: "discard", scale: R.pileScale, step: Math.min(0.02, 0.4 / Math.max(1, discarded.length)) })}
        size={CARD_SIZE}
        cards={cardsOf(discarded)}
      />

      {/* On the viewer's turn Hit and Stay lie to the right of the draw pile, side by side and as deep as the pile: floor buttons, one blue-green and one grey with a hint of the same. Stay is there but dim when the viewer holds nothing to bank */}
      {myTurn && (
        <>
          <FloorButton at={plan.hit} width={plan.hit.width} depth={plan.hit.depth} tone={FLOOR_TONES.hit} label={words.hit} onPress={onHit} />
          <FloorButton
            at={plan.stay}
            width={plan.stay.width}
            depth={plan.stay.depth}
            tone={FLOOR_TONES.stay}
            label={words.stay}
            disabled={!phase.canStay}
            onPress={onStay}
          />
        </>
      )}

      {/* Between two rounds the dealer deals the next one, from one pad across the room of the two */}
      {dealing && <FloorButton at={plan.deal} width={plan.deal.width} depth={plan.deal.depth} tone={FLOOR_TONES.hit} label={words.deal} onPress={onDeal} />}

      {/* An action card drawn lies face up in the place of Hit, for everybody, and for the one who holds it the words beside it, written flat on the table, say what to do: press the zone of a player */}
      {phase.kind === "target" && (
        <>
          <Zone frame={{ x: plan.card.x, z: plan.card.z }} layout={[onTable(0, 0, { y: 0.05, scale: plan.card.scale })]} size={CARD_SIZE} cards={cardsOf([phase.card]).map((card) => ({ ...card, glow: choosing ? GLOWS.selection : null }))} />
          {choosing && <Prompt text={promptOf(phase.card.type, words)} plan={plan.prompt} color={theme.accent} />}
        </>
      )}
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
  // The mat is data: the table is its edge colour, flat and endless, with no grain and no picture, and the pool of light the cards lie on is the only thing on it that changes: `surface` of the game's settings in the middle, falling away to `surfaceDark`
  const surface = useMemo(() => ({ color: theme.surfaceDark, light: { center: theme.surface, radius: POOL_RADIUS } }), [theme.surfaceDark, theme.surface])
  return (
    <Table camera={camera} photo={PHOTO} surface={surface} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}
