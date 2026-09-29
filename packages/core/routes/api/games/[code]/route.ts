import type { NextRequest } from "next/server"
import { handle } from "../../../../server/api"
import { getPlayerId } from "../../../../server/player"
import { readGame, publicGame } from "../../../../server/games"

export const GET = handle(async (_request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  return publicGame(await readGame(code), await getPlayerId())
})
