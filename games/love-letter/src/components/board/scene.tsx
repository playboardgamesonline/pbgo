"use client"

import type { Face, PlayerView, PublicSeat } from "@love-letter/engine"
import { useSiteSettings } from "@pbgo/core/components/settings-provider"
import { Counter, onTable, Pile, PlayerSeat, Stack, Table, TableText, useSettings, useViewport, Zone, type ZoneCard } from "@pbgo/table"
import { useDeferredValue, useMemo } from "react"
import { AdditiveBlending } from "three"
import type { ClientCatalog } from "../../lib/catalog"
import { cameraFor, PHOTO } from "./camera"
import { TABLE_WEIGHT, tableFonts } from "./fonts"
import { GLOWS, lightGlows } from "./glows"
import { areaPoses, areas, backsPoses, CARD, fanPoses, faceUpPoses, handOf, LAYOUT_FIELDS, LAYOUT_SETTINGS, middlePlaces, PLATE_TRAILING, plateAt, revealedPoses, seatSpots } from "./layout"
import { matTexture } from "./mat"
import { CARD_SIZE, useFaces } from "./textures"

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

function World({ view, catalog }: SceneProps) {
  // The table's own folders (camera, cards, seats, glows, lights...) are made by the shared `Table`; the game binds the knobs of its layout
  useSettings("Layout", LAYOUT_SETTINGS, LAYOUT_FIELDS, { order: 1 })
  const { theme, bodyFont, displayFont, files } = useSiteSettings()
  // The lettering on the table is drawn in the fonts of the game's settings (the display font for names, counts and plates, the body font for the card texts)
  const fonts = tableFonts({ bodyFont, displayFont, files })
  lightGlows(theme.accent)
  const faces = useFaces(catalog, { nameFont: fonts.display, textFont: fonts.body, ink: theme.surfaceDark })
  const { words } = catalog
  const meId = view.me?.id ?? null
  const ids = view.players.map((player) => player.id)
  const key = ids.join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the ids
  const spots = useMemo(() => seatSpots(ids, meId), [key, meId])
  const placed = useMemo(() => areas(spots, meId), [spots, meId])
  const R = LAYOUT_SETTINGS
  const { deck, aside, faceUp } = middlePlaces()
  const ink = { color: theme.foreground, weight: TABLE_WEIGHT }

  /** A card of the view as the table draws it: its face, the back it lies on, and whether its player is out of the round */
  const cardOf = (face: Face, out = false, glow: ZoneCard["glow"] = null): ZoneCard => ({ key: face.id, id: face.id, front: faces.face(face.type), back: faces.back, out, glow })

  return (
    <>
      {view.players.map((player) => {
        const area = placed.get(player.id)!
        const viewer = player.id === meId
        const hand = handOf(area, viewer)
        const plate = plateAt(spots.get(player.id)!, area, hand)
        const frame = { x: area.at.x, z: area.at.z, yaw: area.yaw }
        // the Handmaid that protects a player is the last one they played: protection ends when their next turn starts, and a player plays one card a turn (a Prince's discard comes after it, a Handmaid stays the last of its kind)
        const handmaid = player.shielded ? [...player.area].reverse().find((face) => face.type === "handmaid") : undefined
        // the hand: faces to its owner, and to everybody once a round that ended on a comparison laid them down; otherwise a few backs, only counted
        const held = viewer ? (view.me?.hand ?? []) : (player.hand ?? [])
        const flat = !viewer && player.hand !== null
        return (
          <group key={player.id}>
            {/* The plate stands beyond the cards, turned the way its text reads (never upside down): the seat is drawn in its own frame, with its centre at the plate's */}
            <group position={[plate.x, 0, plate.z]} rotation-y={plate.yaw} scale={area.plate}>
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
            {/* The hand: the viewer's is a fan of faces that stands up toward them; an opponent's is a few small backs, or their face up cards once the round has laid them down */}
            {viewer ? (
              <Zone frame={{ x: hand.at.x, z: hand.at.z, yaw: 0 }} layout={fanPoses(held.length, hand)} size={CARD_SIZE} cards={held.map((face) => cardOf(face))} />
            ) : flat ? (
              <Zone frame={{ x: hand.at.x, z: hand.at.z, yaw: hand.yaw }} layout={revealedPoses(held.length, hand)} size={CARD_SIZE} cards={held.map((face) => cardOf(face))} />
            ) : (
              <Zone
                frame={{ x: hand.at.x, z: hand.at.z, yaw: hand.yaw }}
                layout={backsPoses(player.cards, hand)}
                size={CARD_SIZE}
                cards={Array.from({ length: player.cards }, (_, i) => ({ key: `back-${player.id}-${i}`, front: faces.back, back: faces.back, out: player.out }))}
              />
            )}
          </group>
        )
      })}

      {/* The deck: only its size is known, so it is a count, face down, with its number under it */}
      <Pile frame={{ x: deck.x, z: deck.z }} count={view.deck.size} size={CARD_SIZE} back={faces.back} scale={R.deckScale} limit={14} />
      <TableText text={String(view.deck.size)} style={ink} height={0.5} position={[deck.x, 0.02, deck.z + (CARD.height * R.deckScale) / 2 + 0.55]} />

      {/* The card set aside face down, apart from the deck: which one it is, nobody knows. At two players three more are set aside face up, and everybody reads them */}
      {view.aside === 1 && <Zone frame={{ x: aside.x, z: aside.z }} layout={[onTable(0, 0, { face: "down", scale: R.asideScale, yaw: 0.14 })]} size={CARD_SIZE} cards={[{ key: "aside", front: faces.back, back: faces.back }]} />}
      {view.faceUp.length > 0 && <Zone frame={{ x: faceUp.x, z: faceUp.z }} layout={faceUpPoses(view.faceUp.length)} size={CARD_SIZE} cards={view.faceUp.map((face) => cardOf(face))} />}
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
