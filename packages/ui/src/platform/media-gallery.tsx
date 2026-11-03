"use client"

import * as React from "react"
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react"
import { slideAfterKey, slideLabel, type GalleryMedia, type SlideKind } from "../gallery"
import { DURATION, EASE_STANDARD, SPRING_TRAVEL } from "../motion"
import { cn } from "../utils"
import { Button } from "./button"
import { GameCardVisual, type GameCardVisualProps } from "./game-card"

// The picture of a game's page, made a small gallery: a viewer that shows one slide, in 16:9 and taller when the column it stands in is stretched (the head's text is taller than the gallery), up to 4:3, so that its foot stays level with the text's, and under it a tile for each slide, which a press, or an arrow key on the row, puts in the viewer. The first slide is the cover, the picture of the game's card (`GameCardVisual`: its
// logo over its background); then come the pictures and the clips of a game being played (`GalleryMedia`). A game that has none has the cover alone, in the viewer, with no row of tiles. A clip plays as soon as it is shown, in a loop and with no sound, unless the visitor asks for less motion,
// and a button on it pauses and plays it; it stops when another slide is put in the viewer. The slide that is shown has a ring on its tile, one element for the whole row that glides from a tile to the next with the spring of the navbar's fill (`SPRING_TRAVEL`), and the viewer
// goes from a slide to the next by fading the new one in over the old (a visitor who asks for less motion gets the ring where it goes at once). The tiles are the tabs of a tab list and the viewer is its panel, so that the arrows, Home and End move between them (`slideAfterKey`) and a screen reader
// says where it is (`slideLabel`). Nothing stands in for what a clip lacks: with no poster the tile and the viewer wait for its first frame. It draws what it is given and decides nothing: which slides a game has is the page's.

type MediaGalleryProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The game's name: it names each slide for a screen reader. */
  name: string
  /** What the first slide shows, the cover: the logo and the background of the game's card. */
  cover: Pick<GameCardVisualProps, "logo" | "background">
  /** The pictures and the clips that follow the cover, in order. None: the cover alone. */
  media?: readonly GalleryMedia[]
}

type Slide = { id: string; kind: SlideKind; label: string; media?: GalleryMedia }

/** The colour behind a small control laid over a picture: the page's, a little see-through. */
const BADGE = "grid place-items-center rounded-lg bg-background/70 text-foreground"

/** A clip in the viewer: it plays at once, muted and looping (not when less motion is asked for), and a button pauses and plays it. */
function GalleryVideo({ src, poster, label }: { src: string; poster?: string; label: string }) {
  const video = React.useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()
  const [playing, setPlaying] = React.useState(false)
  React.useEffect(() => {
    // A browser may refuse to start a clip by itself: the button is then the way to play it
    if (!reduceMotion) video.current?.play().catch(() => undefined)
  }, [reduceMotion])
  return (
    <div className="relative size-full">
      <video ref={video} src={src} poster={poster} aria-label={label} muted loop playsInline preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="size-full object-cover" />
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={playing ? "Pause the clip" : "Play the clip"}
        onClick={() => (playing ? video.current?.pause() : video.current?.play().catch(() => undefined))}
        className="absolute right-3 bottom-3"
      >
        <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} strokeWidth={2} aria-hidden="true" />
      </Button>
    </div>
  )
}

/** What a slide is in the viewer. */
function SlideView({ slide, cover }: { slide: Slide; cover: MediaGalleryProps["cover"] }) {
  const { media } = slide
  if (!media) return <GameCardVisual {...cover} loading="eager" className="aspect-auto size-full" />
  if (media.kind === "video") return <GalleryVideo src={media.src} poster={media.poster} label={slide.label} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.src} alt={slide.label} loading="lazy" decoding="async" className="size-full object-cover" />
  )
}

