// What a toast is made of, in numbers: how long one that goes by itself stays, and what a toast that stays does. No React in this file, so that it is tested as it is.

/** The kinds of the plain toast, as `toast` names them: a message with no icon, a confirmation, a piece of news, a warning and an error. */
export type ToastKind = "message" | "success" | "info" | "warning" | "error"

/**
 * How long a toast that goes by itself stays, in milliseconds. A toast waits while the pointer is over it and while the tab is hidden, so these are the time to read it, not the time to reach it.
 * A confirmation is read at a glance. A warning or an error is read, then acted on. A second line (a description) is more to read. A toast that asks for an answer, the buttons of a friend request, stays longest: it is reached with the pointer or the keyboard.
 */
export const TOAST_DURATION = {
  quick: 5_000,
  careful: 8_000,
  description: 3_000,
  request: 12_000,
} as const

/** How long a plain toast of this kind stays when nothing says otherwise: a warning or an error stays longer than a confirmation, and a description adds time to either. */
export function toastDuration(kind: ToastKind, hasDescription = false): number {
  const base = kind === "warning" || kind === "error" ? TOAST_DURATION.careful : TOAST_DURATION.quick
  return base + (hasDescription ? TOAST_DURATION.description : 0)
}

/** What a caller may give a toast, besides sonner's own: `fixed` makes it stay until it is closed. */
export type ToastOptionsInput = { duration?: number; closeButton?: boolean; description?: unknown; fixed?: boolean }

/**
 * The options a toast is raised with. A duration the caller gave is kept; a `fixed` toast has none (it stays until it is closed) and always has the cross that closes it, since a toast that stays and cannot be closed would be a trap;
 * any other goes by itself after `toastDuration`. `fixed` is the platform's word: sonner is never told it.
 */
export function withToastDefaults<T extends ToastOptionsInput>(kind: ToastKind, options?: T): Omit<T, "fixed"> & { duration: number; closeButton?: boolean } {
  const { fixed, ...rest } = options ?? ({} as T)
  if (fixed) return { ...rest, duration: Number.POSITIVE_INFINITY, closeButton: true }
  return { ...rest, duration: rest.duration ?? toastDuration(kind, Boolean(rest.description)) }
}
