// The rest of a pointer that opens a panel, and the grace that keeps it open while the pointer crosses the gap between what opened it and the panel (the settings of a game's tile, under its picture). No React in this file, so that the timings are tested as they are: a block
// holds one of these and wires its pointer events to `enter`, `stay` and `leave`; what is open is the block's. It opens after a short rest, so that crossing a row of pictures does not flash a panel for each (the delays of the platform's `HoverCard`), and closes after a short grace once the
// pointer is off both. A press still opens it at once (`open`) and Escape or a press outside shuts it (`close`).

/** What a block does with the pointer: `enter` (the pointer is on what opens the panel) opens after a rest, `stay` (it is on the panel) keeps the panel as it is, `leave` (it left either) closes after a grace. */
export type HoverIntent = {
  enter: () => void
  stay: () => void
  leave: () => void
  /** Opens now, whatever is waiting. */
  open: () => void
  /** Closes now, whatever is waiting. */
  close: () => void
  /** Drops what is waiting: for the block that goes away, and for a press that decides the panel itself. */
  dispose: () => void
}

/** The rest before the panel opens, as the platform's `HoverCard` has it. */
export const HOVER_OPEN_DELAY = 200

/** The grace before it closes: a little more than the card's, since this panel holds controls and the pointer must be able to cross to it. */
export const HOVER_CLOSE_DELAY = 150

/** A pointer that rests on the trigger opens the panel after `openDelay`; one that has left the trigger and the panel closes it after `closeDelay`; `change` is told which, once. */
export function hoverIntent(change: (open: boolean) => void, { openDelay = HOVER_OPEN_DELAY, closeDelay = HOVER_CLOSE_DELAY }: { openDelay?: number; closeDelay?: number } = {}): HoverIntent {
  let timer: ReturnType<typeof setTimeout> | undefined
  const dispose = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const later = (open: boolean, delay: number) => {
    dispose()
    timer = setTimeout(() => {
      timer = undefined
      change(open)
    }, delay)
  }
  return {
    enter: () => later(true, openDelay),
    stay: dispose,
    leave: () => later(false, closeDelay),
    open: () => {
      dispose()
      change(true)
    },
    close: () => {
      dispose()
      change(false)
    },
    dispose,
  }
}
