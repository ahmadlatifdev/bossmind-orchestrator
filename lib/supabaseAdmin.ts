import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client.
 * Uses SUPABASE_SERVICE_ROLE_KEY (never expose this to the browser).
 */
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env: SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
