import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(value?: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey);

export function createSupabaseClient() {
  if (!supabaseUrl || !isValidSupabaseUrl(supabaseUrl) || !supabaseAnonKey) {
    return null;
  }

  const url = supabaseUrl;
  const anonKey = supabaseAnonKey;

  return createBrowserClient(url, anonKey);
}
