import * as React from "react"
import { cn } from "../utils"
import { Badge } from "./badge"

type BannerProps = Omit<React.ComponentProps<"a">, "children"> & {
  /** URL of its picture, which fills the frame, cropped to it. */
  image: string
  /** What it announces, in a word or two, already worded: "New game". */
  kind: string
  title: string
  /** `lazy` (default): further down the page. `eager`: the first one a page opens on. */
  loading?: "lazy" | "eager"
}

/**
 * A banner of the signed-in home: a new game, a new feature. A slim card, as high as its text: the picture on a 16:9 frame at the left and, beside it, what it announces (a badge with the kind, then the title). Like the game card, nothing is laid over the picture,
 * so the text never depends on it. It is a plain link to the game or to the article it leads to: the package is framework-free, and the target is a page the visitor loads whole.
 */
function Banner({ className, image, kind, title, loading = "lazy", ...props }: BannerProps) {
  return (
    <a
      data-slot="banner"
      className={cn(
        "group/banner relative flex items-center gap-4 overflow-hidden rounded-4xl bg-card p-3 pr-5 text-card-foreground shadow-surface ring-1 ring-foreground/10 transition-[box-shadow,background-color] outline-none hover:bg-secondary hover:shadow-float hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    >
      <div data-slot="banner-visual" className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-2xl bg-muted sm:w-44">
        {/* A plain <img>: the package is framework-free and the picture is a URL of the image CDN of the platform's Sanity project */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          loading={loading}
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-slow ease-standard group-hover/banner:scale-103"
        />
      </div>
      <div data-slot="banner-body" className="flex flex-1 flex-col items-start gap-2 py-1">
        <Badge variant="secondary">{kind}</Badge>
        <h3 data-slot="banner-title" className="font-heading text-lg text-balance">
          {title}
        </h3>
      </div>
    </a>
  )
}

export { Banner }
export type { BannerProps }
