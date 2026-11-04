// What the gallery of a game's page (`MediaGallery`) needs that is not drawing: the pictures and the clips it is given, how a slide is named for a screen
// reader, where each key of the keyboard goes among the thumbnails and where the row of thumbnails starts. Pure, so that it is tested.

/**
 * A picture or a clip that follows the cover. `src` is the file the viewer shows (a clip's video, a picture sized for it) and `thumb` a picture sized for the small tile that
 * stands for it; a clip with no `thumb` is shown in its tile by its first frame, and with no `poster` it waits for its first frame in the viewer. `caption` is what it shows, in a few words, when someone said.
 */
export type GalleryMedia =
  | { kind: "image"; src: string; thumb?: string; caption?: string | null }
  | { kind: "video"; src: string; poster?: string; thumb?: string; caption?: string | null }

/** What a slide is: the cover of the game, or one of its pictures or clips. */
export type SlideKind = "cover" | "image" | "video"

const NOUN: Record<SlideKind, string> = { cover: "cover", image: "picture", video: "clip" }

/**
 * What a screen reader says of a slide: the game and what the slide is, the cover or, for the others, its place among them ("Courtisans: clip 2 of 4"), then what it shows when someone said ("…, the estate at night").
 * `position` is 1 for the first picture or clip, the one after the cover, and `count` how many of them there are.
 */
export function slideLabel(name: string, kind: SlideKind, position: number, count: number, caption?: string | null): string {
  const what = kind === "cover" ? NOUN.cover : `${NOUN[kind]} ${position} of ${count}`
  return `${name}: ${what}${caption ? `, ${caption}` : ""}`
}

/**
 * The slide that a key of the keyboard goes to from the one at `index`, among `count`: the arrows step to the next or the previous one and come round at the ends, Home and End go to the
 * first and the last; any other key stays where it is.
 */
export function slideAfterKey(index: number, key: string, count: number): number {
  if (count <= 0) return 0
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count
    case "Home":
      return 0
    case "End":
      return count - 1
    default:
      return index
  }
}

/**
 * Where the row of tiles starts, the index of the first tile that shows, once the slide at `shown` is in the viewer, among `count`, when the row shows `visible` tiles at once and starts at `start` now. The row stays where it is when the slide
 * and the ones on each side of it are in view; otherwise it moves as little as it takes to have them in, a whole tile at a time, so that the last tile in view always leads to the next one. It never starts before the first tile, nor after the window that ends with the last.
 */
export function windowAfter(start: number, shown: number, count: number, visible: number): number {
  const before = Math.max(0, shown - 1)
  const after = Math.min(count - 1, shown + 1)
  const nearest = Math.min(Math.max(start, after - visible + 1), before)
  return Math.max(0, Math.min(nearest, count - visible))
}
