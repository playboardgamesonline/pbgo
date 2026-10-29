"use client"

import * as React from "react"
import { PLAYFUL } from "@pbgo/ui/motion"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { TitleCards } from "@pbgo/ui/platform/title-cards"
import { TitleCoin } from "@pbgo/ui/platform/title-coin"
import { TitleDie } from "@pbgo/ui/platform/title-die"
import { TitleSuits } from "@pbgo/ui/platform/title-suits"

// The three moves of the pieces of the home's title that were chosen here (the die: an expo snap; the coin: a toss pulse; the suits: a wheel), among five each, and calmed a little. The pieces are the real ones,
// the same that the home mounts, at a faster tempo so that they can be watched (a roll every few seconds instead of every fifteen), and the values written under them are read from `PLAYFUL` of `@pbgo/ui/motion`,
// which the pieces read too: there is one place to change them. "Replay" mounts the piece again, which plays it at once.

const bezier = (curve: readonly number[]) => `cubic-bezier(${curve.join(", ")})`
const spring = (s: { stiffness: number; damping: number }) => `spring · stiffness ${s.stiffness} · damping ${s.damping}`

type Move = {
  id: string
  name: string
  note: string
  /** The parts of the move and the values they take: [what, how]. */
  specs: readonly (readonly [string, string])[]
  /** The piece in its word, mounted again each time it is replayed. */
  stage: React.ReactNode
}

const { die, coin, cards } = PLAYFUL
const { wheel } = PLAYFUL.suit

const MOVES: readonly Move[] = [
  {
    id: "die",
    name: "The die: an expo snap",
    note: "Rolls from the left to the right, 2 or 3 whole turns and a few quarters, and switches between a 6 and a 3: each roll lands on the one it does not show. Slow to wake up, then all at once, then a long gentle stop, and it swells toward you as it flies. Every 15 s on the home, every 6 s here.",
    specs: [
      ["roll", `${die.turns.min} or ${die.turns.max} whole turns, then the quarters to switch between a ${die.lands.join(" and a ")} · ${bezier(die.ease)} · ${die.secondsATurn} s a turn`],
      ["swell", `scale 1 → ${die.swell} → 1 · the whole roll · ease-in-out`],
    ],
    stage: (
      <>
        b
        <span data-slot="title-piece" data-kind="die" className="title-piece">
          <TitleDie first={400} every={6000} />
        </span>
        a
      </>
    ),
  },
  {
    id: "coin",
    name: "The coin: a toss pulse",
    note: "Tossed from the top to the bottom for 1 or 2 whole turns, always back on its profile. It dips as if gathering itself, swells toward you at the top of the toss, and lands with a squash that springs back. Every 25 s or so on the home, every 8 s here.",
    specs: [
      ["spin", `${coin.turns.min} or ${coin.turns.max} whole turns · ${bezier(coin.ease)} · ${coin.secondsATurn} s a turn`],
      ["pulse", `scale 1 → ${coin.dip} → ${coin.swell} → 1 · the whole spin · ease-in-out`],
      ["landing", `scale ${coin.squash} · 0.07 s · ${spring(coin.landing)}`],
    ],
    stage: (
      <>
        y
        <span data-slot="title-piece" data-kind="coin" className="title-piece">
          <TitleCoin first={500} rest={1500} />
        </span>
        u
      </>
    ),
  },
  {
    id: "cards",
    name: "The cards: a fold",
    note: "The two cards after \"games\" fold up: the fan closes, the cards straighten and come together, stay closed for a beat, then open again on a spring, a little wider than they stand before they settle. Every 15 s on the home, every 4 s here.",
    specs: [
      ["fold", `${cards.fold} s · ${bezier(cards.ease)} · to ${cards.closed.turn}° each, ${cards.closed.gap} em apart`],
      ["hold", `${cards.hold} s, closed`],
      ["open", spring(cards.open)],
    ],
    stage: (
      <>
        games
        <TitleCards className="inline-block" first={400} every={4000} />
      </>
    ),
  },
  {
    id: "suit",
    name: "The suits: a wheel",
    note: "Scrolls up like the reel of a slot machine, through the suits in turn (a red one, a white one), faded at the top and at the bottom of its window, with a wind-up and then slower and slower, blurred up and down as it speeds up, a little past its stop and back on a spring, and always stops on the heart. Every 15 s on the home, every 7 s here.",
    specs: [
      ["turn", `${wheel.laps.min} or ${wheel.laps.max} whole laps of the four suits (${wheel.laps.min * 4} or ${wheel.laps.max * 4} places), back on the heart · ${bezier(wheel.ease)} · ${wheel.secondsAPlace} s a place`],
      ["fade", "0.3 em at the top and at the bottom of the window · the suit at rest is whole"],
      ["blur", `up and down only · a deviation of ${wheel.blur.perPlaceASecond} em a place a second, ${wheel.blur.max} em at most`],
      ["stretch", `scale y 1 + ${wheel.stretch} a place a second, ${wheel.maxStretch} at most`],
      ["stop", `${wheel.overshoot} of a place past, then ${spring(wheel.settle)}`],
    ],
    stage: (
      <>
        v
        <span data-slot="title-piece" data-kind="suits" className="title-piece">
          <TitleSuits first={400} every={7000} />
        </span>
        r
      </>
    ),
  },
]

function MoveCard({ move }: { move: Move }) {
  const [run, setRun] = React.useState(0)
  return (
    <article className="flex flex-col gap-3 rounded-3xl border bg-card p-3">
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-background">
        <p aria-hidden="true" className="display-title text-[5.5rem] leading-none text-foreground" key={run}>
          {move.stage}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <h4 className="flex items-center gap-2 font-heading text-base">
          <Badge variant="secondary">{move.id}</Badge>
          {move.name}
        </h4>
        <Button type="button" variant="outline" size="sm" onClick={() => setRun((value) => value + 1)}>
          Replay
        </Button>
      </div>
      <p className="px-1 text-sm text-muted-foreground">{move.note}</p>
      <dl className="flex flex-col gap-1.5 px-1 font-mono text-xs tracking-normal">
        {move.specs.map(([what, how]) => (
          <div key={what} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{what}</dt>
            <dd className="text-foreground">
              {/* Each part of a value stays on one line (a curve is not cut at its hyphen), and the line breaks between the parts */}
              {how.split(" · ").map((part, index) => (
                <React.Fragment key={part}>
                  {index > 0 && " · "}
                  <span className={part.length > 40 ? undefined : "whitespace-nowrap"}>{part}</span>
                </React.Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

/** The three moves that were chosen, each on the page's black. */
export function TitleMotionLab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {MOVES.map((move) => (
        <MoveCard key={move.id} move={move} />
      ))}
    </div>
  )
}
