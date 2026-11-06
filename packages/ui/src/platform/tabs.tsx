"use client"

import * as React from "react"
import { cn } from "../utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(
        "gap-2 group/tabs flex data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "rounded-xl bg-muted p-1 group-data-horizontal/tabs:h-9 group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "gap-2 rounded-lg border border-transparent! px-3 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap text-muted-foreground transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "data-active:bg-input/30 data-active:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
