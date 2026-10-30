import * as React from "react"

// What the pieces of the home's title have in common when they play: a rhythm, which starts a move every so often and whenever it is asked to, and never over itself, and the hook that has the pointer ask for it. A piece that is
// playing is left to finish, so a pointer that goes out of it and in again, or a finger that taps it twice, does not start it over.

/**
 * A move that comes round every `every` milliseconds, the first one after `first`, and that can be asked for in between. `busy` says whether it is playing: a move that is playing is not started over (one that is not over, as a
 * tab in the background holds the frames back while the timers go on, is left to end where it was going), and `start` starts it. Asked for, it starts at once and the next one comes `every` after it, not at the time that was set.
 */
function rhythm({ first, every, busy, start }: { first: number; every: number; busy: () => boolean; start: () => void }) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    timer = setTimeout(tick, every)
    if (!busy()) start()
  }
  timer = setTimeout(tick, first)
  return {
    play: () => {
      if (busy()) return
      clearTimeout(timer)
      timer = setTimeout(tick, every)
      start()
    },
    stop: () => clearTimeout(timer),
  }
}

/**
 * Has the piece play when the pointer comes onto it. Its box is the `title-piece` it stands in (the drawing lets the pointer through, and the box is what has the size of the letter the piece stands for) or, for a piece that is
 * its own box, `root` itself. `playNow` holds the piece's own request, which it sets while it can play and takes back when it cannot (a visitor who asks for less motion never sets it). A finger is a pointer too: it comes onto
 * the piece as it lands.
 */
function usePlayOnEnter(root: React.RefObject<HTMLElement | null>, playNow: React.RefObject<(() => void) | null>) {
  React.useEffect(() => {
    const host = root.current?.closest<HTMLElement>(".title-piece") ?? root.current
    if (!host) return
    const enter = () => playNow.current?.()
    host.addEventListener("pointerenter", enter)
    return () => host.removeEventListener("pointerenter", enter)
  }, [root, playNow])
}

export { rhythm, usePlayOnEnter }
