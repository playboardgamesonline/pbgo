import type { Metadata } from "next"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { DiceIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@pbgo/ui/platform/badge"
import { SITE_NAME } from "@/site"
import { Code, PageNav } from "./_components/layout"
import { Badges, Buttons, Checks, Inputs, Selects, TabsSection } from "./_sections/controls"
import { HudParts, HudScope } from "./_sections/hud"
import { CookieBanners, Dialogs, Dropdowns, Sheets, Toasts, Tooltips } from "./_sections/overlays"
import { Layers, Principles } from "./_sections/principles"
import {
  Alerts,
  Avatars,
  Cards,
  Empties,
  GameCards,
  Items,
  Loading,
  Separators,
  Tables,
} from "./_sections/surfaces"
import { Colors, Depth, Layout, Motion, Radius, Typography, Utilities } from "./_sections/tokens"

// Internal reference for the team and its agents: out of search results (noindex here, absent from the sitemap, which
// lists the hub and the indexable games only) and out of crawlers' way.
export const metadata: Metadata = {
  title: "Design system",
  description: "Tokens and components of the platform. Internal reference.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/design" },
}

/**
 * Every token and every component of `@pbgo/ui/platform`, live, then the in-game UI that every game shares
 * (`@pbgo/ui/styles/hud.css` and the primitives of `@pbgo/core/components/game/hud-ui`). A platform screen is built
 * from what is shown here, and a piece that is missing is added to `@pbgo/ui` and to this page before it is used. The
 * sections follow the order of `_components/nav.ts`.
 */
export default function DesignPage() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-gutter">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <HugeiconsIcon icon={DiceIcon} strokeWidth={2} className="size-5" />
              <span className="hidden sm:inline">{SITE_NAME}</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="truncate">Design system</span>
          </div>
          <Badge variant="outline">Internal · not indexed</Badge>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-12 px-gutter">
        <aside className="sticky top-0 hidden h-svh w-56 shrink-0 overflow-y-auto pt-20 pb-8 lg:block">
          <PageNav />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-12 py-section">
          <div className="flex flex-col gap-4">
            <h1 className="font-heading text-4xl md:text-5xl">Design system</h1>
            <p className="max-w-reading text-lg text-muted-foreground">
              The tokens and components of the platform, as they render today. Hub, account, legal, admin and 404 are built from
              these and from nothing else. The in-game UI that every game shares comes last, with the theme a game can set on it.
            </p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Code>@pbgo/ui/platform/*</Code>
              <Code>@pbgo/ui/styles/platform.css</Code>
              <Code>@pbgo/ui/styles/hud.css</Code>
              <Code>@pbgo/ui/theme</Code>
            </p>
          </div>

          <details className="rounded-2xl border px-4 py-3 lg:hidden">
            <summary className="cursor-pointer">Sections</summary>
            <div className="pt-4">
              <PageNav />
            </div>
          </details>

          <div className="flex flex-col gap-16">
            <Principles />
            <Layers />
            <Colors />
            <Typography />
            <Radius />
            <Layout />
            <Depth />
            <Motion />
            <Utilities />

            <Buttons />
            <Badges />
            <Inputs />
            <Checks />
            <Selects />
            <TabsSection />
            <Dialogs />
            <Sheets />
            <Dropdowns />
            <Tooltips />
            <Toasts />
            <CookieBanners />
            <Cards />
            <GameCards />
            <Avatars />
            <Alerts />
            <Loading />
            <Separators />
            <Empties />
            <Items />
            <Tables />

            <HudScope />
            <HudParts />
          </div>
        </main>
      </div>
    </div>
  )
}
