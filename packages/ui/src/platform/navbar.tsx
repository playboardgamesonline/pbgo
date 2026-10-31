"use client"

import * as React from "react"
import { LayoutGroup, MotionConfig, motion } from "motion/react"
import { Slot } from "radix-ui"
import { SPRING_TRAVEL } from "../motion"
import { cn } from "../utils"
import { Separator } from "./separator"

// The top of a platform page, in two containers kept apart, the way the product reads: the brand and the tabs on the left (`NavbarStart`),
// the account on the right (`NavbarEnd`). Each container is a glass island, a rounded square (a border, a blur, a light shadow: `rounded-2xl`,
// not a pill), and what it holds is rounded one step less (`rounded-lg`, the island's radius less its `p-2`), so the corners stay concentric.
// The bar between the islands is transparent: it lets the page and the pointer through, so the backdrop of the page shows behind both and the
// content of the page scrolls past the gap. The bar spans the window, not the width of the page: the islands sit on its edges, 1.5rem in
// from the top and from each side (the `p-6` of the bar, and the same 1.5rem is left under them: with their own 3.5rem that is the 6.5rem of
// `h-navbar`). The page pins the bar (`fixed inset-x-0 top-0 z-40`) and either leaves `pt-navbar` under it or lets its backdrop run under it.
//
// The current item, the logo or a tab, has a fill behind it, and that fill is one element for the whole bar (`layoutId`): when the current
// item changes, it glides to the next one with a spring (`SPRING_TRAVEL`, `@pbgo/ui/motion`) instead of jumping. It only glides if the bar stays
// mounted from one page to the next, which is why the hub mounts it once, in its layout. A visitor who asks for less motion gets the jump.

function Navbar({ className, children, ...props }: React.ComponentProps<"header">) {
  // Each bar scopes its own fill, so that two bars on one page (the specimens of the design docs) do not trade it
  const group = React.useId()
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={group}>
        <header data-slot="navbar" className={cn("pointer-events-none h-navbar", className)} {...props}>
          <div className="flex w-full items-center justify-between gap-4 p-6">{children}</div>
        </header>
      </LayoutGroup>
    </MotionConfig>
  )
}

/** The fill behind the current item: it sits inside that item, under its content, and glides from one item to the next. */
function CurrentFill() {
  return (
    <motion.span
      layoutId="navbar-current"
      aria-hidden="true"
      data-slot="navbar-current"
      className="absolute inset-0 -z-10 rounded-lg bg-muted"
      transition={SPRING_TRAVEL}
    />
  )
}

// One container of the bar: a glass island, a rounded square 3.5rem high, that takes the pointer back from the transparent bar. What it holds is
// 2.5rem high (`h-10`: the brand, the tabs, buttons of size `lg`, an avatar of `size-10`), which `p-2` frames.
const islandClassName =
  "pointer-events-auto flex h-14 items-center gap-1 rounded-2xl border glass p-2 shadow-surface"

/** The left container: the brand, then the tabs. */
function NavbarStart({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-start" className={cn(islandClassName, "min-w-0", className)} {...props} />
}

/**
 * The right container, apart from the first: the avatar of the account, or the sign-in and sign-up buttons. The buttons are `rounded-lg` here,
 * like the tabs of the first island (elsewhere a button is `rounded-xl`), so the page does not have to remember it.
 */
function NavbarEnd({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-end" className={cn(islandClassName, "shrink-0 [&_[data-slot=button]]:rounded-lg", className)} {...props} />
}

/**
 * A glass island on its own, for what hangs on the bar beside the two containers. The hub's right container, once a visitor is signed in, is not one: it is the dock
 * (`SocialDock`), which grows from a bar into a side panel. the design docs use an island to show the `FriendsBar`, which draws no container of its own.
 */
function NavbarIsland({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-island" className={cn(islandClassName, "shrink-0", className)} {...props} />
}

/**
 * The front page: a square button, usually around a `Logo` of `h-6`, the size of the tabs' text (give the link an `aria-label`). It is the home's
 * button, so `current` marks the front page itself, the way a tab marks its page: the fill of the bar is behind it (it was the tile turning white
 * once; the bar has one way to say where you are). On any other page it is as quiet as a tab.
 */
function NavbarBrand({
  className,
  asChild = false,
  current = false,
  children,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean; current?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="navbar-brand"
      aria-current={current ? "true" : undefined}
      className={cn(
        "relative isolate flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {current && <CurrentFill />}
    </Comp>
  )
}

/** The tabs, next to the brand in the same container. They leave it on a phone, where the account needs the room. */
function NavbarTabs({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="navbar-tabs"
      className={cn("hidden items-center gap-1 md:flex", className)}
      {...props}
    />
  )
}

/**
 * A hairline between two groups of tabs, in the same container: as high as the tabs' text and no more (`h-5`), in the colour of every border. It is for the eye alone (the tabs are
 * the same list for a screen reader), so it is `decorative`; the bar's `gap-1` is the room on each side of it.
 */
function NavbarSeparator({ className, ...props }: Omit<React.ComponentProps<typeof Separator>, "orientation" | "decorative">) {
  return <Separator data-slot="navbar-separator" orientation="vertical" className={cn("data-vertical:h-5 data-vertical:self-center", className)} {...props} />
}

const tabClassName = "inline-flex h-10 items-center whitespace-nowrap rounded-lg px-4 text-sm"

/**
 * One tab: a link, or its own link through `asChild` (the framework's). `current` marks the page the visitor is in.
 * A `disabled` tab is for a page that does not exist yet: text only, announced as a link that is off, and it keeps its `title` and nothing else.
 */
function NavbarTab({
  className,
  asChild = false,
  current = false,
  disabled = false,
  children,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean; current?: boolean; disabled?: boolean }) {
  if (disabled) {
    return (
      <span
        data-slot="navbar-tab"
        role="link"
        aria-disabled="true"
        title={props.title}
        className={cn(tabClassName, "cursor-default text-muted-foreground/60", className)}
      >
        {children}
      </span>
    )
  }
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="navbar-tab"
      aria-current={current ? "true" : undefined}
      className={cn(
        tabClassName,
        "relative isolate text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-[current]:text-foreground",
        className
      )}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {current && <CurrentFill />}
    </Comp>
  )
}

export { Navbar, NavbarStart, NavbarEnd, NavbarIsland, NavbarBrand, NavbarTabs, NavbarSeparator, NavbarTab }
