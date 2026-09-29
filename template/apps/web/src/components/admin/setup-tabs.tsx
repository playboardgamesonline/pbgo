"use client"

import { usePathname, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pgo/ui/admin/tabs"

export function SetupTabs({ initial, settings, todo }: { initial: "settings" | "todo"; settings: React.ReactNode; todo: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <Tabs defaultValue={initial} onValueChange={(v) => router.replace(v === "settings" ? pathname : `${pathname}?tab=${v}`, { scroll: false })} className="gap-6">
      <TabsList>
        <TabsTrigger value="settings">Paramètres</TabsTrigger>
        <TabsTrigger value="todo">To-do</TabsTrigger>
      </TabsList>
      <TabsContent value="settings">{settings}</TabsContent>
      <TabsContent value="todo">{todo}</TabsContent>
    </Tabs>
  )
}
