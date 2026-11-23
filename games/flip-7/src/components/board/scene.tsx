"use client"

import type { Face, PlayerView, PublicSeat } from "@flip-7/engine"
import { useGame } from "@pbgo/core/components/game/context"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { type CardState, effectiveState, FloorButton, Hotspot, LightPool, NO_TOUCH, onTable, Pile, pile, PlayerSeat, Table, type Touch, useLettering, useSettings, useViewport, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useMemo, useState } from "react"
import { AdditiveBlending } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { madeFlip7 } from "../../lib/flip7-line"
import { fill } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { areaPlace, cardsBox, dealtFrom, floorPlan, frameOf, heldPoses, LAYOUT_FIELDS, LAYOUT_SETTINGS, linePoses, lines, pilePlaces, seatSpots, stickerPlaces, zones } from "./layout"
import { PACE_FIELDS, PACE_SETTINGS } from "./pacing"
import { Sticker } from "./stickers"
import { CARD_SIZE, matTexture, useFaces } from "./textures"

/** The pool of light of the mat: how far across it spreads, in world units. Past it the table is the plain colour it fades into. */
const MAT_SIZE = 44

/** The pool of light the cards lie on: `surface` of the game's settings in the middle, falling away to `surfaceDark`, which is the colour of the endless table around it. It is added to the table (additive blending), not laid over it, so at its rim it adds nothing and it has no edge. */
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

