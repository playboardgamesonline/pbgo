"use client"

import * as React from "react"
import { cn } from "../utils"
import { Avatar as AvatarPrimitive } from "radix-ui"
import { Badge } from "./badge"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg" | "xl"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-lighten data-[size=lg]:size-10 data-[size=sm]:size-6 data-[size=xl]:size-16",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs group-data-[size=xl]/avatar:text-xl",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-(color:--cutout) select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

/**
 * What waits for the person the picture is (messages not read, requests to answer), as a red count (`notification`) on its top right corner, outlined in the colour of the page so that it stands clear of the
 * picture, as `AvatarBadge` is at the bottom right. Nothing is drawn for 0, and a count over 99 says so.
 */
function AvatarCount({ count, className, ...props }: Omit<React.ComponentProps<typeof Badge>, "children"> & { count: number }) {
  if (count <= 0) return null
  return (
    <Badge data-slot="avatar-count" variant="notification" className={cn("absolute -top-1 -right-1 z-10 h-4 min-w-4 justify-center px-1 ring-2 ring-(color:--cutout)", className)} {...props}>
      {count > 99 ? "99+" : count}
    </Badge>
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarCount }
