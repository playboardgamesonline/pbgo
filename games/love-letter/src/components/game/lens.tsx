"use client"

import { useLayoutEffect, useRef } from "react"
import { useLens } from "../../lib/lens"

/** Whether the screen cannot hover (a touch screen): the card that is picked is held up, since there is no pointer to put on one */
const cannotHover = () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches

/**
 * The card the player is reading, held up large over the middle of the table, above everything and out of the way of the pointer: the faces are lettered on the table at the size of a card, where the text of a card is a few pixels tall, so a face is read here. It stands in the
 * layer of the HUD, above the room of the cookie banner, and draws the canvas the table painted the face on, so it shows what the card shows, in the language and the fonts of the game.
 */
export function Lens() {
  const { hovered, picked } = useLens()
  const shown = hovered ?? (cannotHover() ? picked : null)
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
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-30 aspect-[38/53] h-[min(34rem,64%)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[3%] shadow-2xl">
      <canvas ref={canvas} width={760} height={1060} className="size-full" />
    </div>
  )
}
