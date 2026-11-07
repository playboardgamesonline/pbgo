import { Button } from "@pbgo/ui/platform/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@pbgo/ui/platform/card"

/**
 * Find a game, on the signed-in home, on the left of Create a table: look for a table among a choice of games, against players one does not know, ranked or not (PLT-21). Its way in is drawn as the way in of a game that cannot be
 * played yet is, a button that does nothing and says "Coming soon" under its label; the matching of players it will ask for is not built.
 */
export function HomeFindGame() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-3xl md:text-4xl">Find a game</CardTitle>
        <CardDescription className="text-base">Pick the games you like and play against other players, ranked or not.</CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto">
        <Button size="xl" className="w-full flex-col gap-0 disabled:opacity-100" disabled>
          <span className="flex items-center gap-2 leading-5">Find a game</span>
          <span className="text-xs leading-4 opacity-70">Coming soon</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
