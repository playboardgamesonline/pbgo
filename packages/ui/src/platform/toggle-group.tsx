"use client"

import * as React from "react"
import { LayoutGroup, MotionConfig, motion } from "motion/react"
import { SPRING_TRAVEL } from "../motion"
import { cn } from "../utils"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

/** The value that carries the thumb of a segmented group, or none: the chips of any other group draw their own fill. */
const ToggleGroupContext = React.createContext<string | null>(null)

/**
 * A set of chips to pick from. `type="single"` keeps one picked (a second click on it unpicks it: the value then reports an empty
 * string) and `type="multiple"` any number. The arrow keys move between the chips, one tab stop for the whole group. `variant="segmented"`
 * puts them in one container the width of its parent, on the `muted` fill like the track of a tab list, each chip the same width
 * (`flex-1`; give one `flex-none` and a width to make it narrower, an icon alone). In a segmented group that keeps one picked, the fill
 * behind the chip that is picked is a thumb that glides to the next chip when another is picked, with the spring of the navbar's fill
 * (`SPRING_TRAVEL`), and jumps when a visitor asks for less motion; a group that is `disabled` shows what is picked and takes no press.
 */
function ToggleGroup({
  className,
  variant = "chips",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { variant?: "chips" | "segmented" }) {
  // Each group scopes its own thumb, so that two groups on a page do not trade it
  const group = React.useId()
  // What is picked is kept here as well as in the primitive, whether the page holds it or the group does, so that the chip that is picked can carry the thumb
  const [own, setOwn] = React.useState(props.defaultValue)
  const picked = props.value ?? own
  const thumb = variant === "segmented" && props.type === "single" && typeof picked === "string" && picked !== "" ? picked : null
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={group}>
        <ToggleGroupContext.Provider value={thumb}>
          <ToggleGroupPrimitive.Root
            data-slot="toggle-group"
            data-variant={variant}
            className={cn("group/toggle-group flex flex-wrap gap-1.5", variant === "segmented" && "w-full flex-nowrap gap-1 rounded-xl bg-muted p-1", className)}
            {...props}
            onValueChange={(next: never) => {
              setOwn(next)
              props.onValueChange?.(next)
            }}
          />
        </ToggleGroupContext.Provider>
      </LayoutGroup>
    </MotionConfig>
  )
}

/** `fit` is for a chip of a segmented group that keeps the width of what it holds (an icon alone, with a width of its own) instead of sharing the width of the group with the others. */
function ToggleGroupItem({
  className,
  fit = false,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & { fit?: boolean }) {
  const lit = React.useContext(ToggleGroupContext) === props.value
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "group/toggle-item relative isolate inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-sm whitespace-nowrap text-foreground transition-all outline-none select-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/80 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 group-data-[variant=segmented]/toggle-group:border-transparent",
        // The thumb is the fill of the chip that is picked, so the chip draws none
        lit && "data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent",
        !fit && "group-data-[variant=segmented]/toggle-group:flex-1",
        className
      )}
      {...props}
    >
      {lit && (
        // One element for the whole group (`layoutId`): it is in the chip that is picked, under its content, and travels from the one that was picked
        <motion.span
          layoutId="toggle-group-thumb"
          aria-hidden="true"
          data-slot="toggle-group-thumb"
          className="absolute -inset-px -z-10 rounded-lg bg-primary group-hover/toggle-item:bg-primary/80"
          transition={SPRING_TRAVEL}
        />
      )}
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
