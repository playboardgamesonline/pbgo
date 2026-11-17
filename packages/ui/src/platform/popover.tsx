"use client"

import * as React from "react"
import { splitRounded } from "../scroll-classes"
import { cn } from "../utils"
import { Popover as PopoverPrimitive } from "radix-ui"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

/**
 * A panel that opens on its trigger and holds a few controls. The content is portaled outside the page's `.platform` wrapper, so it
 * carries the `platform` class itself, and it sits above the fixed navbar (`z-50`). Like the menus it is translucent, with its blur
 * on the element itself. It names itself: give it an `aria-label`, or an `aria-labelledby` that points at its title.
 *
 * The panel clips and an element inside it scrolls: a browser draws a scrollbar along the straight edge of the element that scrolls and does not follow its corners, so a rounded panel that
 * scrolled itself would have the end of its thumb standing out of them (`docs/design/02-foundations/09-scrollbars.md`). What a caller passes in `className` is for the scrolling element (width, padding, gap, what its
 * children bleed into), but for the `rounded-*` classes, which are the panel's.
 */
function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  collisionPadding = 16,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const { box, scroller } = splitRounded(className)
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "platform relative z-50 flex max-h-(--radix-popover-content-available-height) origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-4xl glass text-popover-foreground shadow-float ring-1 ring-foreground/10 outline-hidden duration-fast data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          box
        )}
        {...props}
      >
        <div data-slot="popover-scroll" className={cn("flex min-h-0 w-72 max-w-(--radix-popover-content-available-width) flex-1 flex-col gap-3 overflow-y-auto p-4", scroller)}>
          {children}
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

/** The top of a panel: its title on the left, what acts on the whole panel (a "Clear" button) on the right. */
function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex min-h-8 items-center justify-between gap-2", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-heading text-base", className)}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle }
