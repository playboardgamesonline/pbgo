"use client"

import type { CSSProperties, ReactElement } from "react"
import { Alert02Icon, Cancel01Icon, CancelCircleIcon, CheckmarkCircle02Icon, InformationCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast as sonner, Toaster as Sonner, type ExternalToast, type ToastClassnames, type ToasterProps } from "sonner"
import { TOAST_DURATION, withToastDefaults, type ToastKind } from "../toasts"
import { cn } from "../utils"
import { buttonVariants } from "./button"

// The toasts of the platform: a message that confirms or warns and goes by itself, or, `fixed`, stays until it is closed with the cross at its top right corner. Sonner draws the plain ones (a kind, a message, a second line, a button) and every caller of `toast` gets them with no
// change; the toasts that draw themselves (a person, with buttons: `person-toast.tsx`) go through `toast.custom` and have the same surface. The look is `Toaster`'s: sonner is `unstyled` and every class is here, the size, the corners and the glass, so
// that the toasts follow the design system and the member's choices: the glass is solid when they ask for less transparency (`glass`), and the toasts stop moving when they ask for less motion (`motion-reduce:`). `fixed` and the durations are `../toasts`'s.
// Sonner's own stylesheet is not in a cascade layer, so it beats every utility of ours that it also sets (the font of its toaster, its transitions, the shadow of its focus and the colours of the cross of its dark theme): those carry `!`, and nothing else does.

/** The width of a toast, in steps of the spacing scale (96 is 24rem): sonner's own variable, which the toasts that draw themselves read as well. */
const WIDTH = "calc(var(--spacing) * 96)"

/**
 * The width a toast that draws itself is given (`toast.custom`): the width of the toaster, and on a phone what sonner leaves between its margins. A toast of sonner's own has this from its class; one that draws itself is not styled by the toaster, and in a toaster that is not
 * the platform's (the games' own) it is the only place its width comes from.
 */
const CUSTOM_WIDTH: CSSProperties = { width: "min(var(--width), calc(100vw - var(--mobile-offset-left) - var(--mobile-offset-right)))" }

/** Where the toasts stand above the foot of the window: the room the page keeps free for the consent banner (`--consent-h`, set on <body>, 0 without a banner) and the margin of the toaster, so that a toast never covers the buttons of the banner. */
const OFFSET = { bottom: "calc(var(--consent-h, 0px) + 1.5rem)" }
const MOBILE_OFFSET = { bottom: "calc(var(--consent-h, 0px) + 1rem)" }

/**
 * What every toast is made of: a floating container, the glass of the platform at the roundest step of a surface, with its padding (`nest-4xl/4`: the corner of `rounded-4xl` and the padding of `p-4`, which a box inside it, the tile of an icon or a button, reads with `rounded-nested`).
 * A toast is at least as tall as its icon tile and its padding, so that this corner never reaches half of its height.
 */
const TOAST_SURFACE = "border glass nest-4xl/4 text-foreground shadow-float"

/** A toast of sonner's own, plain: the icon of its kind in a tile, the message and its second line, then the buttons, in one row. The cross of a fixed toast is at its top right corner and the row keeps clear of it. */
const PLAIN = cn(TOAST_SURFACE, "flex w-(--width) items-center gap-3 has-data-[close-button]:pr-12 focus-visible:ring-3! focus-visible:ring-ring/30!")

const CLASS_NAMES: ToastClassnames = {
  // Every toast, the ones that draw themselves too: in the font of the platform (sonner gives its toaster a font of its own, which the toast would inherit) and with sonner's own movements stopped when the member asks for less motion
  toast: "group/toast font-sans outline-none motion-reduce:animate-none! motion-reduce:transition-none! motion-reduce:*:transition-none!",
  success: PLAIN,
  error: PLAIN,
  info: PLAIN,
  warning: PLAIN,
  loading: PLAIN,
  icon: "relative size-10 shrink-0",
  loader: "size-full",
  content: "flex min-w-0 flex-1 flex-col gap-0.5",
  title: "text-base text-foreground",
  description: "text-sm text-muted-foreground",
  actionButton: cn(buttonVariants({ size: "default" }), "rounded-nested"),
  cancelButton: cn(buttonVariants({ variant: "secondary", size: "default" }), "rounded-nested"),
  closeButton: cn(
    buttonVariants({ variant: "ghost", size: "icon-xs" }),
    "absolute top-3 right-3 border-transparent! bg-transparent! text-muted-foreground! hover:border-transparent! hover:bg-muted/50! hover:text-foreground!",
  ),
}

