import { GameNotFound } from "@/components/game-not-found"

/**
 * 404 of a page under `/<slug>/...` (`notFound()` of `gameOf` / `playableGameOf`): a table, an admin section or a preview that
 * does not exist in a game, or any page of a slug that is not a game. See `GameNotFound`. Next answers with status 404 and
 * `noindex`, and renders this on the client: the server HTML of a `notFound()` has an empty body.
 */
export default function NotFound() {
  return <GameNotFound />
}
