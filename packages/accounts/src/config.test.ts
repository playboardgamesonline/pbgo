import { describe, expect, it } from "vitest"
import { supabaseAuthConfig } from "./config"

describe("supabaseAuthConfig", () => {
  it("is the URL and the publishable key of the project", () => {
    expect(supabaseAuthConfig({ url: "https://abc.supabase.co", key: "sb_publishable_x" })).toEqual({ url: "https://abc.supabase.co", key: "sb_publishable_x" })
  })

  it("trims what the environment gives", () => {
    expect(supabaseAuthConfig({ url: " https://abc.supabase.co \n", key: " k " })).toEqual({ url: "https://abc.supabase.co", key: "k" })
  })

  it("is null when either is missing or blank: the hub then has no sign-in", () => {
    expect(supabaseAuthConfig({ url: undefined, key: "k" })).toBeNull()
    expect(supabaseAuthConfig({ url: "https://abc.supabase.co", key: undefined })).toBeNull()
    expect(supabaseAuthConfig({ url: "", key: "k" })).toBeNull()
    expect(supabaseAuthConfig({ url: "https://abc.supabase.co", key: "   " })).toBeNull()
  })
})
