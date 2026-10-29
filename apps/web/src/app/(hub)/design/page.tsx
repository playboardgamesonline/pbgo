import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@pbgo/ui/platform/badge"
import { Logo } from "@pbgo/ui/platform/logo"
import { SITE_NAME } from "@/site"
import { Code, PageNav } from "./_components/layout"
import { Badges, Buttons, Checks, Comboboxes, Inputs, Meters, ProviderButtons, Selects, Sliders, TabsSection, ToggleGroups } from "./_sections/controls"
import { InGameUi } from "./_sections/in-game-ui"
import { BoardPatterns, FaceCycles, Logos, Navbars, SearchBars, StatsSection, TitlePieces, Wordmarks } from "./_sections/navigation"
import { CookieBanners, Dialogs, Dropdowns, Popovers, Sheets, Toasts, Tooltips } from "./_sections/overlays"
import { Layers, Principles } from "./_sections/principles"
import {
  Alerts,
  Avatars,
  Cards,
  Empties,
  FriendsPanels,
  FriendsBars,
  GameCards,
  Items,
  Loading,
  Sections,
  Separators,
  SocialPanels,
  Tables,
} from "./_sections/surfaces"
import { GlassSection } from "./_sections/glass"
import { PlayfulMotion } from "./_sections/playful-motion"
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
 * Every token and every component of `@pbgo/ui/platform`, live. A platform screen is built from what is shown here,
 * and a piece that is missing is added to `@pbgo/ui` and to this page before it is used. The sections follow the
 * order of `_components/nav.ts`. The last group, In-game UI, is the one exception: it draws the components every game
 * shares (seat label, players strip, announcements, game over) in the theme of two games, side by side, each inside
 * its own `GameScope` (see `_components/game-scope.tsx`).
 */
export default function DesignPage() {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-gutter">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label={SITE_NAME} className="flex shrink-0 items-center gap-2">
              <Logo className="h-6" />
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
              these and from nothing else. The in-game UI is not: the last group draws the components every game shares in the
              look of two games, because each game owns its universe.
            </p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Code>@pbgo/ui/platform/*</Code>
              <Code>@pbgo/ui/styles/platform.css</Code>
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
            <GlassSection />
            <Motion />
            <PlayfulMotion />
            <Utilities />

            <Buttons />
            <ProviderButtons />
            <Badges />
            <Inputs />
            <Checks />
            <Selects />
            <Comboboxes />
            <Sliders />
            <Meters />
            <TabsSection />
            <ToggleGroups />
            <Logos />
            <Wordmarks />
            <FaceCycles />
            <Navbars />
            <SearchBars />
            <Dialogs />
            <Sheets />
            <Dropdowns />
            <Popovers />
            <Tooltips />
            <Toasts />
            <CookieBanners />
            <Cards />
            <GameCards />
            <Sections />
            <FriendsPanels />
            <FriendsBars />
            <SocialPanels />
            <BoardPatterns />
            <TitlePieces />
            <StatsSection />
            <Avatars />
            <Alerts />
            <Loading />
            <Separators />
            <Empties />
            <Items />
            <Tables />

            <InGameUi />
          </div>
        </main>
      </div>
    </div>
  )
}
