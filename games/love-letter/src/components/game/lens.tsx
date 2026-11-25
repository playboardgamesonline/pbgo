"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useLens } from "../../lib/lens"

/** Whether the screen cannot hover (a touch screen): the card that is picked is held up, since there is no pointer to put on one */
const cannotHover = () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches

/** How long the pointer rests on a card before it is held up, in milliseconds: a pointer that crosses the cards on its way somewhere shows nothing */
const REST = 350

/**
 * The card the player is reading, held up at the left edge of the screen, at mid-height, out of the way of the table and of the pointer, once the pointer has rested on it a moment: the faces are lettered on the table at the size of a card, where the text of a
 * card is a few pixels tall, so a face is read here. It is a reading card and never a full screen: about a third of the height of the window, over nothing that is played. It stands in the layer of the HUD, above the room of the cookie banner, and draws the
 * canvas the table painted the face on, so it shows what the card shows, in the language and the fonts of the game.
 */
export function Lens() {
  const { hovered, picked } = useLens()
  const wanted = hovered ?? (cannotHover() ? picked : null)
  // the card the pointer has rested on: it is held up once the pointer has stayed on it a moment, and the card picked on a screen that cannot hover at once
  const [rested, setRested] = useState<number | null>(null)
  useEffect(() => {
    if (!wanted || wanted === picked) return
    const timer = window.setTimeout(() => setRested(wanted.id), REST)
    return () => window.clearTimeout(timer)
  }, [wanted, picked])
  const shown = wanted && (wanted === picked || rested === wanted.id) ? wanted : null
  const canvas = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const target = canvas.current
    const g = target?.getContext("2d")
    if (!shown || !target || !g) return
    g.clearRect(0, 0, target.width, target.height)
    g.drawImage(shown.source, 0, 0, target.width, target.height)
  }, [shown])
  if (!shown) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-6 z-30 aspect-[38/53] h-[min(22rem,40%)] -translate-y-1/2 overflow-hidden rounded-[3%] shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2"
    >
      <canvas ref={canvas} width={760} height={1060} className="size-full" />
    </div>
  )
}
