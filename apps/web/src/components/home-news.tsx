import Link from "next/link"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { Badge } from "@pbgo/ui/platform/badge"
import { Section, SectionAction } from "@pbgo/ui/platform/section"

/** A line of the news as the home draws it. `date` is `YYYY-MM-DD`. */
export type HomeNewsLine = { id: string; kind: string; date: string; title: string; text: string; href: string }

const DAY = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** A day, `YYYY-MM-DD`, as the page writes it: `Nov 5, 2026`. */
const dayOf = (date: string) => DAY.format(new Date(`${date}T00:00:00Z`))

/**
 * The news at the bottom of the signed-in home, like the public home's what's new: the latest lines of the changelog, each with its kind, its day and the start of its text, and the way to the page of what's new
 * under them. Nothing is drawn when there is none: a zone without data is not drawn.
 */
export function HomeNews({ lines }: { lines: readonly HomeNewsLine[] }) {
  if (lines.length === 0) return null
  return (
    <Section aria-labelledby="home-news" className="gap-6">
      <h2 id="home-news" className="sr-only">
        What&apos;s new
      </h2>
      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <Item key={line.id} asChild>
            <Link href={line.href}>
              <ItemContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{line.kind}</Badge>
                  <time dateTime={line.date} className="text-sm text-muted-foreground">
                    {dayOf(line.date)}
                  </time>
                </div>
                <ItemTitle>{line.title}</ItemTitle>
                {line.text && <ItemDescription>{line.text}</ItemDescription>}
              </ItemContent>
            </Link>
          </Item>
        ))}
      </div>
      <SectionAction asChild className="self-center">
        <Link href="/about#whats-new">See what&apos;s new</Link>
      </SectionAction>
    </Section>
  )
}
