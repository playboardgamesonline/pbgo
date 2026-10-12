"use client"

import "@fontsource-variable/alegreya"
import "./styles.css"
import type { ReactNode } from "react"
import type { ClientBinding } from "@pbgo/core/lib/binding"
import { BindingProvider } from "@pbgo/core/lib/binding-context"
import * as shared from "./index"
import { Game, Logo } from "./ui"

const BINDING: ClientBinding = { ...shared, Logo, Game }

/** Client side of Courtisans (styles, fonts, binding), loaded by `GameRuntime` of @pbgo/games for /courtisans only. */
export default function Runtime({ children }: { children: ReactNode }) {
  return <BindingProvider binding={BINDING}>{children}</BindingProvider>
}
