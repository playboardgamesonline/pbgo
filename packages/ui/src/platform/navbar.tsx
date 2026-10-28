import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "../utils"

// The top of a platform page, in two containers kept apart, the way the product reads: the brand and the tabs on the left (`NavbarStart`),
// the account on the right (`NavbarEnd`). Each container is a glass island, a rounded square (a border, a blur, a light shadow: `rounded-2xl`,
// not a pill), and what it holds is rounded one step less (`rounded-lg`, the island's radius less its `p-2`), so the corners stay concentric.
// The bar between the islands is transparent: it lets the page and the pointer through, so the backdrop of the page shows behind both and the
// content of the page scrolls past the gap. The bar spans the window, not the width of the page: the islands sit on its edges, 0.75rem in
// from the top and from each side. The page pins the bar (`fixed inset-x-0 top-0 z-40`) and either leaves `pt-navbar` under it or lets its
// backdrop run under it.

function Navbar({ className, children, ...props }: React.ComponentProps<"header">) {
  return (
    <header data-slot="navbar" className={cn("pointer-events-none h-navbar", className)} {...props}>
      <div className="flex h-full w-full items-center justify-between gap-4 px-3">{children}</div>
    </header>
  )
}

// One container of the bar: a glass island, a rounded square 3.5rem high, that takes the pointer back from the transparent bar. What it holds is
// 2.5rem high (`h-10`: the brand, the tabs, buttons of size `lg`, an avatar of `size-10`), which `p-2` frames.
const islandClassName =
  "pointer-events-auto flex h-14 items-center gap-1 rounded-2xl border bg-background/80 p-2 shadow-surface backdrop-blur-md"

/** The left container: the brand, then the tabs. */
function NavbarStart({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-start" className={cn(islandClassName, "min-w-0", className)} {...props} />
}

/**
 * The right container, apart from the first: the avatar of the account, or the sign-in and sign-up buttons. The buttons are `rounded-lg` here,
 * like the tabs of the first island (a button is a pill elsewhere), so the page does not have to remember it.
 */
function NavbarEnd({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="navbar-end" className={cn(islandClassName, "shrink-0 [&_[data-slot=button]]:rounded-lg", className)} {...props} />
}

/**
 * The front page: a square tile, usually around a `Logo` of `h-6`, the size of the tabs' text (give the link an `aria-label`). It is the home's
 * button, so `current` marks the front page itself: the tile turns white (`bg-primary`) and the logo black, the way a button of the page is.
 * On any other page it is the way back, as quiet as a tab.
 */
function NavbarBrand({
  className,
  asChild = false,
  current = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean; current?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="navbar-brand"
      aria-current={current ? "true" : undefined}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 aria-[current]:bg-primary aria-[current]:text-primary-foreground aria-[current]:hover:bg-primary/80",
        className
      )}
      {...props}
    />
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
        {props.children}
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
        "text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-[current]:bg-muted aria-[current]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Navbar, NavbarStart, NavbarEnd, NavbarBrand, NavbarTabs, NavbarTab }
