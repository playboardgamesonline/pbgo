"use client"

import "./styles.css"
import type { ReactNode } from "react"
import type { ClientBinding } from "@pbgo/core/lib/binding"
import { BindingProvider } from "@pbgo/core/lib/binding-context"
import * as shared from "./index"
import { Logo } from "./ui"

const BINDING: ClientBinding = { ...shared, Logo }

/** Client side of the game (styles, binding), loaded by `GameRuntime` of @pbgo/games for its pages only. */
export default function Runtime({ children }: { children: ReactNode }) {
  return <BindingProvider binding={BINDING}>{children}</BindingProvider>
}
