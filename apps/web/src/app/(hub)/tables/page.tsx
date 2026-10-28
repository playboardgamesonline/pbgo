import type { Metadata } from "next"
import { BlankPage } from "@/components/blank-page"

// Nothing on the page yet: it stays out of the search engines until it has something to say
export const metadata: Metadata = { title: "Tables", alternates: { canonical: "/tables" }, robots: { index: false } }

export default function TablesPage() {
  return <BlankPage tab="tables" title="Tables" />
}
