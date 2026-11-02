"use client"

import { ArrowDown01Icon, ArrowUpRight01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@pbgo/ui/platform/dropdown-menu"
import type { GameRulebook } from "@/lib/game-page"

// The rules of a game, as one button among those under the credits in the head of its page. A rulebook is a PDF in a language, on the publisher's site: with one, the button is the link to it, and with several it opens a small menu with a row for each language, the visitor's
// first (`rulebooks` of `lib/game-page.ts`). A link opens in a new tab, which the arrow says. The language's code is a chip that a screen reader does not read (the link carries the `lang`, and the title is in that language: "Règles du jeu - Flip 7").
// A game with no rulebook has no button at all. It is a client component for the menu alone.

export function RulesButton({ rulebooks }: { rulebooks: readonly GameRulebook[] }) {
  const [only] = rulebooks
  if (!only) return null

  const book = <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />

  if (rulebooks.length === 1) {
    return (
      <Button variant="outline" asChild>
        <a href={only.href} target="_blank" rel="noopener noreferrer" lang={only.language}>
          {book}
          Rules
          <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
        </a>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {book}
          Rules
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        {rulebooks.map(({ language, label, href }) => (
          <DropdownMenuItem key={language} asChild>
            <a href={href} target="_blank" rel="noopener noreferrer" lang={language}>
              <Badge variant="outline" aria-hidden="true" className="min-w-9">
                {language.toUpperCase()}
              </Badge>
              {label}
              <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="ml-auto text-muted-foreground" aria-hidden="true" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
