"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowDown01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { filterPages, type DocPage, type DocSection } from "@pbgo/docs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@pbgo/ui/platform/input-group"
import { Logo } from "@pbgo/ui/platform/logo"
import { NavbarBrand } from "@pbgo/ui/platform/navbar"
import { cn } from "@pbgo/ui/utils"

const ROW = "block rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
const CURRENT = "bg-muted text-foreground"

/** The top of a doc's side menu: the logo, the brand's button as the navbar has it, which leads back to all the docs, and the name of the doc, which leads to its landing page. */
export function DocsHeader({ doc }: { doc: DocSection }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <NavbarBrand asChild>
        <Link href="/docs" aria-label="All docs" title="All docs">
          <Logo className="h-6" />
        </Link>
      </NavbarBrand>
      <Link href={doc.href} className="min-w-0 truncate font-heading text-xl">
        {doc.title}
      </Link>
    </div>
  )
}

/**
 * The side menu of a doc, under its name: a search of its pages, then its pages in the order of the disk, a group of pages being a section that folds like an accordion. It reads the address to know which page is current, the way the
 * site's navbar does, so that it stays mounted from one page of the doc to the next and keeps its scroll and what was folded or unfolded. The sections of the first level are open from the start and a deeper one is open when it holds the
 * current page, until the visitor says otherwise, and a search opens every section that has a page it found, and the menu scrolls to the current page when the address changes, as a doc of many pages is longer than the window. The menu
 * stops at the pages: it never lists what is in one, and a group is a label that folds, not a page: its landing page is reached from the doc's home and from the foot of the pages. What is in the menu is what `@pbgo/docs` found on the
 * disk: a new file is a new entry with nothing to write here.
 */
export function DocsSidebar({ doc }: { doc: DocSection }) {
  const pathname = usePathname()
  const menu = useRef<HTMLElement>(null)
  const [query, setQuery] = useState("")
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const searching = query.trim() !== ""
  const pages = useMemo(() => filterPages(doc.pages, query), [doc.pages, query])

  // The menu of the window that is too narrow for the side menu is folded in a closed `details`, where there is nothing to scroll to
  useEffect(() => {
    menu.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" })
  }, [pathname])

  const entry = (page: DocPage, depth: number) => {
    if (page.pages.length === 0) {
      const current = pathname === page.href
      return (
        <li key={page.href}>
          <Link href={page.href} aria-current={current ? "page" : undefined} className={cn(ROW, current && CURRENT)}>
            {page.title}
          </Link>
        </li>
      )
    }
    const holdsCurrent = pathname === page.href || pathname.startsWith(`${page.href}/`)
    const open = searching || (opened[page.href] ?? (depth === 0 || holdsCurrent))
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
            <ul className="my-1 ml-3 flex flex-col gap-0.5 border-l pl-2">{page.pages.map((child) => entry(child, depth + 1))}</ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  }

  return (
    <nav ref={menu} aria-label={`${doc.title} pages`} className="flex flex-col gap-4 text-sm">
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
        <ul className="flex flex-col gap-0.5">{pages.map((page) => entry(page, 0))}</ul>
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
