"use client"

import { useState } from "react"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { AgeRefusal } from "@pbgo/accounts"
import { Card, CardContent, CardFooter } from "@pbgo/ui/platform/card"
import { AddGame, PickedGame } from "@pbgo/ui/platform/picked-game"
import { QueueButton } from "@pbgo/ui/platform/queue"
import { ToggleGroup, ToggleGroupItem } from "@pbgo/ui/platform/toggle-group"
import { QUEUE_MODE_LABELS, type QueueMode } from "@pbgo/ui/queue"
import type { Rank } from "@pbgo/ui/ranks"
import { cn } from "@pbgo/ui/utils"
import { leaveQueue, startSearch, useQueue, useQueueSeconds } from "@/lib/matchmaking"
import { useAgeGate } from "./age-gate"

/** A game that a search can look for, one that can be played now, with the picture its tile draws (`gamePicture`) and the member's rank in it (none for a game they have not rated). `refusal` is what the member has to do before they may play it when it asks for an age (PLT-125): the search asks first for the date of birth, which the games for adults need. */
export type FindableGame = { slug: string; name: string; picture?: string; logo?: string; rank?: Rank | null; refusal?: AgeRefusal | null }

/** The kinds of table a search looks for, in the order they are offered: the first is the one the card starts on. */
const MODES: readonly QueueMode[] = ["normal", "ranked"]

/**
 * How big the tiles are for how many there are, the tile that adds a game counted: up to three games have large tiles, up to eight medium ones and more small ones, so that a search of one game and a search of fifteen both fill the card. A phone
 * has two, three or four to a row, a wider card as many as it has room for.
 */
const GRIDS = {
  large: "gap-4 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
  medium: "gap-3 grid-cols-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]",
  small: "gap-3 grid-cols-4 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]",
}

const gridOf = (tiles: number) => GRIDS[tiles <= 4 ? "large" : tiles <= 9 ? "medium" : "small"]

/**
 * Find a game, on the signed-in home, the larger of the two cards that open the play zone (two thirds of the row from `xl`, three fifths from `lg`, on a surface a step lighter than the other containers, `--card-bar`, which is what is read first): look for a table
 * among the games the visitor picks, against players they do not know (PLT-21). It has no title: what it is for is its toggle, Normal (the one it starts on) or Ranked, as wide as its two words, the kind of table. Under it are the games of the search, each a tile with a cross that takes it out
 * (`PickedGame`), all of them to begin with, and a black rectangle with a plus that lists the games that are not in it and adds the one that is pressed (`AddGame`); the tiles are sized by how many there are, from one game to the whole catalog. In a ranked search each tile says
 * the member's rank in its game. Only a member who is signed in plays ranked, and the home is theirs. At the foot, at the left, a large button with a play icon starts the search, "Play normal" or "Play ranked" (`QueueButton`). A search is the platform's one queue (`lib/matchmaking.ts`, which the social
 * panel shows too): a press sits the member at a table of each game they picked, and the table that fills first begins by itself. It counts on the button, with a cross that stops it, and the card shows the search that is on, whichever page began it, its games and its kind of table,
 * and cannot be changed until it is stopped.
 */
export function HomeFindGame({ games, className }: { games: readonly FindableGame[]; className?: string }) {
  const [picked, setPicked] = useState<readonly string[]>(() => games.map((game) => game.slug))
  const [mode, setMode] = useState<QueueMode>("normal")
  const queue = useQueue()
  const { guard, demand, fail, dialog: ageDialog } = useAgeGate()
  const seconds = useQueueSeconds(queue)
  const searching = queue !== null
  // What the card shows is the search when there is one, else what the visitor has set up so far
  const chosen = queue ? queue.games.map((game) => game.slug) : picked
  const shownMode = queue ? queue.mode : mode
  const asked = games.filter((game) => picked.includes(game.slug))
  const shown = games.filter((game) => chosen.includes(game.slug))

  return (
    <Card className={cn("h-full gap-6 [--card:var(--card-bar)] md:[--card-spacing:--spacing(8)]", className)}>
      <CardContent className="flex flex-col gap-6">
        <ToggleGroup type="single" variant="segmented" value={shownMode} disabled={searching} onValueChange={(next) => next && setMode(next as QueueMode)} aria-label="Kind of table" className="w-auto self-start">
          {MODES.map((value) => (
            // A search that is on keeps the kind it was started with as strong as when it is set: a value to read is not a control that is off
            <ToggleGroupItem key={value} value={value} className="h-9 px-6 data-[state=on]:disabled:opacity-100">
              {QUEUE_MODE_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {games.length > 0 ? (
          <>
            <div role="group" aria-label="Games to look for" className={cn("grid", gridOf(shown.length + 1))}>
              {shown.map((game, index) => (
                <PickedGame
                  key={game.slug}
                  name={game.name}
                  picture={game.picture}
                  logo={game.logo}
                  showRank={shownMode === "ranked"}
                  rank={game.rank}
                  onRemove={searching ? undefined : () => setPicked(picked.filter((slug) => slug !== game.slug))}
                  loading={index < 6 ? "eager" : "lazy"}
                />
              ))}
              {!searching && <AddGame games={games.filter((game) => !chosen.includes(game.slug))} showRank={shownMode === "ranked"} onAdd={(slug) => setPicked([...picked, slug])} />}
            </div>
            <p aria-live="polite" className={cn("text-sm text-muted-foreground", chosen.length > 0 && "sr-only")}>
              {chosen.length === 0 ? "Pick at least one game" : `${chosen.length} selected`}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">The games you can play are listed here.</p>
        )}
      </CardContent>
      <CardFooter className="mt-auto">
        <QueueButton
          size="xl"
          searching={searching}
          seconds={seconds}
          disabled={asked.length === 0}
          onSearch={async () => {
            // A game for adults needs the member's date of birth before the search begins
            if (asked.some((game) => game.refusal === "date") && !(await demand("date"))) return
            try {
              await guard(() => startSearch(asked, mode))
            } catch (error) {
              fail(error)
            }
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
