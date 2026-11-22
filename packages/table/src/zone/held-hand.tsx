"use client"

import { useState } from "react"
import type { Texture } from "three"
import type { CardSize } from "../card/geometry"
import type { CardState } from "../card/states"
import type { Spot } from "../layout"
import type { Pose } from "../pose"
import { HandShadow } from "./hand-shadow"
import { heldKeysFor, leftEndIsFirst, NO_KEYS } from "./held-hand-keys"
import { Zone } from "./zone"

export type HeldHandProps = {
  /** How many cards the player holds: all that is known of a hand nobody but its owner sees */
  count: number
  /** The frame of the seat the hand is laid in (`seats`, turned toward the middle of the table) */
  frame: Spot
  /** The slots of a hand of `n` cards, in the frame: a `fan` with the faces down, that stands up */
  layout: (count: number) => Pose[]
  size: CardSize
  /** The picture on the back of every card, which is all the table shows of them */
  back: Texture
  /** Where the cards come in from, on the table (a `Zone`'s `enter`) */
  enter?: Pose
  /** The small round shadow under the hand: how far it reaches for a hand of `n` cards, and how dark it is at its middle. Without it the hand casts none */
  shadow?: { radius: (count: number) => number; opacity?: number }
  /** How every card of the hand stands for the player (`state` of a `Card`): `interactive` while the player whose hand it is can be chosen, raised to `hover` and `pressed` by the game from what a `Hotspot` over the hand tells it. Without it the cards are drawn as they are */
  state?: CardState
}

/**
 * The cards another player holds, seen from behind as a hand: a fan of backs in the frame of their seat, with a small round shadow on the table under it. The view says how many there are and no more, so the cards are named by the rule of `heldKeysFor`: a card that is played
 * leaves from the left end of the fan, as the viewer sees it, a card that is drawn comes in at the right end, and the others glide to their new slots. Where a card played from it flies from is `heldLeftPose`.
 */
export function HeldHand({ count, frame, layout, size, back, enter, shadow, state }: HeldHandProps) {
  // The names of the cards, kept from one render to the next and worked out from the count
  const [held, setHeld] = useState(NO_KEYS)
  const now = heldKeysFor(held, count, leftEndIsFirst(frame, layout))
  if (now !== held) setHeld(now)
  return (
    <>
      {shadow && count > 0 && <HandShadow at={frame} radius={shadow.radius(count)} {...(shadow.opacity === undefined ? {} : { opacity: shadow.opacity })} />}
      <Zone frame={frame} layout={layout(count)} size={size} enter={enter} cards={now.keys.map((key) => ({ key, front: back, back, ...(state ? { state } : {}) }))} />
    </>
  )
}
