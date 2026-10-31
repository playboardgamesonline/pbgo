"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { DocSection } from "@pbgo/docs"
import { cn } from "@pbgo/ui/utils"

const LINK = "block rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"

/**
 * Side menu of `/docs`: the overview, then every section of the docs, each one a link to its landing page with the other pages of the section under it. It reads the address to know which page is current, the way the site's navbar does, so that
 * it stays mounted from one page to the next and keeps its scroll. The sections are what `@pbgo/docs` found on the disk, so a new file is a new entry with nothing to write here.
 */
export function DocsNav({ sections }: { sections: readonly DocSection[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Docs" className="text-sm">
      <ul className="flex flex-col gap-1">
        <li>
          <Link href="/docs" aria-current={pathname === "/docs" ? "page" : undefined} className={cn(LINK, pathname === "/docs" && "bg-muted")}>
            Overview
          </Link>
        </li>
        {sections.map((section) => {
          const others = section.pages.filter((page) => page.href !== section.href)
          return (
            <li key={section.slug} className="mt-4">
              <Link href={section.href} aria-current={pathname === section.href ? "page" : undefined} className={cn(LINK, pathname === section.href && "bg-muted")}>
                {section.title}
              </Link>
              {others.length > 0 && (
                <ul className="my-1 ml-3 flex flex-col border-l pl-2">
                  {others.map((page) => (
                    <li key={page.file}>
                      <Link href={page.href} aria-current={pathname === page.href ? "page" : undefined} className={cn(LINK, "py-1 text-muted-foreground hover:text-foreground", pathname === page.href && "bg-muted text-foreground")}>
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
