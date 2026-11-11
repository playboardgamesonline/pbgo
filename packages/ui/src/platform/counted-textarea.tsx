import * as React from "react"
import { cn } from "../utils"
import { Textarea } from "./textarea"

type CountedTextareaProps = React.ComponentProps<typeof Textarea> & {
  /** How many characters are left, which is the caller's to count (it knows what is kept and how): the counter says it, and turns red below zero. */
  left: number
}

/** A `Textarea` with a counter in its bottom right corner: the characters that are left, red once they run out. The counter is part of the field's description, so a screen reader hears it with the field. */
function CountedTextarea({ left, className, "aria-describedby": describedBy, ...props }: CountedTextareaProps) {
  const id = React.useId()
  return (
    <div data-slot="counted-textarea" className="relative">
      <Textarea aria-describedby={[describedBy, `${id}-left`].filter(Boolean).join(" ")} className={cn("pb-8", className)} {...props} />
      <span id={`${id}-left`} className={cn("pointer-events-none absolute right-3 bottom-2.5 text-xs tabular-nums", left < 0 ? "text-destructive" : "text-muted-foreground")}>
        {left}
        <span className="sr-only"> characters left</span>
      </span>
    </div>
  )
}

export { CountedTextarea }
export type { CountedTextareaProps }
