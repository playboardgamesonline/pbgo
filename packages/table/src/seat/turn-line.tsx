"use client"

import { useGame } from "@pbgo/core/components/game/context"
import { useOptionalSiteSettings } from "@pbgo/core/components/settings-provider"
import { useText } from "@pbgo/core/components/skin-provider"
import { shortName } from "@pbgo/core/lib/short-name"
import { usePrefersReducedMotion } from "@pbgo/core/lib/use-motion"
import { useFrame } from "@react-three/fiber"
import { easing } from "maath"
import { useEffect, useRef } from "react"
import type { Group } from "three"
import { useLettering } from "../lettering"
import { TableText, type TextStyle } from "./table-text"
import { LINE_LEADING, setLine, turnSentence, whoseTurn } from "./turn"

/** The text colour of a table that has no game's settings above it (the specimens of the docs): the plates' own */
const INK = "#f5f2ea"
/** How high above the table the lettering lies */
const TEXT_Y = 0.02
/** The size of the lettering unless a board gives its own, in world units: a little larger than the name on a plate */
export const TURN_LINE_HEIGHT = 0.7

export type TurnLineProps = {
  /** Where the line is centred on the table */
  at: { x: number; z: number }
  /** The size of the lettering, in world units (default `TURN_LINE_HEIGHT`) */
  height?: number
  /** The widest the line may be, in world units: a longer sentence (the names of several players at once) is broken in two lines, and set in smaller letters only if two lines are not enough */
  maxWidth?: number
  /** What is changed in the style of the lettering */
  style?: Partial<TextStyle>
  /** The CSS font of the lettering; the game's display font by default (`useLettering`) */
  font?: string
}

/**
 * The sentence of the turn line, written flat on the table in the game's lettering: what `TurnLine` draws once it has read the game, for a scene outside a game (the specimens of the docs) or a board that words the line itself. `null` draws nothing. When the sentence
 * changes it settles in, and a visitor who asks for less motion has it at once.
 */
export function TurnText({ text, at, height = TURN_LINE_HEIGHT, maxWidth, style, font }: TurnLineProps & { text: string | null }) {
  const lettering = useLettering()
  const ink = useOptionalSiteSettings()?.theme.foreground ?? INK
  const reduced = usePrefersReducedMotion()
  const group = useRef<Group>(null)
  const settle = useRef({ value: 1 })
  const shown = useRef(text)
  useEffect(() => {
    if (shown.current === text) return
    shown.current = text
    settle.current.value = 0
  }, [text])
  useFrame((_, dt) => {
    if (reduced) settle.current.value = 1
    else easing.damp(settle.current, "value", 1, 0.1, dt)
    group.current?.scale.setScalar(0.92 + 0.08 * settle.current.value)
  })
  if (text === null) return null
  const set = setLine(text, height, maxWidth)
  return (
    <group ref={group} position={[at.x, TEXT_Y, at.z]}>
      {set.lines.map((line, i) => (
        <TableText
          key={i}
          text={line}
          style={{ color: ink, weight: lettering.weight, shadow: "rgba(0,0,0,0.6)|12|4", ...style }}
          height={set.height}
          position={[0, 0, (i - (set.lines.length - 1) / 2) * set.height * LINE_LEADING]}
          font={font ?? lettering.display}
        />
      ))}
    </group>
  )
}

/**
 * The one line of the table that says whose turn it is: "It's your turn" when the game waits for the viewer, "Ann's turn" when it waits for another player, "Waiting for Ann, Bob" when it waits for several others at once (a simultaneous step); nothing while the game does
 * not wait for anybody, before it starts and once it is over. It is the platform's words in the visitor's language (`yourTurn`, `turnOf`, `waitingFor`) and what the table says (`waitingFor`, `meId`: `whoseTurn`), so a game gives it only a place, and its board has no turn
 * marker of its own to keep up. It is lettering laid flat on the table, in the game's lettering, and takes no pointer.
 */
export function TurnLine(props: TurnLineProps) {
  const { game, nickname } = useGame()
  const t = useText()
  const text = turnSentence(whoseTurn({ status: game.status, waitingFor: game.waitingFor, meId: game.meId }), t, (id) => shortName(nickname(id)))
  return <TurnText text={text} {...props} />
}
