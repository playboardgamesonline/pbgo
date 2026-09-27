import type { NextRequest } from "next/server"
import { handle } from "@/server/api"
import { getJoueurId } from "@/server/joueur"
import { lirePartie, partiePublique } from "@/server/parties"

export const GET = handle(async (_request: NextRequest, ctx: RouteContext<"/api/parties/[code]">) => {
  const { code } = await ctx.params
  return partiePublique(await lirePartie(code), await getJoueurId())
})
