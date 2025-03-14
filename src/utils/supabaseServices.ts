import { supabase } from "../config/supabase";

export async function getConfigField(fieldName: string): Promise<string> {
  const { data, error } = await supabase
    .from("config")
    .select(fieldName)
    .single();
  if (error) {
    console.error(`❌ Error retrieving ${fieldName} from config:`, error);
    throw new Error(`Error retrieving ${fieldName} from config`);
  }
  if (!data || !data[fieldName as any]) {
    throw new Error(`${fieldName} not found in config`);
  }
  return data[fieldName as any];
}
export async function getSupportedTokens(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("config")
    .select("supported_tokens")
    .single();
  if (error) {
    console.error("❌ Error fetching supported tokens:", error);
    return {};
  }
  return data?.supported_tokens || {};
}
