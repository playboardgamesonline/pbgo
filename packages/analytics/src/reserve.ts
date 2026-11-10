/** The custom property that holds the height of the consent banner, on `<body>`. Unset (read as `0px`) when there is no banner. */
export const RESERVED_HEIGHT_VAR = "--consent-h"

/**
 * Keeps the room of the consent banner free, so nothing of the page sits under it.
 *
 * The banner is `fixed`, which takes no room. This publishes the height of its box as `--consent-h` on `page` (the `<body>`) and
 * pads the bottom of `page` by as much: a page that scrolls (the hub, the legal notice) ends above the banner. The box is what is
 * measured, so the banner keeps the margin around its card inside it (as padding of the box): the room holds the margin too, and
 * nothing of the page sits against the card or its shadow. A screen that fills the viewport subtracts the variable from its height
 * (`h-[calc(100dvh-var(--consent-h,0px))]`) and a `fixed` element anchored to the bottom offsets itself by it (`docs/design/01-guidelines/04-in-game-rules.md`). It
 * follows the banner when its size changes (another language, a narrower window).
 *
 * `pad: false` is for a page whose canvas must keep its whole height, the screens of a game: the banner then floats over the page, which is not padded, and the variable is
 * still published, for the buttons that keep their distance from the card.
 *
 * The variable lives on `<body>`, never on `:root`: the platform sets no value on `:root`, or every game would inherit it.
 *
 * Returns the function that gives the room back: it stops following the banner and puts the page as it was.
 */
export function reserveSpace(banner: HTMLElement, page: HTMLElement, { pad = true }: { pad?: boolean } = {}): () => void {
  const padding = page.style.getPropertyValue("padding-bottom")
  const publish = () => {
    page.style.setProperty(RESERVED_HEIGHT_VAR, `${Math.ceil(banner.getBoundingClientRect().height)}px`)
  }
  publish()
  if (pad) page.style.setProperty("padding-bottom", `var(${RESERVED_HEIGHT_VAR})`)
  const observer = new ResizeObserver(publish)
  observer.observe(banner)
  return () => {
    observer.disconnect()
    page.style.removeProperty(RESERVED_HEIGHT_VAR)
    if (!pad) return
    if (padding) page.style.setProperty("padding-bottom", padding)
    else page.style.removeProperty("padding-bottom")
  }
}
