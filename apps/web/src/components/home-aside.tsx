"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight01Icon, News01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TimeFormat } from "@pbgo/accounts"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { cn } from "@pbgo/ui/utils"
import { ASIDE_FIT, fitAside, type AsideFit, type AsideMeasure, type HomeArticle, type HomeTournament } from "@/lib/home-aside"
import { EmptyBlock } from "./empty-block"
import { HomeTournaments } from "./home-tournaments"

// The right column of the signed-in home, beside the play zone: what's new at the top (the latest article of the platform, with its summary and the way to open it) and under it the open tournaments (`HomeTournaments`). It is the smaller of the two spaces of the home and starts at
// the top of the zone's card: two blocks, each under a heading, a card or a list of rows, and an empty state where there is nothing yet, a little apart from each other. From `xl` it is beside the card and as tall as it, and the two blocks share that height (`fitAside`): the tournaments
// come first, up to four rows to a page while the article keeps three lines of its summary, and the article takes all the height that is left, its summary showing as many lines as fit. Under `xl` the two blocks are side by side from `md`, where the column is under the zone and has the
// room, and each has its own height. The day of an article is written in UTC, like the tournaments' dates, since the page does not know where the visitor is.

const DAY = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })

/** From this width the column is beside the card, as tall as it (`xl`: 80rem). */
const BESIDE = "(min-width: 80rem)"

/** The two parts whose size the share of the height depends on: the block of the tournaments (what is left under the article) and the summary of the article. */
const MEASURED = '[data-slot="tournaments-area"], [data-slot="article-summary"]'

/**
 * What the column measures of itself, from what it draws: the tournaments' block, the lines of the article's summary, the tallest row (so that a page of rows that are not all as tall as the first is never cut) and the empty state. The sizes are exact, not `clientHeight` and
 * the like, which are rounded to a whole pixel: that rounding is not the same with the article at one line more, and the share went back and forth at the heights where it made the difference. None where the block of the tournaments is not drawn.
 */
function measureAside(aside: HTMLElement, count: number): AsideMeasure | null {
  const area = aside.querySelector<HTMLElement>('[data-slot="tournaments-area"]')
  if (!area) return null
  const summary = aside.querySelector<HTMLElement>('[data-slot="article-summary"]')
  const lineHeight = summary ? parseFloat(getComputedStyle(summary).lineHeight) : 0
  const shown = summary && lineHeight > 0 ? Math.round(summary.getBoundingClientRect().height / lineHeight) : 0
  const rowHeight = Math.max(0, ...Array.from(area.querySelectorAll<HTMLElement>('[data-slot="item"]'), (row) => row.getBoundingClientRect().height))
  const empty = count === 0 ? (area.firstElementChild?.getBoundingClientRect().height ?? 0) : 0
  return { area: area.getBoundingClientRect().height, lineHeight, shown, rowHeight, count, empty }
}

/**
 * The article: its day, its title, its summary cut after `lines` lines, and a button that opens it, in a card a little taller than a default one (2rem of room at its top and its foot, and 1rem between its title and its summary, which belong together, and 2rem between the
 * summary and the button). A cover, when it has one, is the top of the card.
 */
function ArticleCard({ article, lines }: { article: HomeArticle; lines: number }) {
  return (
    <Card className="gap-4 py-8">
      {article.picture && (
        // eslint-disable-next-line @next/next/no-img-element -- the cover is a URL of the platform's image CDN, drawn as the game cards draw theirs
        <img src={article.picture} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
      )}
      <CardHeader>
        <CardDescription>
          <time dateTime={article.date}>{DAY.format(new Date(`${article.date}T00:00:00Z`))}</time>
        </CardDescription>
        <CardTitle className="text-lg leading-snug">{article.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p data-slot="article-summary" className="line-clamp-1 text-muted-foreground" style={{ WebkitLineClamp: lines }}>
          {article.summary}
        </p>
      </CardContent>
      <CardFooter className="mt-4">
        <Button asChild variant="secondary" size="lg">
          <Link href={article.href}>
            Read more
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * The column: `article` is the latest one, none when there is none yet, and `tournaments` the ones that are open, the ones that start first (`openTournaments`). Each block has its heading, and an empty state when it has nothing. `className` places the column: its width
 * and where it sits are the page's.
 */
export function HomeAside({ article, tournaments, timeFormat = "auto", className }: { article: HomeArticle | null; tournaments: readonly HomeTournament[]; timeFormat?: TimeFormat; className?: string }) {
  const aside = useRef<HTMLElement>(null)
  const [fit, setFit] = useState<AsideFit>(ASIDE_FIT)

  // How the height is shared, measured from what is drawn: again when the column or one of the two parts changes size (the window, the fonts, the lines the article was given), which settles at once, since what the article takes above its fewest lines is given back to the
  // tournaments before they are counted and the last answer is kept while the room does not clearly say otherwise (`fitAside`)
  useEffect(() => {
    const element = aside.current
    if (!element) return
    const beside = window.matchMedia(BESIDE)
    const measure = () => {
      const measured = beside.matches ? measureAside(element, tournaments.length) : null
      setFit((now) => {
        const next = measured ? fitAside(measured, now) : ASIDE_FIT
        return next.perPage === now.perPage && next.lines === now.lines ? now : next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const part of element.querySelectorAll(MEASURED)) observer.observe(part)
    beside.addEventListener("change", measure)
    return () => {
      observer.disconnect()
      beside.removeEventListener("change", measure)
    }
  }, [article, tournaments.length])

  return (
    <aside ref={aside} aria-label="What's new and open tournaments" className={cn("grid min-w-0 grid-cols-1 content-start gap-8 md:grid-cols-2 xl:flex xl:flex-col", className)}>
      <section aria-labelledby="whats-new" className="flex flex-col gap-3">
        <h2 id="whats-new" className="mb-3 font-heading text-lg">
          {"What's new"}
        </h2>
        {article ? <ArticleCard article={article} lines={fit.lines} /> : <EmptyBlock title="Nothing new yet" icon={News01Icon} />}
      </section>
      <HomeTournaments tournaments={tournaments} perPage={fit.perPage} timeFormat={timeFormat} className="xl:grow xl:basis-0" />
    </aside>
  )
}
