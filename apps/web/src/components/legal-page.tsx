import type { ReactNode } from "react"
import Link from "next/link"
import { Separator } from "@pbgo/ui/platform/separator"
import { LEGAL_PAGES, type LegalHref } from "@/lib/legal-pages"
import { SITE_NAME } from "@/site"

/** A link inside the text of a legal page. */
export const LEGAL_LINK = "text-foreground underline underline-offset-4"

/** The words of a paragraph that carry its point, in the full text colour (the rest of the text is `muted-foreground`). */
export const LEGAL_LEAD = "text-foreground"

/**
 * The frame of a page of the legal section (the notice, the privacy policy, the cookie policy, the terms of use): a link back to the
 * home, the title, the text, and the other legal pages under it, so the pages lead to one another. The pages have no navbar and no footer
 * (`currentOf` of the header, `docs/routing.md`), and the banner's room is kept free under the page (`--consent-h`).
 */
export function LegalPage({ title, href, children }: { title: string; href: LegalHref; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-var(--consent-h,0px))] w-full max-w-reading flex-col gap-8 px-gutter py-section">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {SITE_NAME}
        </Link>
        <h1 className="font-heading text-3xl">{title}</h1>
      </div>
      {children}
      <nav aria-label="Legal" className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {LEGAL_PAGES.filter((page) => page.href !== href).map((page) => (
          <Link key={page.href} href={page.href} className="underline-offset-4 hover:text-foreground hover:underline">
            {page.title}
          </Link>
        ))}
      </nav>
    </main>
  )
}

/** A section of a legal page: a title and its paragraphs, a line above it unless it is the first. `id` is the anchor other pages link to. */
export function LegalSection({ id, title, first = false, children }: { id?: string; title: string; first?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-8 flex-col gap-3">
      {!first && <Separator className="mb-5" />}
      <h2 className="font-heading text-lg">{title}</h2>
      {children}
    </section>
  )
}

/** A paragraph of a legal page. */
export function LegalText({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>
}

/** A bulleted list of a legal page, for the things a rule forbids or allows one after the other. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Named entries of a legal page, one under the other: a cookie or a storage key (`mono`, in the mono face), a kind of data, a recipient. The name is in the full text colour and what it is
 * in the muted one, the way a paragraph of the page is.
 */
export function LegalEntries({ items, mono = false }: { items: { name: string; text: ReactNode }[]; mono?: boolean }) {
  return (
    <dl className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.name} className="flex flex-col gap-1">
          <dt className={mono ? "font-mono text-sm text-foreground" : "text-foreground"}>{item.name}</dt>
          <dd className="text-muted-foreground">{item.text}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The line that ends a legal page: the day its text last changed. */
export function LegalUpdated({ on }: { on: string }) {
  return <p className="text-sm text-muted-foreground">Last updated {on}.</p>
}
