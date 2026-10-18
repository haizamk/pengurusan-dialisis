import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
}

export function supabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey())
}

let cached: SupabaseClient | null = null

export function getSupabase() {
  if (!isSupabaseConfigured()) return null
  if (!cached) {
    cached = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: { persistSession: false },
    })
  }
  return cached
}
