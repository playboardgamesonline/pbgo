import { HomePage } from "@pbgo/core/pages/home"
import { gameOf } from "@/lib/game"

export default async function GameHome({ params }: PageProps<"/[game]">) {
  return <HomePage game={await gameOf(params)} />
}
