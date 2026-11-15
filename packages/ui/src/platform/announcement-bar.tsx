import * as React from "react"
import { ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"
import { Button } from "./button"

// An announcement of the signed-in home: a slim bar in the middle of the page, as wide as its title and no wider than a line of text, with nothing in it but the title and, when it leads somewhere, an arrow. What it says in full is not drawn: a screen reader reads it after the title, and the
// page it leads to has it. A tone only tints it (a green rim for a success, the red of an alert). It is a bar, rounded as an alert is (`rounded-2xl`, the row step: at the surface's it would be a capsule). When it leads somewhere the whole bar but its close button is the link, so the target is as
// large as the bar; a plain `<a>`, since the package is framework-free and the target is a page the visitor loads whole. When the Studio says it can be dismissed, a small button at its end closes it; what closing does (the page keeps nothing) is the page's.

type AnnouncementTone = "info" | "success" | "alert"

/** What a tone adds to the bar: nothing for the usual one, a rim for a success, the colour of an alert for an alert. */
const TONES: Record<AnnouncementTone, string> = {
  info: "",
  success: "border-success/40",
  alert: "border-destructive/40 text-destructive",
}

type AnnouncementBarProps = Omit<React.ComponentProps<"div">, "title" | "children"> & {
  /** The one line the bar draws. */
  title: string
  /** What the announcement says in full: left out of the picture and read by a screen reader after the title. */
  message?: string
  tone?: AnnouncementTone
  /** Where the arrow leads. None: no arrow, and the bar is not a link. */
  href?: string
  /** What the link is called for a screen reader ("Read more"): the arrow says nothing. */
  linkLabel?: string
  /** What the close button does. None: no button, for an announcement that cannot be dismissed. */
  onDismiss?: () => void
}

function AnnouncementBar({ title, message, tone = "info", href, linkLabel, onDismiss, className, ...props }: AnnouncementBarProps) {
  const line = cn("flex h-full min-w-0 items-center gap-2 pl-4", onDismiss ? "pr-2" : "pr-4")
  const text = (
    <>
      <span className="truncate">{title}</span>
      {href && <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" className="size-4 shrink-0 transition-transform duration-fast group-hover/link:translate-x-0.5" />}
    </>
  )
  return (
    <div
      data-slot="announcement-bar"
      data-tone={tone}
      role={tone === "alert" ? "alert" : "status"}
      className={cn("flex h-10 w-fit max-w-full items-center rounded-2xl border bg-card text-sm text-card-foreground sm:max-w-xl", TONES[tone], className)}
      {...props}
    >
      {href ? (
        <a href={href} className={cn(line, "group/link rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/30")}>
          {text}
          {linkLabel && <span className="sr-only">{linkLabel}</span>}
        </a>
      ) : (
        <span className={line}>{text}</span>
      )}
      {message && <span className="sr-only">{message}</span>}
      {onDismiss && (
        <Button type="button" variant="ghost" size="icon-xs" className="mr-1.5 shrink-0" aria-label={`Dismiss: ${title}`} onClick={onDismiss}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export { AnnouncementBar }
export type { AnnouncementBarProps, AnnouncementTone }
