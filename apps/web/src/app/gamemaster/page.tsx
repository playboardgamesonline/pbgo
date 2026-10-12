import { OverviewPage } from "@pbgo/core/pages/admin/overview"
import { GAMES } from "@pbgo/games/registry"

export const dynamic = "force-dynamic"

/** `/gamemaster`: every game of the registry. */
export default function Gamemaster() {
  return <OverviewPage games={GAMES} />
}
