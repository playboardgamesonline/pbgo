import type { CSSProperties } from "react"
import { Badge } from "@pbgo/ui/platform/badge"
import { Perks, Stats } from "@pbgo/ui/platform/stats"
import { Tabletop } from "@pbgo/ui/platform/tabletop"

// The table of the home's hero seen in several ways, each in a hero of 1440 by 772 pixels shown at half its size, with the navbar, the title, the figures and the search bar in their places, so that the way the table is seen
// can be judged where it is used: the light of the lamp is the same in all of them, under the header and over the boards, and so is the dark of the header. What changes is how far the table is tilted, how far the eye is
// from it, where the eye is, whether the boards are turned in the plane of the table, and how wide a board is. The values are written under each.

type Perspective = {
  id: string
  name: string
  note: string
  tilt: number
  perspective: number
  origin: number
  plank: number
  turn: number
}

const PERSPECTIVES: readonly Perspective[] = [
  { id: "A", name: "Long table", note: "What the home has: the eye at the near end of a long table, the boards fanning gently towards a horizon above the window.", tilt: 66, perspective: 1200, origin: -25, plank: 260, turn: 0 },
  { id: "B", name: "From above", note: "A higher eye: less tilt and less fan, the boards nearly parallel and wide, as a table seen from a chair that is stood on.", tilt: 44, perspective: 1900, origin: -45, plank: 340, turn: 0 },
  { id: "C", name: "Low and deep", note: "The eye almost at the level of the table: the boards narrow fast into the distance, which is long and dark, the nearest ones huge.", tilt: 80, perspective: 560, origin: -6, plank: 200, turn: 0 },
  { id: "D", name: "Diagonal", note: "The boards cross the window on the diagonal, as a floor does in a photograph: no vertical stripe, so nothing in it looks like a frame.", tilt: 58, perspective: 1100, origin: -25, plank: 290, turn: 24 },
  { id: "E", name: "Wide angle", note: "The eye very close, as a wide lens would have it: the boards flare out at the sides, big at the near end and thin in the distance.", tilt: 60, perspective: 380, origin: -55, plank: 420, turn: 0 },
]

/** The hero, drawn as a stage of its real size and shown at half of it. */
function MiniHero({ perspective }: { perspective: Perspective }) {
  const vars = {
    "--tabletop-tilt": `${perspective.tilt}deg`,
    "--tabletop-perspective": `${perspective.perspective}px`,
    "--tabletop-origin": `${perspective.origin}%`,
    "--tabletop-plank": `${perspective.plank}px`,
    "--tabletop-turn": `${perspective.turn}deg`,
    // The lab is a window of 720 pixels: it is the phone's rule that does not apply, never the desktop's
    "--tabletop-pool": "40%",
  } as CSSProperties
  return (
    <div className="relative h-[386px] w-[720px] max-w-full overflow-hidden rounded-3xl border">
      <div className="absolute top-0 left-0 h-[772px] w-[1440px] origin-top-left scale-50 bg-linear-to-b from-card to-background">
        <Tabletop style={vars} />
        <div aria-hidden="true" className="absolute inset-x-6 top-6 flex items-start justify-between text-sm text-foreground">
          <div className="glass flex h-14 items-center gap-6 rounded-2xl border px-5">
            <span className="font-heading">PBGO</span>
            <span className="text-foreground/70">Games</span>
            <span className="text-foreground/70">Tables</span>
            <span className="text-foreground/70">Tournaments</span>
            <span className="text-foreground/70">What&apos;s New</span>
          </div>
          <div className="glass flex h-14 items-center gap-2 rounded-2xl border p-2">
            <span className="px-3">Sign in</span>
            <span className="rounded-xl bg-foreground px-4 py-2 text-background">Let&apos;s play</span>
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 top-[222px] flex flex-col items-center">
          <p className="display-title text-center text-[98px] text-foreground">
            <span className="block">Play your favorite</span>
            <span className="block">board games online</span>
          </p>
          <Stats className="mt-8" items={[{ value: "128", label: "players online", live: true }, { value: "12,480", label: "members" }, { value: "71", label: "games" }]} />
          <Perks className="mt-6" items={["Free to play", "No sign-up needed"]} />
          <div className="glass mt-14 flex h-16 w-[768px] items-center justify-between rounded-3xl border px-5 text-sm text-foreground/70 [--card:var(--card-bar)] [--glass-opacity:85%]">
            <span>Search games, tables &amp; tournaments…</span>
            <span>Any category</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Five ways of seeing the table, each as a hero. */
export function TablePerspectives() {
  return (
    <div className="flex flex-col gap-10">
      {PERSPECTIVES.map((perspective) => (
        <figure key={perspective.id} className="flex flex-col gap-3">
          <MiniHero perspective={perspective} />
          <figcaption className="flex max-w-[720px] flex-col gap-2">
            <p className="flex items-center gap-2 font-heading text-base">
              <Badge variant="secondary">{perspective.id}</Badge>
              {perspective.name}
            </p>
            <p className="text-sm text-muted-foreground">{perspective.note}</p>
            <p className="font-mono text-xs tracking-normal text-foreground">
              <span className="whitespace-nowrap">tilt {perspective.tilt}°</span> · <span className="whitespace-nowrap">eye {perspective.perspective}px away</span> ·{" "}
              <span className="whitespace-nowrap">at {perspective.origin}% of the stage</span> · <span className="whitespace-nowrap">boards {perspective.plank}px</span> ·{" "}
              <span className="whitespace-nowrap">turned {perspective.turn}°</span>
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
