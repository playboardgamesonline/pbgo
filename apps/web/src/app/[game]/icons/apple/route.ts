import { renderIcon } from "@pbgo/core/metadata/images"
import { getGame } from "@pbgo/games"

// Generated from the favicon uploaded in the admin (Identity), else from the logo; linked from the [game] layout's metadata
export const revalidate = 300

export async function GET(_request: Request, { params }: RouteContext<"/[game]/icons/apple">) {
  const game = await getGame((await params).game)
  return game ? renderIcon(game, 180) : new Response(null, { status: 404 })
}
