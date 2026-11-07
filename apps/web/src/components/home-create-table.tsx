"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createApi } from "@pbgo/core/lib/api"
import { Button } from "@pbgo/ui/platform/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@pbgo/ui/platform/select"
import { toast } from "@pbgo/ui/platform/sonner"
import { messageOf } from "@/lib/table-door"

/**
 * Create a table, on the signed-in home: the game to play, then one button that opens the lobby with the game's own route (`POST /api/<slug>/games`, which sits the member down as their account) and takes them to it,
 * on the platform's page of the table (`/game/<slug>/<code>`), where they set the table up and share its link. The games are the ones that can be played. With none, the button says it is coming.
 */
export function HomeCreateTable({ games }: { games: readonly { slug: string; name: string }[] }) {
  const router = useRouter()
  const [slug, setSlug] = useState(games[0]?.slug ?? "")
  const [opening, setOpening] = useState(false)

  async function open() {
    if (!slug) return
    setOpening(true)
    try {
      const table = await createApi(slug).create({})
      router.push(`/game/${slug}/${table.code}`)
    } catch (error) {
      toast.error(messageOf(error))
      setOpening(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl md:text-4xl">Create a table</CardTitle>
        <CardDescription className="text-base">Open a table, share its link and play with your friends.</CardDescription>
      </CardHeader>
      {games.length > 0 && (
        <CardContent>
          <Select value={slug} onValueChange={setSlug} disabled={opening}>
            <SelectTrigger aria-label="Game" className="w-full">
              <SelectValue placeholder="Choose a game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.slug} value={game.slug}>
                  {game.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      )}
      <CardFooter>
        {games.length > 0 ? (
          <Button size="xl" className="w-full" disabled={opening || !slug} onClick={open}>
            Open a table
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="xl" className="w-full flex-col gap-0 disabled:opacity-100" disabled>
            <span className="flex items-center gap-2 leading-5">Open a table</span>
            <span className="text-xs leading-4 opacity-70">Coming soon</span>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
