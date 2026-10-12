import { GamePage, gameMetadata } from "@pbgo/core/pages/game"
import { playableGameOf } from "@/lib/game"

export async function generateMetadata({ params }: PageProps<"/[game]/game/[code]">) {
  return gameMetadata(await playableGameOf(params), (await params).code)
}

export default async function Table({ params }: PageProps<"/[game]/game/[code]">) {
  return <GamePage game={await playableGameOf(params)} code={(await params).code} />
}
