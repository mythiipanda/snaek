import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side Supabase client for reading items (public RLS allows read).
 * Use anon key so the app works without service role in the browser.
 */
export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export type Database = {
  public: {
    Tables: {
      items: {
        Row: {
          id: string;
          group_name: string;
          gun: string;
          skin_name: string;
          base_value: number | null;
          dg_value: string | null;
          ck_value: string | null;
          upg_value: string | null;
          status: string | null;
          image_url: string | null;
          source_image_url: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["items"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["items"]["Insert"]>;
      };
      metadata: {
        Row: {
          id: string;
          version: string | null;
          last_updated: string | null;
          source: string | null;
          discord: string | null;
          notes: unknown;
          created_at: string;
        };
      };
    };
  };
};
