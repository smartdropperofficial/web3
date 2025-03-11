import dotenv from "dotenv";

dotenv.config();

export const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL as string;
export const NEXT_PUBLIC_SUPABASE_URL = process.env
  .NEXT_PUBLIC_SUPABASE_URL as string;
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env
  .NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
export const PORT = process.env.PORT || 3000;
