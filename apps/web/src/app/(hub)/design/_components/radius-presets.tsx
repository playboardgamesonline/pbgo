import type { CSSProperties } from "react"
import { Avatar, AvatarFallback } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Input } from "@pbgo/ui/platform/input"
import { Tabs, TabsList, TabsTrigger } from "@pbgo/ui/platform/tabs"

const PRESETS = [
  { radius: "0.625rem", label: "10px: the base before" },
  { radius: "0.75rem", label: "12px: the one in use" },
  { radius: "0.875rem", label: "14px: too round, a button is a capsule" },
] as const

/** The same few components under three values of `--radius`, set on the box: every corner in it follows. */
export function RadiusPresets() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PRESETS.map(({ radius, label }) => (
        <div key={radius} className="flex flex-col gap-3" style={{ "--radius": radius } as CSSProperties}>
          <div className="flex flex-col gap-4 rounded-3xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>O</AvatarFallback>
              </Avatar>
              <Button>Play</Button>
              <Button variant="outline">Join</Button>
              <Badge>3</Badge>
            </div>
            <Input placeholder="Search" aria-label={`Search, with a base of ${label}`} />
            <Tabs defaultValue="friends">
              <TabsList className="w-full">
                <TabsTrigger value="friends">Friends</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}
