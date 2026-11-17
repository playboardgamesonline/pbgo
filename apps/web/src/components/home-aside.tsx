import Link from "next/link"
import { ArrowRight01Icon, News01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TimeFormat } from "@pbgo/accounts"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { cn } from "@pbgo/ui/utils"
import type { HomeArticle, HomeTournament } from "@/lib/home-aside"
import { EmptyBlock } from "./empty-block"
import { HomeTournaments } from "./home-tournaments"

// The right column of the signed-in home, beside the play zone: what's new at the top (the latest article of the platform, with its summary and the way to open it) and under it the open tournaments (`HomeTournaments`). It is the smaller of the two spaces of the home and starts at
// the top of the zone's card: two blocks, each under a heading, a card or a list of rows, and an empty state where there is nothing yet, a little apart from each other. From `xl` it is beside the card and as tall as it, what's new keeping the height it has
// and the tournaments taking the rest, down to the foot of the card; under `xl` the two blocks are side by side from `md`, where the column is under the zone and has the room. The day of an article is written in UTC, like the tournaments' dates, since the page does not know where
// the visitor is.

const DAY = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })

/** The article: its day, its title, its summary cut after four lines, and a button that opens it, in a card a little taller than a default one (2rem of room at its top and its foot and between its parts). A cover, when it has one, is the top of the card. */
function ArticleCard({ article }: { article: HomeArticle }) {
  return (
    <Card className="gap-8 py-8">
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
        <p className="line-clamp-4 text-muted-foreground">{article.summary}</p>
      </CardContent>
      <CardFooter>
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
  return (
    <aside aria-label="What's new and open tournaments" className={cn("grid min-w-0 grid-cols-1 content-start gap-8 md:grid-cols-2 xl:flex xl:flex-col", className)}>
      <section aria-labelledby="whats-new" className="flex flex-col gap-3">
        <h2 id="whats-new" className="mb-3 font-heading text-lg">
          {"What's new"}
        </h2>
        {article ? <ArticleCard article={article} /> : <EmptyBlock title="Nothing new yet" icon={News01Icon} />}
      </section>
      <HomeTournaments tournaments={tournaments} timeFormat={timeFormat} className="xl:grow xl:basis-0" />
    </aside>
  )
}
