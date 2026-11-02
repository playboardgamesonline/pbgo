import type { Specimens } from "@pbgo/docs/markdown"
import { QueueCardAndPillDemo, QueueDemo } from "./queue-demo"
import { Frame } from "./text"

// The live specimens of the queue, in the surfaces page of the design docs (`docs/design/03-components/04-surfaces.md`): the button of a game's page that becomes a counter, and the card and the pill that the social panel and the bar of the
// dock show of the same wait. The pieces that need the browser are in `queue-demo.tsx`: this file stays a server one, since the map of the specimens is read on the server. The buttons keep a queue of their own (the page's is
// `apps/web/src/lib/matchmaking.ts`, one for the whole hub).

function QueueButtonStates() {
  return (
    <Frame
      className="flex flex-wrap items-center gap-6"
      code={`// Press "Find a game": it becomes the counter with the cross, at the same width. The cross stops the search.
<QueueButton searching={false} seconds={0} onSearch={join} onCancel={leave}>Find a game</QueueButton>

// Searching, as it is a moment later
<QueueButton searching seconds={42} onSearch={join} onCancel={leave}>Find a game</QueueButton>

// The button of a game that cannot be played yet
<QueueButton searching={false} seconds={0} onSearch={join} onCancel={leave} disabled>Find a game</QueueButton>`}
    >
      <QueueDemo />
      <QueueDemo startAt={42} />
      <QueueDemo disabled />
    </Frame>
  )
}

function QueueCardAndPill() {
  return (
    <Frame
      className="grid items-start gap-6 md:grid-cols-2"
      code={`// In the social panel, at the top, over the tabs
<SocialPanel queue={{ game: "Courtisans", seconds: 42, onCancel: leave }} {...friends} />

// In the bar of the dock, while the panel is closed, before the games the friends are in
<QueuePill game="Courtisans" seconds={42} onCancel={leave} />`}
    >
      <QueueCardAndPillDemo />
    </Frame>
  )
}

export const queueSpecimens: Specimens = {
  "queue-button-searching-and-disabled": QueueButtonStates,
  "queue-card-and-pill": QueueCardAndPill,
}
