// Where a card goes beside what it is about, for `@pbgo/ui/platform/moving-card`. No React in this file, so that it is tested as it is.

/** A box on the page, in px, as `getBoundingClientRect()` gives it. */
export type Box = { left: number; top: number; width: number; height: number }

/**
 * Where the card stands: to the left of what it is about, its top where the top of that is (moved by `alignOffset`), or under it, centred on it. `offset` is the distance between
 * the card and what it is about; a negative one makes the card overlap it.
 */
export type Placement =
  | { side: "left"; align: "start"; offset: number; alignOffset?: number }
  | { side: "bottom"; align: "center"; offset: number }

/**
 * The top left corner of the card, in the window, given what it is about (`anchor`), the size of the card and of the window. The card stays in the window, `padding` from its edges, which
 * moves it along the edge when it would go out; a card taller than the window starts `padding` from the top.
 */
export function cardPosition(
  anchor: Box,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  placement: Placement,
  padding = 16,
): { x: number; y: number } {
  const x = placement.side === "left" ? anchor.left - placement.offset - card.width : anchor.left + anchor.width / 2 - card.width / 2
  const y = placement.side === "left" ? anchor.top + (placement.alignOffset ?? 0) : anchor.top + anchor.height + placement.offset
  const keep = (value: number, size: number, room: number) => Math.max(padding, Math.min(value, room - size - padding))
  return { x: keep(x, card.width, viewport.width), y: keep(y, card.height, viewport.height) }
}
