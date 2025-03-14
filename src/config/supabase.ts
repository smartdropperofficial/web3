import { createClient } from "@supabase/supabase-js";

console.log("🔹 Initializing Supabase client...");

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("✅ Supabase client initialized!");
