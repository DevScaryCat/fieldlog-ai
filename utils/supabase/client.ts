// /utils/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 대신 ANON_KEY 사용
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
