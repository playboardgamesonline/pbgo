"use client"

import { type Face, GUESSES, type PlayerView, type PublicSeat } from "@love-letter/engine"
import { useGame } from "@pbgo/core/components/game/context"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import {
  type CardState,
  centreOf,
  effectiveState,
  FloorButton,
  HELD_FAN_FIELDS,
  HELD_FAN_SETTINGS,
  HeldHand,
  Hotspot,
  hotspotOf,
  inFrame,
  LightPool,
  NO_TOUCH,
  onTable,
  Pile,
  PlayerSeat,
  type Pose,
  pointInFrame,
  SCREEN_HAND_FIELDS,
  ScreenHand,
  screenHandLayout,
  Stack,
  Table,
  type Touch,
  useLettering,
  useSettings,
  useViewport,
  Zone,
  type ZoneCard,
} from "@pbgo/table"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import type { ClientCatalog } from "../../lib/catalog"
import { holdHovered, holdPicked, releaseHovered, releaseHoveredUnless } from "../../lib/lens"
import { fill } from "../../lib/words"
import { cameraFor, PHOTO } from "./camera"
import { areaPoses, CARD, dealPlace, dealtFrom, faceUpPoses, guessPoses, HAND_SETTINGS, heldFrom, HELD_SHADOW, heldLayout, LAYOUT_FIELDS, LAYOUT_SETTINGS, type Line, lines, middlePlaces, revealedPoses } from "./layout"
import { type Arrival, PACE_FIELDS, PACE_SETTINGS, type Reveal } from "./pacing"
import { RevealView } from "./sequence"
import { CARD_SIZE, useFaces } from "./textures"
import { type Choice, type ClientAction, lensIds, pressCard, pressName, pressPlayer, type Press, type Step } from "./turn"

/** How far the pool of light of the table reaches, in world units: past it the table is its plain edge colour */
const POOL_RADIUS = 22

export type SceneProps = {
  view: PlayerView
  /** The faces, the names and the card texts of the characters, the back of the cards and the words of the board, from Sanity */
  catalog: ClientCatalog
  /** What the viewer sends: a card played (with the player it picks and the character it names), the card kept after a Chancellor, the deal of the next round. The platform puts the player in */
  onAction: (action: ClientAction) => void
  /** A move is on its way to the server: nothing can be pressed until the answer comes */
  busy: boolean
  /** What the viewer has picked and what the board offers for it (`turn.ts`), which the screen around the table holds too, since the ticker says what to do for it: the table draws the cards in the state that fits and the screen's `onChoice` holds what is pressed */
  choice: Choice
  step: Step
  onChoice: (choice: Choice) => void
  /** Where each card that came in with the last move comes in from, and when, from the log (`timelineOf`) */
  entrances: ReadonlyMap<number, Arrival>
  /** When each player who drew a card with the last move drew it: the hand of another player gets a back then, which comes in from the deck */
  drawn: ReadonlyMap<string, number>
  /** What the last move shows to be read, while it is on the table: the faces in the middle, for the time it takes to read them */
  reveal: Reveal | null
  /** The cards of the hands come in from the deck: the opening deal and every deal after it, and every card drawn once a move has been played, but not the cards of a table that was just opened in the middle of a game, which are where they lie */
  deal: boolean
  /** The start screen is up: the camera's entrance waits for it to go (`held` of the shared `Table`) */
  held?: boolean
  /** Called once when the table is drawn with everything it waited for (`onLoaded` of the shared `Table`) */
  onLoaded?: () => void
}

/** The word under a player's name: out of the round, or a winner of the round that has just been counted, or protected by a Handmaid. A player who is none of them has none. */
function statusOf(player: PublicSeat, view: PlayerView, words: ClientCatalog["words"]): string | undefined {
  if (player.out) return words.out
  if (view.phase.kind === "between" && view.phase.winners.includes(player.id)) return words.roundWinner
  if (player.shielded) return words.shielded
  return undefined
}

/** The favor tokens of a player: a stack of discs at the right of the plate, in the `PLATE_TRAILING` the layout keeps for them. A player who has none has no stack, so nothing stands there: the discs are the count */
function Tokens({ id, count, color }: { id: string; count: number; color: string }) {
  return <Stack id={`tokens-${id}`} count={count} cap={8} model="disc" size={0.32} at={{ x: 0.42, z: 0 }} color={color} />
}

