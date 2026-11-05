import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../utils"
import { Slot } from "radix-ui"

const itemVariants = cva(
  "[a]:hover:bg-muted rounded-2xl border border-border text-sm group/item flex w-full flex-wrap items-center transition-colors duration-fast outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 [a]:transition-colors",
  {
    variants: {
      size: {
        default: "gap-3.5 px-4 py-3.5",
        sm: "gap-3.5 px-3.5 py-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Item({
  className,
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="item"
      data-size={size}
      className={cn(itemVariants({ size, className }))}
      {...props}
    />
  )
}

function ItemMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-media"
      className={cn(
        "gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start flex shrink-0 items-center justify-center [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "gap-1 flex flex-1 flex-col [&+[data-slot=item-content]]:flex-none",
        className
      )}
      {...props}
    />
  )
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        "gap-2 text-sm leading-snug underline-offset-4 line-clamp-1 flex w-fit items-center",
        className
      )}
      {...props}
    />
  )
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "text-muted-foreground text-left text-sm line-clamp-2 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("gap-2 flex items-center", className)}
      {...props}
    />
  )
}

export { Item, ItemMedia, ItemContent, ItemActions, ItemTitle, ItemDescription }
