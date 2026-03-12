import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["VITE_SUPABASE_URL"];
const supabaseKey = process.env["VITE_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.warn("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — iCal sync will be disabled");
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;
