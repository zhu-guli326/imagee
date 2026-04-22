import { createClient } from "@supabase/supabase-js";

const env = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
    : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

export const supabaseStorageBucket = "imagee-assets";
export const publicSupabaseUrl = supabaseUrl;
export const publicSupabaseAnonKey = supabaseAnonKey;
