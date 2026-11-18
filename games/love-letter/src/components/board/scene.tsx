"use client"

import { type Face, GUESSES, type PlayerView, type PublicSeat } from "@love-letter/engine"
import { useGame } from "@pbgo/core/components/game/context"
import { shortName } from "@pbgo/core/lib/short-name"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { Counter, inFrame, onTable, Pile, type Pose, PlayerSeat, Stack, Table, TableText, useSettings, useViewport, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { AdditiveBlending } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { holdHovered, holdPicked, releaseHovered, releaseHoveredUnless } from "../../lib/lens"
import { fill } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { OrderMarker, Strip, TargetZones, tonesOf } from "./controls"
import { nameMeasure, sentenceMeasure, TABLE_WEIGHT, tableFonts } from "./fonts"
import { GLOWS, lightGlows } from "./glows"
import { areaPoses, areas, backsPoses, CARD, dealtFrom, fanPoses, faceUpPoses, guessPoses, handOf, LAYOUT_FIELDS, LAYOUT_SETTINGS, middlePlaces, nameWidth, PLATE_TRAILING, plateAt, plateFit, revealedPoses, seatSpots, zones } from "./layout"
import { matTexture } from "./mat"
import { type Arrival, PACE_FIELDS, PACE_SETTINGS, type Reveal } from "./pacing"
import { RevealView, useReveal } from "./sequence"
import { CARD_SIZE, useFaces } from "./textures"
import { type Choice, type ClientAction, keepAction, NO_CHOICE, playAction, pressable, pressCard, pressTarget, lensIds, noteOf, type Step, stepOf, swapOrder, validChoice } from "./turn"

/** The pool of light of the mat: how far across it spreads, in world units. Past it the table is the plain colour it fades into. */
const MAT_SIZE = 30

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
  /** The faces, the names and the card texts of the characters, the back of the cards and the words of the board, from Sanity */
  catalog: ClientCatalog
  /** What the viewer sends: a card played (with the player it picks and the character it names), the card kept after a Chancellor, the deal of the next round. The platform puts the player in */
  onAction: (action: ClientAction) => void
  /** A move is on its way to the server: the pads wait for the answer */
  busy: boolean
  /** The version of the table that the last move made, and what that move did, from the log (`timelineOf`): where each card that came in comes in from, who drew, and what the move shows to be read */
  v: number
  entrances: ReadonlyMap<number, Arrival>
  drawn: ReadonlyMap<string, number>
  reveals: readonly Reveal[]
  /** What a reveal says under its faces, in the history's words */
  caption: (reveal: Reveal) => string
  /** The cards of the hands come in from the deck: the opening deal and every deal after it, and every card drawn once a move has been played, but not the cards of a table that was just opened in the middle of a game, which are where they lie */
  deal: boolean
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`) */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

/** What a plate changes in the kit's lettering: the table's lettering is all at 700 (`TABLE_WEIGHT`), where the kit's plates are at 600 */
const LETTERING = { weight: TABLE_WEIGHT }

/** The word under a player's name: out of the round, or a winner of the round that has just been counted, or protected by a Handmaid. A player who is none of them has none. */
function statusOf(player: PublicSeat, view: PlayerView, words: ClientCatalog["words"]): string | undefined {
  if (player.out) return words.out
  if (view.phase.kind === "between" && view.phase.winners.includes(player.id)) return words.roundWinner
  if (player.shielded) return words.shielded
  return undefined
}

/** The favor tokens of a player: a stack of discs and, beside it, what they hold over what wins (numbers only), at the right of their name, in the `PLATE_TRAILING` the plate keeps for them (the count is about nine tenths of a unit wide, centred a unit from the name). */
function Tokens({ id, count, target, color, ink }: { id: string; count: number; target: number; color: string; ink: string }) {
  return (
    <>
      <Stack id={`tokens-${id}`} count={count} cap={8} model="disc" size={0.32} at={{ x: 0.42, z: 0 }} color={color} />
      <Counter value={count} at={{ x: PLATE_TRAILING - 0.45, z: 0 }} height={0.38} format={(tokens) => `${tokens} / ${target}`} style={{ color: ink, weight: TABLE_WEIGHT }} />
    </>
  )
}

function World({ view, catalog, onAction, busy, v, entrances, drawn, reveals, caption, deal, held: onStartScreen }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  const { theme, bodyFont, displayFont, files } = useSiteSettings()
  // The lettering on the table is drawn in the fonts of the game's settings (the display font for names, counts and plates, the body font for the card texts and the sentences)
  const fonts = tableFonts({ bodyFont, displayFont, files })
  lightGlows(theme.accent)
  const faces = useFaces(catalog, { nameFont: fonts.display, textFont: fonts.body, ink: theme.surfaceDark })
  const { words } = catalog
  const { nickname } = useGame()
  const meId = view.me?.id ?? null
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const spots = useMemo(() => seatSpots(ids, meId), [key, meId])
  const placed = useMemo(() => areas(spots, meId), [spots, meId])
  const pressZones = useMemo(() => zones(spots, placed, meId), [spots, placed, meId])
  const R = LAYOUT_SETTINGS
  const { deck, aside, faceUp } = middlePlaces()
  const ink = { color: theme.foreground, weight: TABLE_WEIGHT }
  const tones = tonesOf(theme)
  // the plate of a long name is drawn smaller, so that the avatar, the name and the tokens fit the room the layout keeps for them
  const measure = useMemo(() => nameMeasure(fonts.display), [fonts.display])
  // the sentences of the strip are set by the width of their letters in the body font: on one line when they fit
  const sentenceEm = useMemo(() => sentenceMeasure(fonts.body), [fonts.body])

  // What the viewer has picked this turn, and what the board offers for it (`turn.ts`): a pick that no longer fits the view (the card left the hand, the turn passed) is dropped
  const [picked, setPicked] = useState<Choice>(NO_CHOICE)
  const choice = validChoice(view, picked)
  if (choice !== picked) setPicked(choice)
  const offered = stepOf(view, choice)
  const [hovered, setHovered] = useState<number | null>(null)
  const pickedFace = view.me?.hand.find((face) => face.id === choice.card)
  // a screen that cannot hover holds up the card that is picked (`Lens` of the screen)
  useEffect(() => {
    holdPicked(pickedFace ? { id: pickedFace.id, type: pickedFace.type, source: faces.source(pickedFace.type) } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the faces are painted once for the page: the card picked is what changes
  }, [pickedFace?.id])
  useEffect(() => () => holdPicked(null), [])
  const send = (action: ClientAction) => {
    if (!busy) onAction(action)
  }
  // The reveal of the last move, while it is on the table: the controls wait for it to go
  const reveal = useReveal(v, reveals)
  const step: Step = reveal ? { kind: "none" } : offered
  const dealt = dealtFrom()
  /** Where a card that came in with the last move comes in from, in the world: above the deck, or out of the hand of the player who played it */
  const originOf = (by: string, from: Arrival["from"] = "hand"): Pose => {
    if (from === "deck") return dealt
    const area = placed.get(by)!
    const hand = handOf(area, by === meId)
    return by === meId ? inFrame({ x: hand.at.x, z: hand.at.z, yaw: 0 }, fanPoses(1, hand)[0]!) : inFrame({ x: hand.at.x, z: hand.at.z, yaw: hand.yaw }, backsPoses(1, hand)[0]!)
  }
  // the cards of the hands come in from the deck once the table is dealing; none lies on the table while the start screen is up, so that the opening deal is seen
  const entering = deal && !onStartScreen ? dealt : undefined

  // what the strip says when there is nothing to press: the viewer is out of the round, or another player deals the next round
  const note = noteOf(view)
  const noteText = note === null ? "" : note.kind === "out" ? words.outOfRound : fill(words.waitDeal, { player: nickname(note.player) })
  // The cards the lens can hold up that are on the table now: the one it holds is let go when its card is not (a card that goes gets no pointer-out event)
  const guessing = step.kind === "guess"
  const alive = useMemo(() => lensIds(view, guessing, !!reveal), [view, guessing, reveal])
  useEffect(() => releaseHoveredUnless(alive), [alive])

  /** A card of the view as the table draws it: its face, the back it lies on, whether its player is out of the round, and the lens that holds it up for reading while the pointer is on it */
  const cardOf = (face: Face, out = false, glow: ZoneCard["glow"] = null): ZoneCard => {
    const arrival = entrances.get(face.id)
    return {
      key: face.id,
      id: face.id,
      front: faces.face(face.type),
      back: faces.back,
      out,
      glow,
      from: arrival ? { ...originOf(arrival.by, arrival.from), delay: arrival.delay } : undefined,
      onHover: (over) => (over ? holdHovered({ id: face.id, type: face.type, source: faces.source(face.type) }) : releaseHovered(face.id)),
    }
  }

  return (
    <>
      {view.players.map((player) => {
        const area = placed.get(player.id)!
        const viewer = player.id === meId
        const hand = handOf(area, viewer)
        const fit = plateFit(nameWidth(measure(shortName(nickname(player.id)))))
        const plate = plateAt(spots.get(player.id)!, area, hand, fit)
        const frame = { x: area.at.x, z: area.at.z, yaw: area.yaw }
        // the Handmaid that protects a player is the last one they played: protection ends when their next turn starts, and a player plays one card a turn (a Prince's discard comes after it, a Handmaid stays the last of its kind)
        const handmaid = player.shielded ? [...player.area].reverse().find((face) => face.type === "handmaid") : undefined
        // the hand: faces to its owner, and to everybody once a round that ended on a comparison laid them down; otherwise a few backs, only counted
        const held = viewer ? (view.me?.hand ?? []) : (player.hand ?? [])
        const flat = !viewer && player.hand !== null
        // the viewer's hand: the card picked, or under the pointer, is held up toward them; a card the Countess rule forbids is grey and cannot be pressed
        const raised = held.findIndex((face) => face.id === (choice.card ?? hovered))
        const forbidden = (face: Face) => view.phase.kind === "turn" && view.phase.player === meId && !pressable(view, face)
        return (
          <group key={player.id}>
            {/* The plate stands beyond the cards, turned the way its text reads (never upside down): the seat is drawn in its own frame, with its centre at the plate's */}
            <group position={[plate.x, 0, plate.z]} rotation-y={plate.yaw} scale={area.plate * fit}>
              <PlayerSeat
                id={player.id}
                spot={{ x: 0, z: 0, yaw: 0 }}
                viewer={false}
                status={statusOf(player, view, words)}
                font={fonts.display}
                nameStyle={LETTERING}
                lineStyle={LETTERING}
                trailing={<Tokens id={player.id} count={player.tokens} target={view.target} color={theme.accent} ink={theme.foreground} />}
              />
            </group>
            {/* What lies in front of the player: every card they played or discarded this round, face up, oldest first, turned to face their player. A player who is out has them grey */}
            <Zone frame={frame} layout={areaPoses(player.area.length, area)} size={CARD_SIZE} cards={player.area.map((face) => cardOf(face, player.out, face.id === handmaid?.id ? GLOWS.shielded : null))} />
            {/* The hand: the viewer's is a fan of faces that stands up toward them, whose cards they press; an opponent's is a few small backs, or their face up cards once the round has laid them down */}
            {viewer ? (
              <Zone
                frame={{ x: hand.at.x, z: hand.at.z, yaw: 0 }}
                layout={fanPoses(held.length, hand, raised)}
                size={CARD_SIZE}
                enter={entering}
                cards={(onStartScreen ? [] : held).map((face) => {
                  const can = pressable(view, face)
                  const mark = offered.kind === "order" ? offered.others.findIndex((other) => other.id === face.id) : -1
                  return {
                    ...cardOf(face, forbidden(face), choice.card === face.id ? GLOWS.selection : null),
                    gloss: can,
                    onClick: can
                      ? (event) => {
                          event.stopPropagation()
                          if (!busy) setPicked(pressCard(choice, face.id))
                        }
                      : undefined,
                    onHover: (over) => {
                      setHovered((current) => (over ? face.id : current === face.id ? null : current))
                      if (over) holdHovered({ id: face.id, type: face.type, source: faces.source(face.type) })
                      else releaseHovered(face.id)
                    },
                    // after a Chancellor, the cards put back wear the place they take under the deck
                    children: mark >= 0 ? <OrderMarker place={mark + 1} color={theme.accent} ink={theme.surfaceDark} font={fonts.display} /> : undefined,
                  }
                })}
              />
            ) : flat ? (
              <Zone frame={{ x: hand.at.x, z: hand.at.z, yaw: hand.yaw }} layout={revealedPoses(held.length, hand)} size={CARD_SIZE} cards={held.map((face) => cardOf(face))} />
            ) : (
              <Zone
                frame={{ x: hand.at.x, z: hand.at.z, yaw: hand.yaw }}
                layout={backsPoses(player.cards, hand)}
                size={CARD_SIZE}
                enter={entering}
                // a card another player drew is the last of their backs, and comes from the deck when its turn comes
                cards={Array.from({ length: onStartScreen ? 0 : player.cards }, (_, i) => ({
                  key: `back-${player.id}-${i}`,
                  front: faces.back,
                  back: faces.back,
                  out: player.out,
                  from: i === player.cards - 1 && drawn.has(player.id) ? { ...dealt, delay: drawn.get(player.id)! } : undefined,
                }))}
              />
            )}
          </group>
        )
      })}

      {/* The deck: only its size is known, so it is a count, face down, with its number under it */}
      <Pile frame={{ x: deck.x, z: deck.z }} count={view.deck.size} size={CARD_SIZE} back={faces.back} scale={R.deckScale} limit={14} />
      <TableText text={String(view.deck.size)} style={ink} height={0.6} position={[deck.x, 0.02, deck.z + (CARD.height * R.deckScale) / 2 + 0.55]} font={fonts.display} />

      {/* The card set aside face down, apart from the deck: which one it is, nobody knows. At two players three more are set aside face up, and everybody reads them */}
      {view.aside === 1 && <Zone frame={{ x: aside.x, z: aside.z }} layout={[onTable(0, 0, { face: "down", scale: R.asideScale, yaw: 0.14 })]} size={CARD_SIZE} cards={[{ key: "aside", front: faces.back, back: faces.back }]} />}
      {view.faceUp.length > 0 && <Zone frame={{ x: faceUp.x, z: faceUp.z }} layout={faceUpPoses(view.faceUp.length)} size={CARD_SIZE} cards={view.faceUp.map((face) => cardOf(face))} />}

      {/* The players the picked card can choose: their zone lies lit, pressed anywhere. A Priest, a Baron, a King and a Prince play at once; a Guard names the player and goes on to the nine characters */}
      {(step.kind === "target" || step.kind === "guess") && (
        <TargetZones
          ids={step.targets}
          zones={pressZones}
          chosen={step.kind === "guess" ? step.target : null}
          tone={tones.zone}
          labelOf={(id) => fill(words.targetPlayer, { target: nickname(id) })}
          disabled={busy}
          onPress={(id) => {
            if (step.card.type === "guard") setPicked(pressTarget(choice, id))
            else send(playAction(step.card, id))
          }}
        />
      )}

      {/* The strip in the middle: the sentence that says what to do and the pad of the moment */}
      <Strip
        step={step}
        note={reveal ? "" : noteText}
        words={words}
        tones={tones}
        ink={theme.foreground}
        accent={theme.accent}
        fonts={fonts}
        measure={sentenceEm}
        busy={busy}
        onPlay={() => step.kind === "pad" && send(playAction(step.card))}
        onKeep={() => step.kind === "order" && send(keepAction(step))}
        onSwap={() => step.kind === "order" && setPicked(swapOrder(step, choice))}
        onDeal={() => send({ type: "deal" })}
      />
      {/* What the last move shows to be read: a Guard's guess, a Priest's look, a Baron's comparison, a King's trade, in the middle of the table for the time it takes to read it */}
      {reveal && (
        <RevealView
          reveal={reveal}
          faces={faces}
          caption={caption(reveal)}
          ink={theme.foreground}
          font={fonts.body}
          measure={sentenceEm}
          originOf={(id) => originOf(id)}
          onHover={(id, type, over) => (over && type ? holdHovered({ id, type, source: faces.source(type) }) : releaseHovered(id))}
        />
      )}

      {/* A Guard's guess: the nine characters it can name, as small faces under the sentence. A press names one, and the Guard is played; the lens reads the one under the pointer */}
      {step.kind === "guess" && (
        <Zone
          layout={guessPoses()}
          size={CARD_SIZE}
          cards={GUESSES.map((type, i) => ({
            key: `guess-${type}`,
            front: faces.face(type),
            back: faces.back,
            gloss: !busy,
            onClick: (event) => {
              event.stopPropagation()
              send(playAction(step.card, step.target, type))
            },
            onHover: (over) => (over ? holdHovered({ id: -1 - i, type, source: faces.source(type) }) : releaseHovered(-1 - i)),
          }))}
        />
      )}
    </>
  )
}

export function Scene(props: SceneProps) {
  const { theme } = useSiteSettings()
  const players = props.view.players.length
  // The camera stands where the whole table is in the window and clear of what the platform draws over it (`fitCamera`): a window that is dragged to another size does not fit the camera at every step, it waits. The Camera folder of the debug panel edits
  // this object: it is made again when the window or the number of players changes
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