/** What a slide is in its tile: small, and a badge with a play on a clip. The cover is drawn with a tighter margin round its logo than the card's. */
function Thumbnail({ slide, cover }: { slide: Slide; cover: MediaGalleryProps["cover"] }) {
  const { media } = slide
  if (!media) {
    return (
      <>
        {cover.background && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.background} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        )}
        {cover.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.logo} alt="" loading="lazy" decoding="async" className="relative size-full object-contain p-2" />
        )}
      </>
    )
  }
  const picture = media.thumb ?? (media.kind === "video" ? media.poster : media.src)
  return (
    <>
      {picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picture} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        // A clip with no picture of its own is its first frame: the fragment asks for a moment after the start, which a frame is drawn at
        <video src={`${media.src}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} className="size-full object-cover" />
      )}
      {media.kind === "video" && (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <span className={cn(BADGE, "size-6")}>
            <HugeiconsIcon icon={PlayIcon} strokeWidth={2} className="size-3.5" />
          </span>
        </span>
      )}
    </>
  )
}

function MediaGallery({ className, name, cover, media = [], ...props }: MediaGalleryProps) {
  const id = React.useId()
  const tiles = React.useRef<(HTMLButtonElement | null)[]>([])
  const [picked, setPicked] = React.useState(0)
  const slides: Slide[] = [
    { id: "cover", kind: "cover", label: slideLabel(name, "cover", 0, media.length) },
    ...media.map((item, index): Slide => ({ id: `media-${index}`, kind: item.kind, label: slideLabel(name, item.kind, index + 1, media.length, item.caption), media: item })),
  ]
  // The list of media may get shorter while the gallery is open: the slide that is shown is then the last there is
  const shown = Math.min(picked, slides.length - 1)
  const slide = slides[shown] as Slide
  const panelId = `${id}-panel`
  const tabId = (index: number) => `${id}-tab-${index}`

  const move = (event: React.KeyboardEvent) => {
    const next = slideAfterKey(shown, event.key, slides.length)
    if (next === shown) return
    event.preventDefault()
    setPicked(next)
    tiles.current[next]?.focus()
  }

  return (
    <MotionConfig reducedMotion="user">
      <div data-slot="media-gallery" className={cn("@container flex flex-col gap-3", className)} {...props}>
        <div
          role={slides.length > 1 ? "tabpanel" : undefined}
          id={slides.length > 1 ? panelId : undefined}
          aria-labelledby={slides.length > 1 ? tabId(shown) : undefined}
          data-slot="media-gallery-viewer"
          className="relative aspect-video max-h-[75cqw] min-h-0 flex-1 overflow-hidden rounded-4xl bg-muted ring-1 ring-foreground/10"
        >
          {/* The new slide fades in over the old one, which stays whole until it is covered: no dip to the frame's grey between them */}
          <AnimatePresence initial={false}>
            <motion.div
              key={slide.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: DURATION.base, ease: EASE_STANDARD } }}
              exit={{ opacity: 1, transition: { duration: DURATION.base } }}
            >
              <SlideView slide={slide} cover={cover} />
            </motion.div>
          </AnimatePresence>
        </div>

        {slides.length > 1 && (
          <LayoutGroup id={id}>
            <div role="tablist" aria-label={`${name}: cover, pictures and clips`} onKeyDown={move} className="flex gap-2">
              {slides.map((tile, index) => (
                <button
                  key={tile.id}
                  ref={(element) => {
                    tiles.current[index] = element
                  }}
                  type="button"
                  role="tab"
                  id={tabId(index)}
                  aria-selected={index === shown}
                  aria-controls={panelId}
                  aria-label={tile.label}
                  tabIndex={index === shown ? 0 : -1}
                  onClick={() => setPicked(index)}
                  className="relative isolate aspect-video max-w-32 min-w-0 flex-1 overflow-hidden rounded-2xl bg-muted opacity-60 ring-1 ring-foreground/10 transition-opacity outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/30 aria-selected:opacity-100"
                >
                  <Thumbnail slide={tile} cover={cover} />
                  {index === shown && (
                    <motion.span
                      layoutId="media-gallery-current"
                      aria-hidden="true"
                      data-slot="media-gallery-current"
                      className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-foreground ring-inset"
                      transition={SPRING_TRAVEL}
                    />
                  )}
                </button>
              ))}
            </div>
          </LayoutGroup>
        )}
      </div>
    </MotionConfig>
  )
}

export { MediaGallery }
export type { MediaGalleryProps }
