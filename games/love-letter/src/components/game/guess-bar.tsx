"use client"

import { CARDS, type CharacterKey, GUESSES } from "@love-letter/engine"
import { Button } from "@pbgo/ui/game/button"
import { cn } from "@pbgo/ui/utils"
import { useLayoutEffect, useRef } from "react"
import type { ClientCatalog } from "../../lib/catalog"
import { useFaceSources } from "../../lib/faces"

/** Pixels across the canvas a face is drawn again on: enough for the largest card of the row on a wide screen, at twice the pixels of the page */
const ACROSS = 380

/** One face of the row, the canvas the table painted it on drawn again at the size of the row, so that it reads in the fonts and the language of the game */
function Face({ source }: { source: HTMLCanvasElement | undefined }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const g = canvas.current?.getContext("2d")
    if (!g || !source) return
    g.clearRect(0, 0, g.canvas.width, g.canvas.height)
    g.drawImage(source, 0, 0, g.canvas.width, g.canvas.height)
  }, [source])
  return <canvas ref={canvas} width={ACROSS} height={Math.round((ACROSS * 53) / 38)} className="size-full" />
}

type Props = {
  catalog: ClientCatalog
  /** The character named so far, or none */
  guess: CharacterKey | null
  /** The Guard can be played: its player and its character are chosen, and no move is on its way */
  ready: boolean
  disabled: boolean
  onGuess: (type: CharacterKey) => void
  onConfirm: () => void
}

/**
 * What a Guard names, at the foot of the screen in the place of the hand: the nine characters other than the Guard in one row, from the Spy (0) to the Princess (9), each a face of the game with its value and its name under it, and the button that plays the Guard
 * under the row. Pressing a character names it (pressed again, it is put back); the player is pressed on the table. The row is a page element in the layer of the HUD, above the room of the cookie banner, and keeps clear of the chat at the bottom right.
 */
export function GuessBar({ catalog, guess, ready, disabled, onGuess, onConfirm }: Props) {
  const sources = useFaceSources()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5">
      <div data-guess-bar role="group" aria-label={catalog.words.nameCharacter} className="pointer-events-auto flex w-[min(78rem,calc(100%-30rem))] min-w-[36rem] flex-col items-center gap-4">
        <div className="grid w-full grid-cols-9 gap-[1.2%]">
          {GUESSES.map((type) => {
            const chosen = guess === type
            return (
              <button
                key={type}
                type="button"
                data-guess={type}
                disabled={disabled}
                aria-pressed={chosen}
                aria-label={`${CARDS[type].value} · ${catalog.names[type]}`}
                onClick={() => onGuess(type)}
                className={cn(
                  "group flex min-w-0 flex-col items-center gap-1.5 outline-none transition-transform duration-200 ease-out",
                  "focus-visible:-translate-y-2 enabled:hover:-translate-y-2 disabled:opacity-60",
                  chosen && "-translate-y-4 enabled:hover:-translate-y-4",
                )}
              >
                <span
                  className={cn(
                    "aspect-[38/53] w-full overflow-hidden rounded-[6%] shadow-lg ring-offset-2 ring-offset-background transition-[box-shadow,filter] duration-200",
                    "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    chosen ? "ring-3 ring-primary shadow-2xl" : guess ? "brightness-75 group-hover:brightness-100" : "",
                  )}
                >
                  <Face source={sources[type]} />
                </span>
                <span className={cn("max-w-full truncate font-display text-sm tracking-wide text-foreground/80", chosen && "text-foreground")}>
                  {CARDS[type].value} · {catalog.names[type]}
                </span>
              </button>
            )
          })}
        </div>
        <Button data-guess-confirm size="lg" disabled={!ready} onClick={onConfirm} className="min-w-48 font-display text-base tracking-wide">
          {guess ? `${catalog.words.play} · ${catalog.names.guard} → ${catalog.names[guess]}` : catalog.words.play}
        </Button>
      </div>
    </div>
  )
}
