import Link from "next/link"
import type { DesignPage } from "./pages"

/** The pages of `/design` as cards that lead to them: what each holds and how many sections it has. The overview and the page of the components draw them. */
export function PageCards({ pages }: { pages: readonly DesignPage[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {pages.map((page) => (
        <li key={page.slug}>
          <Link href={page.href} className="flex h-full flex-col gap-2 rounded-3xl border p-6 transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none">
            {page.family !== page.title && <span className="text-sm text-muted-foreground">{page.family}</span>}
            <span className="font-heading text-xl">{page.title}</span>
            <span className="text-muted-foreground">{page.description}</span>
            <span className="mt-auto pt-2 text-sm text-muted-foreground">{page.sections.length} sections</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
