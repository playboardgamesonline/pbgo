"use client"

import { useState } from "react"
import { DiceIcon, PlayIcon, TrophyIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { GamePick } from "@pbgo/ui/platform/game-pick"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { QUEUE_MODE_LABELS, QUEUE_MODES, type QueueMode } from "@pbgo/ui/queue"
import { cn } from "@pbgo/ui/utils"
import { joinQueue, leaveQueue, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useAgeGate } from "./age-gate"

/** A game that a search can look for, one that can be played now, with the picture its tile draws (`gamePicture`). `refusal` is what the member has to do before they may play it when it asks for an age (PLT-125): the queue lives in the browser with no server to refuse them, so the search asks first. */
export type FindableGame = { slug: string; name: string; picture?: string; logo?: string; refusal?: AgeRefusal | null }

/** What each kind of table is, in a line: ranked is the one that counts for the rank and has no helpers (PLT-21), the other is for playing. */
const MODES: Record<QueueMode, { icon: IconSvgElement; hint: string }> = {
  ranked: { icon: TrophyIcon, hint: "Counts for your rank. No helpers." },
  normal: { icon: DiceIcon, hint: "Doesn't change your rank." },
}

function Group({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm text-muted-foreground">{title}</h3>
        {aside && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {aside}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * Find a game, on the signed-in home, the larger of the two cards that open the play zone (two thirds of the row from `xl`, three fifths from `lg`, on a surface a step lighter than the other containers, `--card-bar`, which is what is read first): look for a table
 * among the games the visitor picks, against players they do not know (PLT-21). The games are tiles to press (`GamePick`), all picked to begin with; under them the kind of table, ranked or normal, two options to choose between, the ranked one
 * with its rank and no helpers said in a line; at the foot, a small button with a play icon starts the search, "Play ranked" or "Play normal" (`QueueButton`). A search is the platform's one queue (`lib/matchmaking.ts`, which the social panel shows
 * too): it counts on the button, with a cross that stops it, and the card shows the search that is on, whichever page began it, its games and its kind of table, and cannot be changed until it is stopped. Nothing is found for the visitor yet:
 * the counter runs until they stop it.
 */
export function HomeFindGame({ games, className }: { games: readonly FindableGame[]; className?: string }) {
  const [picked, setPicked] = useState<readonly string[]>(() => games.map((game) => game.slug))
  const [mode, setMode] = useState<QueueMode>("ranked")
  const queue = useQueue()
  const { demand, dialog: ageDialog } = useAgeGate()
  const seconds = useQueueSeconds(queue)
  const searching = queue !== null
  // What the card shows is the search when there is one, else what the visitor has set up so far
  const chosen = queue ? queue.games.map((game) => game.slug) : picked
  const shownMode = queue ? queue.mode : mode
  const asked = games.filter((game) => picked.includes(game.slug))

  return (
    <Card className={cn("h-full gap-8 [--card:var(--card-bar)] md:[--card-spacing:--spacing(8)]", className)}>
      <CardHeader>
        <CardTitle className="text-4xl md:text-5xl">Find a game</CardTitle>
        <CardDescription className="text-base">Pick the games you like and play against other players.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <Group title="Games" aside={games.length > 0 ? (chosen.length === 0 ? "Pick at least one game" : `${chosen.length} selected`) : undefined}>
          {games.length > 0 ? (
            <div role="group" aria-label="Games to look for" className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
              {games.map((game, index) => (
                <GamePick
                  key={game.slug}
                  name={game.name}
                  picture={game.picture}
                  logo={game.logo}
                  selected={chosen.includes(game.slug)}
                  onSelectedChange={(on) => setPicked(on ? [...picked, game.slug] : picked.filter((slug) => slug !== game.slug))}
                  disabled={searching}
                  loading={index < 6 ? "eager" : "lazy"}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The games you can play are listed here.</p>
          )}
        </Group>
        <Group title="Mode">
          <ToggleGroup type="single" value={shownMode} disabled={searching} onValueChange={(next) => next && setMode(next as QueueMode)} aria-label="Kind of table" className="grid grid-cols-2 gap-3">
            {QUEUE_MODES.map((value) => (
              // A search that is on keeps the kind it was started with as strong as when it is set: a value to read is not a control that is off
              <ToggleGroupItem
                key={value}
                value={value}
                className="h-auto flex-col items-start justify-start gap-1.5 rounded-2xl p-4 text-left whitespace-normal data-[state=on]:disabled:opacity-100"
              >
                <span className="flex items-center gap-2 text-base">
                  <HugeiconsIcon icon={MODES[value].icon} strokeWidth={2} aria-hidden="true" />
                  {QUEUE_MODE_LABELS[value]}
                </span>
                <span className="text-sm text-muted-foreground group-data-[state=on]/toggle-item:text-primary-foreground/70">{MODES[value].hint}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Group>
      </CardContent>
      <CardFooter className="mt-auto justify-end">
        <QueueButton
          size="lg"
          searching={searching}
          seconds={seconds}
          disabled={asked.length === 0}
          onSearch={async () => {
            // A game for adults needs the member's date of birth before the search begins
            if (asked.some((game) => game.refusal === "date") && !(await demand("date"))) return
            joinQueue(asked, mode)
          }}
          onCancel={leaveQueue}
        >
          <HugeiconsIcon icon={PlayIcon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
          Play {QUEUE_MODE_LABELS[shownMode].toLowerCase()}
        </QueueButton>
      </CardFooter>
      {ageDialog}
    </Card>
  )
}