function World({ view, catalog, onAction, busy, choice, step, onChoice, entrances, drawn, reveal, deal, held: onStartScreen }: SceneProps) {
  // The table's own folders (camera, cards, seats, lights...) are made by the shared `Table`; the game binds the knobs of its layout. The cards the others hold are a small fan of backs that stands, and the viewer's own are held on the screen: the kit's Held hands and Hand folders
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  useSettings("Pace", PACE_SETTINGS, PACE_FIELDS, { order: 2 })
  useSettings("Held hands", HELD_FAN_SETTINGS, HELD_FAN_FIELDS, { order: 3 })
  useSettings("Hand", HAND_SETTINGS, SCREEN_HAND_FIELDS, { order: 4 })
  const { theme } = useSiteSettings()
  // The lettering on the table is the kit's (`useLettering`): the fonts the game uploaded to its Sanity project, the display font for names, buttons and counts, the body font for the card texts, else the kit's own
  const lettering = useLettering()
  const faces = useFaces(catalog, { nameFont: lettering.display, textFont: lettering.body, ink: theme.surfaceDark })
  const { words, names } = catalog
  const { nickname } = useGame()
  const meId = view.me?.id ?? null
  const ids = view.players.map((player) => player.id)
  // The line of every player, along the axis of their seat: the plate, the play area and the hand, in the frame of the seat
  const placed = lines(ids, meId)

  const [hovered, setHovered] = useState<number | null>(null)
  const pickedFace = view.me?.hand.find((face) => face.id === choice.card)
  // a screen that cannot hover holds up the card that is picked (`Lens` of the screen)
  useEffect(() => {
    holdPicked(pickedFace ? { id: pickedFace.id, type: pickedFace.type, source: faces.source(pickedFace.type) } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the faces are painted once for the page: the card picked is what changes
  }, [pickedFace?.id])
  useEffect(() => () => holdPicked(null), [])
  /** What the viewer pressed: a card held or put back, or a move sent. A move waits for the answer to the last one */
  const apply = (press: Press | null) => {
    if (!press || busy) return
    if (press.kind === "choose") onChoice(press.choice)
    else onAction(press.action)
  }
  const dealt = dealtFrom()
  /** Where a card that came in with the last move comes in from, in the world: above the deck, or out of the hand of the player who played it (the left end of the hand they held, as the viewer sees it). The viewer's own cards come out of the hand held on the screen, which the card remembers */
  const originOf = (by: string, from: Arrival["from"] = "hand"): Pose | undefined => {
    if (from === "deck") return dealt
    const line = placed.get(by)
    if (!line || by === meId) return undefined
    return heldFrom(line.seat, (view.players.find((player) => player.id === by)?.cards ?? 0) + 1)
  }
  // where the faces of a reveal come out of: an opponent's hand, or where the viewer's own hand would be on the table, at the foot of their line
  const handOf = (id: string): Pose => {
    const line = placed.get(id)!
    return id === meId ? inFrame(line.seat, onTable(0, 0, { y: 0.4, scale: HELD_FAN_SETTINGS.scale })) : heldFrom(line.seat, Math.max(1, view.players.find((player) => player.id === id)?.cards ?? 1))
  }
  // the cards of the hands come in from the deck once the table is dealing; none lies on the table while the start screen is up, so that the opening deal is seen
  const entering = deal && !onStartScreen ? dealt : undefined
  // The cards the lens can hold up that are on the table now: the one it holds is let go when its card is not (a card that goes gets no pointer-out event)
  const guessing = step.kind === "guess"
  const alive = useMemo(() => lensIds(view, guessing, !!reveal), [view, guessing, reveal])
  useEffect(() => releaseHoveredUnless(alive), [alive])

  // The players the picked card can choose are pressed by their cards: an invisible area over each (`Hotspot`) says how it is touched, and their cards are in the state `interactive`, `hover` and `pressed`; a Guard's chosen player is `selected`, the others stay to change one's mind
  const [touches, setTouches] = useState<Record<string, Touch>>({})
  const choosable = !busy && (step.kind === "target" || step.kind === "guess") ? step.targets : []
  const chosen = step.kind === "guess" ? step.target : null
  const stateOf = (id: string): CardState | undefined => {
    if (!choosable.includes(id)) return undefined
    return effectiveState(id === chosen ? "selected" : "interactive", touches[id] ?? NO_TOUCH)
  }

  /** A card of the view as the table draws it: its face, the back it lies on, and the lens that holds it up for reading while the pointer is on it. A card of the hand held on the screen comes in from the deck in the frame of the screen (`toFrame`) */
  const cardOf = (face: Face, extra: Partial<ZoneCard> = {}, toFrame?: (pose: Pose) => Pose): ZoneCard => {
    const arrival = entrances.get(face.id)
    const origin = arrival ? originOf(arrival.by, arrival.from) : undefined
    return {
      key: face.id,
      id: face.id,
      front: faces.face(face.type),
      back: faces.back,
      ...(origin && arrival ? { from: { ...(toFrame ? toFrame(origin) : origin), delay: arrival.delay } } : {}),
      onHover: (over) => (over ? holdHovered({ id: face.id, type: face.type, source: faces.source(face.type) }) : releaseHovered(face.id)),
      ...extra,
    }
  }

  const hand = view.me?.hand ?? []
  // the card picked, or under the pointer, is brought forward in the hand
  const raised = hand.findIndex((face) => face.id === (choice.card ?? hovered))
  /** How a card of the viewer's hand stands: it can be pressed while there is something to do with it, picked when it is held, and dark when the Countess rule forbids it; the table draws the rest */
  const handState = (face: Face): CardState => {
    if (busy) return "base"
    switch (step.kind) {
      case "pick":
        return view.me?.playable.includes(face.id) ? "interactive" : "disabled"
      case "target":
      case "guess":
        return face.id === choice.card ? "selected" : view.me?.playable.includes(face.id) ? "interactive" : "disabled"
      case "keep":
        return "interactive"
      case "order":
        return face.id === step.kept.id ? "selected" : "interactive"
      default:
        return "base"
    }
  }
  /** What a screen reader says of a card of the hand: what pressing it does, and its name */
  const handName = (face: Face) => {
    if (step.kind === "keep") return `${words.keep} · ${names[face.type]}`
    if (step.kind === "pick" || step.kind === "target" || step.kind === "guess") return `${words.play} · ${names[face.type]}`
    return names[face.type]
  }
  const handCards = (toFrame: (pose: Pose) => Pose): ZoneCard[] =>
    (onStartScreen ? [] : hand).map((face) => ({
      ...cardOf(face, {}, toFrame),
      state: handState(face),
      onPress: () => apply(pressCard(view, choice, face)),
      ariaLabel: handName(face),
      onHover: (over) => {
        setHovered((current) => (over ? face.id : current === face.id ? null : current))
        if (over) holdHovered({ id: face.id, type: face.type, source: faces.source(face.type) })
        else releaseHovered(face.id)
      },
    }))

  /** The area that a press counts in to choose a player, over their cards and their plate, in the frame of their seat */
  const hotspot = (id: string, line: Line) => (
    <Hotspot
      key={`press-${id}`}
      {...hotspotOf({ frame: line.seat, box: line.press })}
      ariaLabel={fill(words.targetPlayer, { target: nickname(id) })}
      {...(step.kind === "target" || step.kind === "guess" ? { onPress: () => apply(pressPlayer(step, choice, id)) } : {})}
      onTouch={(touch) => setTouches((now) => ({ ...now, [id]: touch }))}
    />
  )

  const { deck, aside, faceUp } = middlePlaces()
  const dealing = dealPlace()
  return (
    <>
      {view.players.map((player) => {
        const line = placed.get(player.id)!
        const viewer = player.id === meId
        const lit = stateOf(player.id)
        const areaZ = (line.play.minZ + line.play.maxZ) / 2
        // the hand of an opponent: a few backs, only counted, or their cards face up once a round that ended on a comparison laid them down
        const flat = !viewer && player.hand !== null
        const middle = pointInFrame(line.seat, centreOf(line.play))
        return (
          <group key={player.id}>
            {/* The plate stands on the middle's side of the cards, in the frame of the seat, turned as the name reads: the avatar and the name, the status and the favor tokens beside the name */}
            <PlayerSeat
              id={player.id}
              frame={line.seat}
              above={line.cards}
              status={statusOf(player, view, words)}
              font={lettering.display}
              nameStyle={{ weight: lettering.weight }}
              lineStyle={{ weight: lettering.weight }}
              trailing={<Tokens id={player.id} count={player.tokens} color={theme.accent} />}
            />
            {/* What lies in front of the player: every card they played or discarded this round, face up, oldest first, in a row on the axis of their seat. A player who is out has them grey */}
            <Zone
              frame={line.seat}
              layout={areaPoses(player.area.length, line.area, areaZ)}
              size={CARD_SIZE}
              cards={player.area.map((face) => cardOf(face, player.out ? { state: "out" as const } : lit ? { state: lit } : {}))}
            />
            {/* An opponent's hand: a small fan of backs that stands, with a round shadow under it. The viewer's own is held on the screen */}
            {!viewer &&
              (flat ? (
                <Zone frame={line.seat} layout={revealedPoses(player.hand!.length, line)} size={CARD_SIZE} cards={player.hand!.map((face) => cardOf(face))} />
              ) : (
                <HeldHand
                  count={onStartScreen ? 0 : player.cards}
                  frame={line.seat}
                  layout={(n) => heldLayout(n, line.seat)}
                  size={CARD_SIZE}
                  back={faces.back}
                  {...(entering ? { enter: { ...entering, delay: drawn.get(player.id) ?? 0 } } : {})}
                  shadow={HELD_SHADOW}
                  {...(lit ? { state: lit } : {})}
                />
              ))}
            {/* A player with no card to light is chosen too: a pool of light lies where their cards would */}
            {lit && player.area.length === 0 && (player.cards === 0 || viewer) && (
              <LightPool size={{ width: CARD.width * line.area.scale, height: CARD.height * line.area.scale }} state={lit} position={[middle.x, 0.012, middle.z]} yaw={line.seat.yaw} />
            )}
            {choosable.includes(player.id) && hotspot(player.id, line)}
          </group>
        )
      })}

      {/* The viewer's hand, held at the bottom left of the screen: one card between turns, two on their turn (the card drawn last), three while a Chancellor is read */}
      {meId && (
        <ScreenHand settings={HAND_SETTINGS}>
          {(screen) => <Zone layout={screenHandLayout(hand.length, screen, CARD_SIZE, HAND_SETTINGS, raised)} size={CARD_SIZE} {...(entering ? { enter: screen.local(entering) } : {})} cards={handCards(screen.local)} />}
        </ScreenHand>
      )}

      {/* The deck: only its size is known, so it is a count, face down, which the pile writes under itself */}
      <Pile frame={{ x: deck.x, z: deck.z }} count={view.deck.size} size={CARD_SIZE} back={faces.back} scale={LAYOUT_SETTINGS.deckScale} limit={14} />

      {/* The card set aside face down, apart from the deck: which one it is, nobody knows. At two players three more are set aside face up, and everybody reads them */}
      {view.aside === 1 && <Zone frame={{ x: aside.x, z: aside.z }} layout={[onTable(0, 0, { face: "down", scale: LAYOUT_SETTINGS.asideScale, yaw: 0.14 })]} size={CARD_SIZE} cards={[{ key: "aside", front: faces.back, back: faces.back }]} />}
      {view.faceUp.length > 0 && <Zone frame={{ x: faceUp.x, z: faceUp.z }} layout={faceUpPoses(view.faceUp.length)} size={CARD_SIZE} cards={view.faceUp.map((face) => cardOf(face))} />}

      {/* Between two rounds the player who takes the first turn deals the next one: the one action of the game that has no object */}
      {step.kind === "deal" && <FloorButton at={dealing} width={dealing.width} depth={dealing.depth} tone="primary" label={words.deal} disabled={busy} onPress={() => apply({ kind: "send", action: { type: "deal" } })} />}

      {/* What the last move shows to be read: a Guard's guess, a Priest's look, a Baron's comparison, a King's trade, in the middle of the table for the time it takes to read it */}
      {reveal && (
        <RevealView reveal={reveal} faces={faces} originOf={handOf} onHover={(id, type, over) => (over && type ? holdHovered({ id, type, source: faces.source(type) }) : releaseHovered(id))} />
      )}

      {/* A Guard's guess: the nine characters it can name, as small faces. A press names one, and the Guard is played; the lens reads the one under the pointer */}
      {step.kind === "guess" && (
        <Zone
          layout={guessPoses()}
          size={CARD_SIZE}
          cards={GUESSES.map((type, i) => ({
            key: `guess-${type}`,
            front: faces.face(type),
            back: faces.back,
            state: busy ? ("base" as const) : ("interactive" as const),
            onPress: () => apply(pressName(step, type)),
            ariaLabel: names[type],
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
  // The mat is data, the kit lays it: the table is its edge colour, flat and endless, with no grain and no picture, and the pool of light the cards lie on, `surface` in the middle falling away to `surfaceDark`, is the only thing on it that changes
  return (
    <Table camera={camera} photo={PHOTO} surface={{ color: theme.surfaceDark, light: { center: theme.surface, radius: POOL_RADIUS } }} held={props.held} onLoaded={props.onLoaded}>
      <World {...props} />
    </Table>
  )
}

