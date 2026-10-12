import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"

/** 404 of the gamemaster (a slug that is not a game, a page a game does not have): in the platform's look, inside its own root layout. */
export default function GamemasterNotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-gutter text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-3xl">Page not found</h1>
      <p className="max-w-md text-muted-foreground">This page does not exist, or the game is not in the registry.</p>
      <Button asChild>
        <Link href="/gamemaster">All games</Link>
      </Button>
    </main>
  )
}
