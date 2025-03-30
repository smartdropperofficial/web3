import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./dotenv";

console.log("🔹 Initializing Supabase client...");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables");
  throw new Error("Supabase URL or Key is missing");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Supabase client initialized!");
