"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowDown01Icon, ArrowLeft02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { filterPages, matchesQuery, type DocPage, type DocSection } from "@pbgo/docs"
import { Button } from "@pbgo/ui/platform/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pbgo/ui/platform/input-group"
import { cn } from "@pbgo/ui/utils"

const ROW = "block rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
const CURRENT = "bg-muted text-foreground"

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

/** The sections of the page that is open, under its entry: the way to jump to one, as a page is long. */
function PageSections({ headings, title }: { headings: readonly Heading[]; title: string }) {
  if (headings.length === 0) return null
  return (
    <ul className="my-1 ml-3 flex flex-col border-l pl-2" aria-label={`On ${title}`}>
      {headings.map((heading) => (
        <li key={heading.id}>
          <a href={`#${heading.id}`} className={cn(ROW, "py-1")}>
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The top of a doc's side menu: the way back to all the docs and the name of the doc, which leads to its landing page. */
export function DocsHeader({ doc }: { doc: DocSection }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href="/docs" aria-label="All docs" title="All docs">
          <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} aria-hidden="true" />
        </Link>
      </Button>
      <Link href={doc.href} className="min-w-0 truncate font-heading text-xl">
        {doc.title}
      </Link>
    </div>
  )
}

/**
 * The side menu of a doc, under its name: a search of its pages, then its pages in the order of the disk, a group of pages being a section that folds like an accordion. It reads the address to know which page is current, the way the
 * site's navbar does, so that it stays mounted from one page of the doc to the next and keeps its scroll and what was folded or unfolded. The section that holds the current page is open until the visitor says otherwise, and a search opens
 * every section that has a page it found. Under the page that is open, its own sections. What is in the menu is what `@pbgo/docs` found on the disk: a new file is a new entry with nothing to write here.
 */
export function DocsSidebar({ doc }: { doc: DocSection }) {
  const pathname = usePathname()
  const headings = useHeadings()
  const [query, setQuery] = useState("")
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const searching = query.trim() !== ""
  const pages = useMemo(() => filterPages(doc.pages, query), [doc.pages, query])

  const link = (page: DocPage, label: string) => {
    const current = pathname === page.href
    return (
      <>
        <Link href={page.href} aria-current={current ? "page" : undefined} className={cn(ROW, current && CURRENT)}>
          {label}
        </Link>
        {current && <PageSections headings={headings} title={page.title} />}
      </>
    )
  }

  const entry = (page: DocPage) => {
    if (page.pages.length === 0) return <li key={page.href}>{link(page, page.title)}</li>
    const holdsCurrent = pathname === page.href || pathname.startsWith(`${page.href}/`)
    const open = searching || (opened[page.href] ?? holdsCurrent)
    return (
      <li key={page.href}>
        <Collapsible open={open} onOpenChange={(next) => setOpened((state) => ({ ...state, [page.href]: next }))}>
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-foreground transition-colors hover:bg-muted">
            {page.title}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="my-1 ml-3 flex flex-col gap-0.5 border-l pl-2">
              {(!searching || matchesQuery(page.title, query)) && <li>{link(page, "Overview")}</li>}
              {page.pages.map(entry)}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  return (
    <nav aria-label={`${doc.title} pages`} className="flex flex-col gap-4 text-sm">
      <InputGroup>
        <InputGroupAddon>
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("")
          }}
          placeholder="Search pages..."
          aria-label={`Search the pages of ${doc.title}`}
          autoComplete="off"
        />
      </InputGroup>
      {pages.length > 0 ? (
        <ul className="flex flex-col gap-0.5">{pages.map(entry)}</ul>
      ) : (
        <p className="px-3 text-muted-foreground">{searching ? "No page matches" : "No pages yet"}</p>
      )}
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
      className="rounded-2xl border px-4 py-3"
      onClick={(event) => {
        if (details.current && event.target instanceof Element && event.target.closest("a")) details.current.open = false
      }}
    >
      <summary className="cursor-pointer">Pages</summary>
      <div className="pt-4">{children}</div>
    </details>
  )
}
