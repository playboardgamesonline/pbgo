"use client"

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { DocPage, DocSection } from "@pbgo/docs"
import { cn } from "@pbgo/ui/utils"

const LINK = "block rounded-lg px-3 py-1.5 transition-colors hover:bg-muted"

/** A heading of the page the visitor is on: where it is and what it says. */
type Heading = { id: string; text: string }

/** What a heading says, without the link to itself that the markdown draws at its end. */
function textOf(heading: HTMLElement): string {
  return [...heading.childNodes]
    .filter((node) => !(node instanceof HTMLAnchorElement && node.hash === `#${heading.id}`))
    .map((node) => node.textContent ?? "")
    .join("")
    .trim()
}

// The sections of the page the visitor is on (its `h2`) are read from the page once it is drawn: the menu is a layout, so it is not given the page, and what the markdown made of its headings (their ids) is what there is to read. The page
// takes the place of the one before it in `main` when the address changes, which is what the menu waits for.
const NONE = "[]"

function subscribe(onChange: () => void) {
  const main = document.querySelector("main")
  if (!main) return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(main, { childList: true })
  return () => observer.disconnect()
}

function read(): string {
  const found = [...document.querySelectorAll<HTMLElement>('[data-slot="docs-markdown"] > h2[id]')]
  return JSON.stringify(found.map((heading): Heading => ({ id: heading.id, text: textOf(heading) })))
}

function useHeadings(): Heading[] {
  const snapshot = useSyncExternalStore(subscribe, read, () => NONE)
  return useMemo(() => JSON.parse(snapshot) as Heading[], [snapshot])
}

/**
 * Side menu of `/docs`: the overview, then every section of the docs, each one a link to its landing page with the pages of the section under it, a group of pages being a link to its own landing page with its pages under it. Under the
 * page that is open, the sections of that page: the way to jump to one, as the page is long. It reads the address to know which page is current, the way the site's navbar does, so that it stays mounted from one page to the next and
 * keeps its scroll. The sections are what `@pbgo/docs` found on the disk, so a new file is a new entry with nothing to write here.
 */
export function DocsNav({ sections }: { sections: readonly DocSection[] }) {
  const pathname = usePathname()
  const headings = useHeadings()

  const entry = (page: DocPage, depth: number) => {
    const current = pathname === page.href
    return (
      <li key={page.href} className={cn(depth === 0 && "mt-4")}>
        <Link href={page.href} aria-current={current ? "page" : undefined} className={cn(LINK, depth > 0 && "py-1 text-muted-foreground hover:text-foreground", current && "bg-muted text-foreground")}>
          {page.title}
        </Link>
        {current && headings.length > 0 && (
          <ul className="my-1 ml-3 flex flex-col border-l pl-2" aria-label={`On ${page.title}`}>
            {headings.map((heading) => (
              <li key={heading.id}>
                <a href={`#${heading.id}`} className={cn(LINK, "py-1 text-muted-foreground hover:text-foreground")}>
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        )}
        {page.pages.length > 0 && <ul className="my-1 ml-3 flex flex-col border-l pl-2">{page.pages.map((child) => entry(child, depth + 1))}</ul>}
      </li>
    )
  }

  return (
    <nav aria-label="Docs" className="text-sm">
      <ul className="flex flex-col gap-1">
        <li>
          <Link href="/docs" aria-current={pathname === "/docs" ? "page" : undefined} className={cn(LINK, pathname === "/docs" && "bg-muted")}>
            Overview
          </Link>
        </li>
        {sections.map((section) => entry(section, 0))}
      </ul>
    </nav>
  )
}

/**
 * The menu on a narrow window, folded into a `details` over the page. The layout keeps it mounted from one page to the next, so it would stay open on the page that was chosen in it: it folds as soon as a link in it is pressed, before the
 * page is scrolled to its new place (the menu is tall), and again when the address changes, for a way in that did not go through it (the back button).
 */
export function DocsMenuDisclosure({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (details.current) details.current.open = false
  }, [pathname])
  return (
    <details
      ref={details}
      className="rounded-2xl border px-4 py-3 lg:hidden"
      onClick={(event) => {
        if (details.current && event.target instanceof Element && event.target.closest("a")) details.current.open = false
      }}
    >
      <summary className="cursor-pointer">Sections and pages</summary>
      <div className="pt-4">{children}</div>
    </details>
  )
}
