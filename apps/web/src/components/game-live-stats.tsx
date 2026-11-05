import type { Account } from "@pbgo/accounts"
import { Metric } from "@pbgo/ui/platform/metric"
import { queueTime } from "@pbgo/ui/queue"
import { cn } from "@pbgo/ui/utils"
import { figure } from "@/lib/hub-stats"
import { FriendsPlaying } from "./friends-playing"

// What is going on in a game right now, under the buttons of the head of its page, as figures with no box: the players online ("184,363"), how long the queue is ("~0:40") and the friends of the visitor who are in the game (`FriendsPlaying`), each a `Metric`.
// A figure that cannot be counted is left out and never made up, and with all of them left out the row is not drawn: the players online are the ones the platform counts now (`getHubFigures`, the figure of the home, kept a minute: the platform's
// own until the presence is kept game by game), the queue time is the platform's estimate (`getQueueEstimate`, none yet), and the friends are only the signed-in visitor's.

export function GameLiveStats({ slug, online, queueSeconds, account, className }: { slug: string; online: number | null; queueSeconds: number | null; account: Account | null; className?: string }) {
  if (online === null && queueSeconds === null && !account) return null
  return (
    <dl aria-label="Right now" data-slot="game-live-stats" className={cn("flex flex-wrap gap-x-10 gap-y-4", className)}>
      {online !== null && <Metric label="Players online" value={figure(online)} />}
      {queueSeconds !== null && <Metric label="Queue time" value={`~${queueTime(queueSeconds)}`} />}
      {account && <FriendsPlaying slug={slug} account={account} />}
    </dl>
  )
}
