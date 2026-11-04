"use client"

import * as React from "react"
import { cn } from "../utils"
import { HoverCard as HoverCardPrimitive } from "radix-ui"

// A card that opens under the pointer when it rests on its trigger and closes soon after it leaves, for what a sighted visitor may want to glance at without pressing anything: the card of a player, on their picture. It is for the pointer
// alone: a touch has no hover, so whatever it says is also said somewhere that a press reaches (the list of the players of a table, in words). It opens after a short rest (`openDelay`) so that crossing a row of pictures does not
// flash a card for each, and it stays while the pointer crosses the gap to it (`closeDelay`).

function HoverCard({ openDelay = 200, closeDelay = 100, ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" openDelay={openDelay} closeDelay={closeDelay} {...props} />
}

/** The element the pointer rests on. It carries no `data-slot` of its own: it is nearly always another component's element (`asChild`: a picture), whose own slot a second one would replace. */
function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger {...props} />
}

/**
 * The card. It is portaled outside the page's `.platform` wrapper, so it carries the `platform` class itself, and it sits above the fixed navbar (`z-50`). Like the popovers it is translucent, a surface of the platform
 * (`rounded-4xl`, `glass`, `shadow-float`), and it stays 16px inside the window.
 */
function HoverCardContent({ className, align = "center", sideOffset = 8, collisionPadding = 16, ...props }: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "platform relative z-50 w-72 max-w-(--radix-hover-card-content-available-width) origin-(--radix-hover-card-content-transform-origin) rounded-4xl glass p-5 text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-hidden duration-fast data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardContent, HoverCardTrigger }
