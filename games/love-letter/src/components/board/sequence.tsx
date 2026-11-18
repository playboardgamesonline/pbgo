"use client"

import type { CharacterKey } from "@love-letter/engine"
import { onTable, TableText, Zone, type ZoneCard } from "@pbgo/table"
import { useEffect, useState } from "react"
import type { Pose } from "@pbgo/table"
import { TABLE_WEIGHT } from "./fonts"
import { fitSentence, STRIP } from "./layout"
import type { Reveal } from "./pacing"
import { CARD_SIZE, type Faces } from "./textures"

/** Where the faces of a reveal lie, in the middle of the table where the strip is: one in the middle, two a card and a half apart, with what happened written above them where the sentence of the strip is */
const REVEAL = { z: 0.55, y: 0.2, scale: 0.9, apart: 1.9 }

/**
 * The reveal of the last move that is on the table now, if one is: the log says what was shown and to whom, and `timelineOf` when, so the board shows each in its turn for the time it takes to read, and then it is gone. A reveal is for the eyes of the viewer, so it
 * is no part of the table (the view): nothing in the state remembers it. Re-run when the move changes (`v`).
 */
export function useReveal(v: number, reveals: readonly Reveal[]): Reveal | null {
  const [current, setCurrent] = useState<{ v: number; reveal: Reveal | null }>({ v: 0, reveal: null })
  useEffect(() => {
    const timers = reveals.flatMap((reveal) => [
      setTimeout(() => setCurrent({ v, reveal }), reveal.at * 1000),
      setTimeout(() => setCurrent((now) => (now.reveal === reveal ? { v, reveal: null } : now)), (reveal.at + reveal.duration) * 1000),
    ])
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the reveals are the ones of the move `v`: a new move starts new timers, and the same move is not timed twice
  }, [v])
  // a reveal of an older move is never shown
  return current.v === v ? current.reveal : null
}

export type RevealProps = {
  reveal: Reveal
  faces: Faces
  /** What the reveal says under the faces: who did what, in the history's words */
  caption: string
  ink: string
  font: string | undefined
  /** Where a card of a player's hand lies, for the faces that come out of a hand (the Priest's, the Baron's, the King's) */
  originOf: (playerId: string) => Pose
  /** The lens of the screen reads the face under the pointer: told which one, or that the pointer left it */
  onHover: (id: number, type: CharacterKey | null, over: boolean) => void
}

/**
 * A reveal on the table: the faces it is about (a back for a card the viewer was not told) side by side in the middle, over everything, and under them what happened. A Priest's look and a Baron's comparison come out of the hands they are about.
 */
export function RevealView({ reveal, faces, caption, ink, font, originOf, onHover }: RevealProps) {
  const { cards, owners } = reveal
  const x = (i: number) => (i - (cards.length - 1) / 2) * REVEAL.apart
  const { lines, height } = fitSentence(caption, STRIP.sentence.width, STRIP.sentence.height)
  return (
    <>
      <Zone
        layout={cards.map((type, i) => onTable(x(i), REVEAL.z, { y: REVEAL.y, scale: REVEAL.scale, face: type ? "up" : "down" }))}
        size={CARD_SIZE}
        cards={cards.map(
          (type, i): ZoneCard => ({
            key: `reveal-${reveal.at}-${i}`,
            front: type ? faces.face(type) : faces.back,
            back: faces.back,
            above: true,
            from: owners[i] ? { ...originOf(owners[i]!), delay: 0 } : undefined,
            onHover: (over) => onHover(-100 - i, type, over),
          }),
        )}
      />
      {lines.map((line, i) => (
        <TableText key={`${i}:${line}`} text={line} style={{ color: ink, weight: TABLE_WEIGHT, shadow: "rgba(0,0,0,0.6)|10|3" }} height={height} position={[0, 0.02, STRIP.sentence.z + i * height * 1.25]} font={font} />
      ))}
    </>
  )
}
