import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"

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
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return cached
}

export function translateAuthError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login")) return "Emel atau kata laluan tidak sepadan."
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Tidak dapat menghubungi Supabase. Semak URL projek dan sambungan."
  }
  if (lower.includes("email not confirmed")) {
    return "Emel belum disahkan. Dalam Supabase, buka Authentication → Providers → Email dan matikan Confirm email."
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Emel ini sudah didaftarkan. Log masuk, atau guna emel lain."
  }
  if (lower.includes("password")) return "Kata laluan ditolak. Gunakan sekurang-kurangnya 8 aksara."
  return message
}

export function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Supabase tidak dikonfigurasi.")
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut() {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export function watchSession(onChange: (session: Session | null) => void) {
  const supabase = getSupabase()
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => onChange(session), 0)
  })
  return () => data.subscription.unsubscribe()
}