function World({ view, catalog, pointsText, onHit, onStay, onDeal, onTarget, entrances, busy, held }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout and of its pace
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  // The lettering on the table is the kit's (`useLettering`): the fonts the game uploaded to its Sanity project, the display font for names, buttons and counts, else the kit's own
  const lettering = useLettering()
  const faces = useFaces(catalog)
  const { words } = catalog
  const meId = view.me
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const spots = useMemo(() => seatSpots(ids, meId), [key, meId])
  const placed = useMemo(() => lines(spots, meId), [spots, meId])
  const areas = useMemo(() => zones(placed), [placed])
  const { nickname } = useGame()
  const R = LAYOUT_SETTINGS
  const { deck, discard } = pilePlaces()
  const phase = view.phase
  const myTurn = phase.kind === "turn" && phase.player === meId
  const choosing = phase.kind === "target" && phase.player === meId
  const dealing = phase.kind === "between" && phase.dealer === meId
  const dealt = dealtFrom()
  const plan = floorPlan()
  // What the visitor does to the area of each player that can get the action card (the pointer over it, the keyboard focus on it, the pointer down): the cards under it are lit from it
  const [touches, setTouches] = useState<Record<string, Touch>>({})

  // What a seat says, the word under the name and the total, is what the table said before the last move until the move has played out: a player who busts with the third card of a Flip Three is not out before that card has landed
  const now = useMemo(() => new Map(view.players.map((player) => [player.id, { status: player.status, total: player.total }])), [view.players])
  const [settled, setSettled] = useState(now)
  if (!busy && settled !== now) setSettled(now)
  const said = busy ? settled : now

  // A card the last move turned over comes in from above the draw pile after the time the timeline gives it, so that they come one after the other. Every other card is where it was, or flies from where it lay: the table remembers
  // where a card with the same id was a moment ago. The cards of the opening deal wait for the start screen to go
  const cardsOf = (list: readonly Face[], state: CardState = "base"): ZoneCard[] =>
    (held ? [] : list).map((face) => {
      const delay = entrances.get(face.id)
      return { key: face.id, id: face.id, front: faces.face(face.type), back: faces.back, state, from: delay === undefined ? null : { ...dealt, delay } }
    })
  // The engine's discard is top first and a pile layout is bottom first
  const discarded = [...view.discard].reverse()

  return (
    <>
      {view.players.map((player) => {
        const line = placed.get(player.id)!
        // Everything of the player lies in the frame of their seat, which faces the middle of the table: from the middle outward, the plate, the line, the cards set aside
        const frame = frameOf(line)
        const pickable = choosing && phase.targets.includes(player.id)
        const seat = said.get(player.id) ?? now.get(player.id)!
        // A busted player can no longer play: all their cards go grey and dark until the next round (a frozen or a stayed one has banked their points and keeps the colour of their cards; the word under the name says which)
        const out = seat.status === "busted"
        // A player who can get the action card the viewer holds has their cards in the state `interactive`, and the table raises it to `hover` and `pressed` from what the visitor does to their area
        const touch = touches[player.id] ?? NO_TOUCH
        const state: CardState = out ? "out" : pickable ? effectiveState("interactive", touch) : "base"
        const area = areaPlace(areas.get(player.id)!)
        // The BUST! stamp and the "+15 point bonus" badge lie on the table when the table says so, that is once the move has played out (`said`), and stay until the next round. A stamp is drawn only if the game document has its picture
        const { bust, bonus } = faces.stickers
        const places = stickerPlaces(line, bust?.aspect ?? 1.8, bonus?.aspect ?? 1.65)
        const bonusEarned = seat.status === "stayed" && madeFlip7(player.cards)
        return (
          <group key={player.id}>
            {/* The plate stands on the side of the line that faces the middle of the table, in the frame of the seat, turned as the cards are: the name is read over the cards by the player who sits there */}
            <PlayerSeat
              id={player.id}
              frame={frame}
              above={cardsBox(line)}
              line={pointsText(seat.total)}
              status={statusOf(seat.status, words)}
              font={lettering.display}
              nameStyle={{ weight: lettering.weight }}
              lineStyle={{ weight: lettering.weight }}
            />
            {/* What lies in front of the player: every card is face up, in the frame of the seat */}
            <Zone frame={frame} layout={linePoses(player.cards.length, line)} size={CARD_SIZE} cards={cardsOf(player.cards, state)} />
            {/* The Freeze and Flip Three cards flipped during a Flip Three wait, face up, beyond the line on the side of the player, until its three cards are done */}
            <Zone frame={frame} layout={heldPoses(player.held.length, line)} size={CARD_SIZE} cards={cardsOf(player.held, state)} />
            {/* The area of the table that is pressed to give this player the card the viewer holds: their cards with their plate, and a little room round them. It is invisible, the cards say that it can be pressed; a player with no card yet is lit by a pool of light where their cards will lie */}
            {pickable && (
              <>
                <Hotspot
                  at={area.at}
                  width={area.width}
                  depth={area.depth}
                  ariaLabel={fill(words.targetPlayer, { target: nickname(player.id) })}
                  onPress={() => onTarget(player.id)}
                  onTouch={(next) => setTouches((all) => ({ ...all, [player.id]: next }))}
                />
                {player.cards.length === 0 && player.held.length === 0 && (
                  <LightPool size={{ width: CARD_SIZE.width * line.scale, height: CARD_SIZE.height * line.scale }} state={state} position={[line.at.x, 0.012, line.at.z]} yaw={line.yaw} />
                )}
              </>
            )}
            {!held && out && bust && <Sticker picture={bust} {...places.bust} />}
            {!held && bonusEarned && bonus && <Sticker picture={bonus} {...places.bonus} />}
          </group>
        )
      })}

      {/* The draw pile: on the viewer's turn pressing it, or the word over it, turns the next card over (Hit). Only its size is known, so it is a count, which the pile writes under itself */}
      <Pile
        frame={{ x: deck.x, z: deck.z }}
        count={view.deck.size}
        size={CARD_SIZE}
        back={faces.back}
        scale={R.pileScale}
        limit={14}
        action={myTurn ? { label: words.hit, onPress: onHit } : undefined}
      />

      {/* The discard: every card of it keeps its id, so the cards of a line fly there when the next round is dealt */}
      <Zone
        frame={{ x: discard.x, z: discard.z }}
        // the discard grows to most of the box: its cards are laid closer as it grows, so that it never stands taller than a thin stack
        layout={pile(discarded.length, { face: "up", lean: "discard", scale: R.pileScale, step: Math.min(0.02, 0.4 / Math.max(1, discarded.length)) })}
        size={CARD_SIZE}
        cards={cardsOf(discarded)}
      />

      {/* On the viewer's turn Stay lies beside the draw pile, across the strip between the piles and as deep as the pile: a floor button, for an action that has no object, in the quieter tone. It is there but dim when the viewer holds nothing to bank */}
      {myTurn && <FloorButton at={plan.pad} width={plan.pad.width} depth={plan.pad.depth} tone="neutral" label={words.stay} disabled={!phase.canStay} onPress={onStay} />}

      {/* Between two rounds the dealer deals the next one, from the same pad, in the tone of the action that goes on */}
      {dealing && <FloorButton at={plan.pad} width={plan.pad.width} depth={plan.pad.depth} tone="primary" label={words.deal} onPress={onDeal} />}

      {/* An action card drawn lies face up beside the draw pile, for everybody, picked for the one who holds it: what to do is the ticker's sentence, and the players who can get it have their cards lit */}
      {phase.kind === "target" && (
        <Zone frame={{ x: plan.card.x, z: plan.card.z }} layout={[onTable(0, 0, { y: 0.05, scale: plan.card.scale })]} size={CARD_SIZE} cards={cardsOf([phase.card], choosing ? "selected" : "base")} />
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
  // The table is its edge colour, flat and endless, with no grain and no picture; the pool of light the cards lie on is the only thing on it that changes
  return (
    <Table camera={camera} photo={PHOTO} surface={{ color: theme.surfaceDark }} held={props.held} onLoaded={props.onLoaded}>
      <Mat inner={theme.surface} outer={theme.surfaceDark} />
      <World {...props} />
    </Table>
  )
}
