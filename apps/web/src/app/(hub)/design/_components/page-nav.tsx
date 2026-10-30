"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@pbgo/ui/utils"
import { FAMILIES, PAGES, type DesignPage } from "./pages"

const LINK = "block rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"

/** The families that have a page of their own, which lists their pages. */
const INDEX: Partial<Record<(typeof FAMILIES)[number], string>> = { Components: "/design/components" }

/** A page, and when it is the current one the sections it holds, as anchors. */
function PageLink({ page, pathname }: { page: DesignPage; pathname: string }) {
  const current = pathname === page.href
  return (
    <li>
      <Link href={page.href} aria-current={current ? "page" : undefined} className={cn(LINK, current && "bg-muted")}>
        {page.title}
      </Link>
      {current && (
        <ul className="my-1 ml-3 flex flex-col border-l pl-2">
          {page.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={cn(LINK, "py-1 text-muted-foreground hover:text-foreground")}>
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Side navigation of `/design`: the overview, then the pages, the page the visitor is on marked and opened onto its sections (plain anchors, no script for those). A family that has one page is that page; one that has several is a
 * label (a link, when the family has a page of its own) over its pages. It reads the address to know which page is current, the way the site's navbar does, so that it stays mounted from one page to the next and keeps its scroll.
 */
export function PageNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Design system" className="text-sm">
      <ul className="flex flex-col gap-1">
        <li>
          <Link href="/design" aria-current={pathname === "/design" ? "page" : undefined} className={cn(LINK, pathname === "/design" && "bg-muted")}>
            Overview
          </Link>
        </li>
        {FAMILIES.map((family) => {
          const pages = PAGES.filter((page) => page.family === family)
          const [only, ...others] = pages
          if (only && others.length === 0) return <PageLink key={family} page={only} pathname={pathname} />
          const index = INDEX[family]
          return (
            <li key={family} className="mt-4">
              {index ? (
                <Link href={index} aria-current={pathname === index ? "page" : undefined} className={cn(LINK, "text-muted-foreground", pathname === index && "bg-muted text-foreground")}>
                  {family}
                </Link>
              ) : (
                <p className="px-3 py-1.5 text-muted-foreground">{family}</p>
              )}
              <ul className="flex flex-col gap-1">
                {pages.map((page) => (
                  <PageLink key={page.slug} page={page} pathname={pathname} />
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
