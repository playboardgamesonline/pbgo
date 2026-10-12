import { siteTitle } from "@pbgo/core/lib/settings"
import { SHARE_IMAGE_ID } from "@pbgo/core/lib/site-url"
import { renderShareImage, SHARE_SIZE } from "@pbgo/core/metadata/images"
import { getGame } from "@pbgo/games"

// Share image: uploaded in the admin (Identity), else composed from the game's skin (Visual).
// A fixed id, so its URL is known (`shareImagePath` of @pbgo/core: JSON-LD, admin).
export const revalidate = 300

export async function generateImageMetadata({ params }: { params: { game: string } }) {
  const game = await getGame(params.game)
  return game ? [{ id: SHARE_IMAGE_ID, size: SHARE_SIZE, alt: siteTitle(game.binding.NAME), contentType: "image/png" }] : []
}

export default async function OpengraphImage({ params }: { params: Promise<{ game: string }>; id: Promise<string> }) {
  const game = await getGame((await params).game)
  return game ? renderShareImage(game) : new Response(null, { status: 404 })
}
