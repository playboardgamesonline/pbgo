"use client"

import { FloorButton, mix, TableText } from "@pbgo/table"
import type { Vocabulary } from "../../lib/words"
import { TABLE_WEIGHT } from "./fonts"
import { fitSentence, type Pad, padPlace, pairPlaces, STRIP } from "./layout"
import type { Step } from "./turn"

/** The tones of the pads, from the settings' theme (`accent`, `foreground`): the pads are the accent, the Swap pad is paler, so that the pad that sends reads first */
export type Tones = { pad: string; quiet: string }

export const tonesOf = ({ accent, foreground }: { accent: string; foreground: string }): Tones => ({
  pad: accent,
  quiet: mix(accent, foreground, 0.55),
})

/** The fonts of the lettering on the pads and in the strip: the digits of a value are in the table's own font, since the display font's digit one is a capital I */
export type Fonts = { display: string | undefined; body: string | undefined }

/** What the strip says, for what is offered: a card to choose, a player, a character, a card to keep; nothing when the pad says it all */
function sentenceOf(step: Step, words: Vocabulary): string {
  switch (step.kind) {
    case "pick":
      return step.forced ? words.mustPlayCountess : words.pickCard
    case "pad":
      return step.empty ? words.noTarget : ""
    case "target":
      return step.self ? words.chooseAny : words.chooseOther
    case "guess":
      return words.nameCharacter
    case "keep":
      return words.keepOne
    case "order":
      return step.others.length > 1 ? words.putBack : ""
    default:
      return ""
  }
}

type PadProps = { pad: Pad; label: string; tone: string; font: string | undefined; disabled: boolean; onPress: () => void }

function PadButton({ pad, label, tone, font, disabled, onPress }: PadProps) {
  return <FloorButton at={{ x: pad.x, z: pad.z }} width={pad.width} depth={pad.depth} tone={tone} label={label} font={font} weight={TABLE_WEIGHT} disabled={disabled} onPress={onPress} />
}

export type StripProps = {
  step: Step
  /** What to say when there is nothing to press: the viewer is out, or another player deals the next round (already in words) */
  note?: string
  words: Vocabulary
  tones: Tones
  /** The colours of the sentence: the ink, and the accent for a rule that holds the player back */
  ink: string
  accent: string
  fonts: Fonts
  /** How wide a sentence is over the height of its lettering in the body font, as the browser measures it (`sentenceMeasure`): the sentence is set on one line when it fits */
  measure?: (text: string) => number
  /** A move is on its way to the server: the pads wait for the answer */
  busy: boolean
  onPlay: () => void
  onKeep: () => void
  onSwap: () => void
  onDeal: () => void
}

/**
 * The strip in the middle of the table (`STRIP` of the layout): the sentence that says what to do, written flat on the table, and the pad of the moment, one thing at a time: Play, Swap and Keep after a Chancellor, Deal between two rounds. The nine characters of a Guard's
 * guess are small faces that the scene draws in the same strip, under the sentence. It lies in the middle band, never in the bottom of the window that the cookie banner covers.
 */
export function Strip({ step, note = "", words, tones, ink, accent, fonts, measure, busy, onPlay, onKeep, onSwap, onDeal }: StripProps) {
  const { lines, height } = fitSentence(step.kind === "none" ? note : sentenceOf(step, words), STRIP.sentence.width, STRIP.sentence.height, measure)
  const held = step.kind === "pick" && step.forced
  const [swap, keep] = pairPlaces()
  return (
    <>
      {lines.map((line, i) => (
        <TableText
          key={`${i}:${line}`}
          text={line}
          style={{ color: held ? accent : ink, weight: TABLE_WEIGHT, shadow: "rgba(0,0,0,0.6)|10|3" }}
          height={height}
          position={[0, 0.02, STRIP.sentence.z + (i - (lines.length - 1) / 2) * height * 1.25]}
          font={fonts.body}
        />
      ))}
      {step.kind === "pad" && <PadButton pad={padPlace()} label={words.play} tone={tones.pad} font={fonts.display} disabled={busy} onPress={onPlay} />}
      {step.kind === "deal" && <PadButton pad={padPlace()} label={words.deal} tone={tones.pad} font={fonts.display} disabled={busy} onPress={onDeal} />}
      {step.kind === "order" && step.others.length === 1 && <PadButton pad={padPlace()} label={words.keep} tone={tones.pad} font={fonts.display} disabled={busy} onPress={onKeep} />}
      {step.kind === "order" && step.others.length > 1 && (
        <>
          <PadButton pad={swap} label={words.swap} tone={tones.quiet} font={fonts.display} disabled={busy} onPress={onSwap} />
          <PadButton pad={keep} label={words.keep} tone={tones.pad} font={fonts.display} disabled={busy} onPress={onKeep} />
        </>
      )}
    </>
  )
}

/** The number of the place a card put back takes under the deck (1: the first to go in, 2: the last card of the deck), drawn on the face of the card in a disc of the accent, in the table's own font */
export function OrderMarker({ place, color, ink, font }: { place: number; color: string; ink: string; font: string | undefined }) {
  return (
    <group position={[0, 0.12, 0.012]}>
      <mesh renderOrder={4}>
        <circleGeometry args={[0.3, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.94} toneMapped={false} depthWrite={false} />
      </mesh>
      <group rotation-x={Math.PI / 2}>
        <TableText text={String(place)} style={{ color: ink, weight: TABLE_WEIGHT }} height={0.4} position={[0, 0.012, 0]} layer={6} font={font} />
      </group>
    </group>
  )
}
