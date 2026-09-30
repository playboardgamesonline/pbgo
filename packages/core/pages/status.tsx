import { redirect } from "next/navigation"

/** Ancienne adresse du suivi. */
export default function StatusPage() {
  redirect("/admin/monitoring/games")
}