const TONES = {
  neutral: "bg-muted text-foreground",
  success: "bg-success/20 text-success",
  destructive: "bg-destructive/20 text-destructive",
} as const

/** The icon of a kind of toast, in a tile that fills the place sonner gives its icon: green for a confirmation, red for an error, the neutral grey for the rest. */
function ToastIcon({ icon, tone = "neutral", spin = false }: { icon: typeof Alert02Icon; tone?: keyof typeof TONES; spin?: boolean }) {
  return (
    <span className={cn("grid size-full place-items-center rounded-nested", TONES[tone])}>
      <HugeiconsIcon icon={icon} strokeWidth={2} className={cn("size-5", spin && "motion-safe:animate-spin")} />
    </span>
  )
}

const ICONS = {
  success: <ToastIcon icon={CheckmarkCircle02Icon} tone="success" />,
  info: <ToastIcon icon={InformationCircleIcon} />,
  warning: <ToastIcon icon={Alert02Icon} />,
  error: <ToastIcon icon={CancelCircleIcon} tone="destructive" />,
  loading: <ToastIcon icon={Loading03Icon} spin />,
  close: <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />,
}

/**
 * The platform's toaster, mounted once in each layout that has toasts (the hub's, the gamemaster's; a game mounts its own, in its own look). The toasts stand in a column, all of them in view and never folded behind the newest, since what a toast
 * asks for must be reachable, up to three at a time (the toasts of a burst of friend requests are as many); a toast that is not `fixed` goes after the time to read it (`toastDuration`) and waits while the pointer is over it. The `platform` class carries the platform's variables, since the toaster is rendered outside the page's own `.platform` wrapper.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group platform motion-reduce:transition-none!"
      expand
      duration={TOAST_DURATION.careful}
      icons={ICONS}
      style={{ "--width": WIDTH } as CSSProperties}
      offset={OFFSET}
      mobileOffset={MOBILE_OFFSET}
      toastOptions={{ unstyled: true, closeButtonAriaLabel: "Dismiss", classNames: CLASS_NAMES }}
      {...props}
    />
  )
}

/** What a toast can be raised with: sonner's options, and `fixed`, which keeps the toast until its cross is pressed (`../toasts`). */
type ToastOptions = ExternalToast & { fixed?: boolean }
type ToastMessage = Parameters<typeof sonner>[0]

const raise = (kind: ToastKind, send: (message: ToastMessage, options?: ExternalToast) => string | number) => (message: ToastMessage, options?: ToastOptions) => send(message, withToastDefaults(kind, options))

/**
 * A toast that draws itself, with what the plain ones have: the width of the toaster and, unless the options say otherwise, the time of a message. `render` gets the toast's id, to dismiss it (`toast.dismiss(id)`) once the toast has been answered; the cross of a
 * `fixed` one is the toast's to draw. An `id` of the options makes it one toast: raised again, it is updated where it is and not drawn twice.
 */
function custom(render: (id: string | number) => ReactElement, options?: ToastOptions): string | number {
  return sonner.custom(render, { ...withToastDefaults("message", options), style: { ...CUSTOM_WIDTH, ...options?.style } })
}

/**
 * Raises a toast from anywhere: `toast.success("Saved")`, `toast.error("The table could not be saved", { description })`, and `{ fixed: true }` for one that stays until it is closed. It goes by itself after the time to read it, unless `duration` says otherwise. Sonner's own
 * `dismiss`, `loading` and `promise` are here as they are.
 */
const toast = Object.assign(raise("message", sonner), {
  message: raise("message", sonner.message),
  success: raise("success", sonner.success),
  info: raise("info", sonner.info),
  warning: raise("warning", sonner.warning),
  error: raise("error", sonner.error),
  custom,
  loading: sonner.loading,
  promise: sonner.promise,
  dismiss: sonner.dismiss,
  getHistory: sonner.getHistory,
  getToasts: sonner.getToasts,
})

export { TOAST_SURFACE, Toaster, toast }
export type { ToastOptions }
