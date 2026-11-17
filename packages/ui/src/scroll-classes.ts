// A rounded box that scrolls clips, and an element inside it scrolls: a browser draws a scrollbar along the straight edge of the element that scrolls and does not follow that element's corners, so a rounded box that
// scrolled itself would have the end of its thumb standing out of them (`docs/design/02-foundations/09-scrollbars.md`). A popover and a window are boxes a caller gives classes to (`className`), and these two
// say which of them are for the box and which for the element inside it. A class is read with its variants (`sm:max-w-md` is a `max-w-*`).

type Split = { box: string; scroller: string }

const split = (className: string | undefined, forBox: RegExp): Split => {
  const box: string[] = []
  const scroller: string[] = []
  for (const name of (className ?? "").split(/\s+/).filter(Boolean)) (forBox.test(name) ? box : scroller).push(name)
  return { box: box.join(" "), scroller: scroller.join(" ") }
}

/** A popover: the `rounded-*` classes are its panel's (which clips), and every other class (width, padding, gap, what its children bleed into) is for the element inside it that scrolls. */
export const splitRounded = (className: string | undefined): Split => split(className, /(?:^|:)rounded(?:-|$)/)

/**
 * A window: when its caller says that it scrolls (`overflow-y-auto`), the window keeps its width and its corners (`w-*`, `min-w-*`, `max-w-*`, `rounded-*`) and clips, and the element inside it takes every other
 * class (its height, what it holds) and scrolls. Null when the window does not scroll: it is then one box, as it has always been.
 */
export const splitWindow = (className: string | undefined): Split | null =>
  /(?:^|\s)(?:[^\s:]+:)*overflow-(?:y-)?(?:auto|scroll)(?=\s|$)/.test(className ?? "") ? split(className, /(?:^|:)(?:w|min-w|max-w|rounded)(?:-|$)/) : null
