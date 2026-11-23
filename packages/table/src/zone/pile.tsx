"use client"

import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { useState } from "react"
import type { Texture } from "three"
import { cardRise, effectiveState, NO_TOUCH, type Touch } from "../card/states"
import type { CardSize } from "../card/geometry"
import { ActionLabel } from "../floor/action-label"
import { pile, type PileOptions, type Spot } from "../layout"
import { useLettering } from "../lettering"
import type { Pose } from "../pose"
import { TableText } from "../seat/table-text"
import { PILE_LABEL_HEIGHT, pileAboveAt, pileFootprint, pileLabelAt } from "./pile-label"
import { Zone, type ZoneCard } from "./zone"

/** The text colour of a table that has no game's settings above it (the specimens of the docs): the plates' own */
const INK = "#f5f2ea"

/** The top card of a pile once it is turned up: its front, and whatever else a `Card` takes (glow, onClick...) */
export type PileTop = Partial<Omit<ZoneCard, "key" | "back">>

/** What pressing a pile does, said over it: the word with its arrow (`ActionLabel`), and the pile's top card that does it */
export type PileAction = {
  /** The word, in the game's words and the visitor's language: one or two ("Draw") */
  label: string
  /** Pressing the top card of the pile, or the word over it, does this */
  onPress: () => void
  /** What a screen reader says of the top card and what the keyboard focus lands on; `label` when not given */
  ariaLabel?: string
  /** The most width the word takes along the table, in world units (`LABEL_ROOM` when not given): the room between this pile's word and the next */
  room?: number
}

/** The most cards a pile draws unless told otherwise: a pile of 90 looks no different from one of 24 and costs 66 more cards to draw */
const LIMIT = 24

export type PileProps = Omit<PileOptions, "face" | "topFace"> & {
  /** Where the pile lies on the table (default: the middle) */
  frame?: Spot
  /** How many cards it holds */
  count: number
  /** The size of every card */
  size: CardSize
  /** The back of the cards */
  back: Texture
  /** The top card turned up: give it a `front`. Without one the whole pile lies face down */
  top?: PileTop
  /** The most cards drawn (default 24) */
  limit?: number
  /** Where the cards come in from, on the table, a `stagger` apart (see `Zone`) */
  enter?: Pose
  stagger?: number
  /** Writes how many cards the pile holds under it, in the lettering of the plates (default true; nothing while it holds none). Leave it out for a pile that a board counts another way */
  label?: boolean
  /** The pile can be pressed, and the word over it says what that does ("Draw"). The top card is in the `interactive` state, with this press and this name for the keyboard, and the word and the card light each other. Give none when the pile cannot be pressed, and no word is drawn */
  action?: PileAction
}

/**
 * A pile of cards the game only counts: a deck, a discard pile. All face down but the top one, if given a front.
 * Every card is keyed by its height in the pile, so when the top card changes the one below turns face down where it lies: for a pile of cards the game names, use a `Zone` over `pile(n, { face: "up" })`
 */
export function Pile({ frame, count, size, back, top, limit = LIMIT, enter, stagger, label = true, action, ...options }: PileProps) {
  const lettering = useLettering()
  const ink = useOptionalSiteSettings()?.theme.foreground ?? INK
  const n = Math.max(0, Math.min(Math.floor(count), limit))
  const at = pileLabelAt(frame, size, options.scale)
  const layout = pile(n, { ...options, face: "down", topFace: top?.front ? "up" : "down" })
  // What the visitor does to the word over the pile, which lights the top card as it lights the word, and whether the pointer is over the top card, which lights the word
  const [touch, setTouch] = useState<Touch>(NO_TOUCH)
  const [over, setOver] = useState(false)
  const acting = !!action && n >= 1
  // A pile that cannot be pressed any more has no pointer over it that matters: it starts again from nothing when it can
  const [wasActing, setWasActing] = useState(acting)
  if (acting !== wasActing) {
    setWasActing(acting)
    if (!acting) setOver(false)
  }
  const topCard: PileTop | undefined =
    acting && action
      ? {
          ...top,
          state: effectiveState("interactive", touch),
          onPress: action.onPress,
          ariaLabel: action.ariaLabel ?? action.label,
          onHover: (hovered) => {
            setOver(hovered)
            top?.onHover?.(hovered)
          },
        }
      : top
  const cards: ZoneCard[] = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? { ...topCard, key: `pile-${i}`, front: topCard?.front ?? back, back } : { key: `pile-${i}`, front: back, back },
  )
  return (
    <>
      <Zone frame={frame} layout={layout} size={size} enter={enter} stagger={stagger} cards={cards} />
      {acting && action && (
        <ActionLabel
          at={pileAboveAt(frame, layout[n - 1]?.position.y)}
          over={pileFootprint(frame, size, options.scale)}
          label={action.label}
          onPress={action.onPress}
          touch={{ hovered: over, focused: false, pressed: false }}
          onTouch={setTouch}
          room={action.room}
          rise={cardRise(size, options.scale)}
        />
      )}
      {label && count >= 1 && (
        // the count the pile holds, not the cards it draws: a pile of 90 draws 24
        <TableText text={String(Math.floor(count))} style={{ color: ink, weight: lettering.weight, shadow: "rgba(0,0,0,0.6)|12|4" }} height={PILE_LABEL_HEIGHT} position={[at.x, 0.02, at.z]} font={lettering.display} />
      )}
    </>
  )
}
