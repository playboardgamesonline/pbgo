import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "../utils"

// The bar at the top of a platform page. It draws the bar (height, border, glass) and lays out two clusters apart, the way the product reads:
// the brand and the tabs on the left, the account on the right. The page pins it (`fixed inset-x-0 top-0 z-40`) and leaves `pt-navbar` under it.

function Navbar({ className, children, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="navbar"
      className={cn("h-navbar border-b bg-background/80 backdrop-blur-sm", className)}
      {...props}
    >
      <div className="mx-auto flex h-full w-full max-w-page items-center justify-between gap-4 px-gutter">
        {children}
      </div>
    </header>
  )
}

/** The left cluster: the brand, then the tabs. */
function NavbarStart({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="navbar-start"
      className={cn("flex min-w-0 items-center gap-2 md:gap-6", className)}
      {...props}
    />
  )
}

/** The right cluster, apart from the first: the avatar of the account, or the sign-in and sign-up buttons. */
function NavbarEnd({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="navbar-end"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  )
}

/** The way back to the front page: a link, usually around a `Logo` (give the link an `aria-label`). */
function NavbarBrand({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="navbar-brand"
      className={cn(
        "flex shrink-0 items-center rounded-md text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      {...props}
    />
  )
}

/** The tabs, next to the brand. They leave the bar on a phone, where the account needs the room. */
function NavbarTabs({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="navbar-tabs"
      className={cn("hidden items-center gap-1 md:flex", className)}
      {...props}
    />
  )
}

const tabClassName = "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-sm"

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
