import type { Metadata } from "next"
import { LoginPage } from "@pbgo/core/pages/admin/login"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Log in" }

/** `/gamemaster/login`, the one page of the gamemaster open without a session. */
export default async function Login({ searchParams }: PageProps<"/gamemaster/login">) {
  return <LoginPage next={(await searchParams).next} />
}
