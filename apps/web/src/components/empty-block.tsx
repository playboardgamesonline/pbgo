import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"

/** What a block of the home's right column shows when it has nothing yet: an icon and a line, in a frame (`HomeAside`, `HomeTournaments`). */
export function EmptyBlock({ title, icon }: { title: string; icon: IconSvgElement }) {
  return (
    <Empty className="border p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  )
}
