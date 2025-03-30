import dotenv from "dotenv";

dotenv.config();

export const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL as string;
export const SUPABASE_URL = process.env.SUPABASE_URL as string;
export const SUPABASE_KEY = process.env.SUPABASE_KEY as string;

export const PORT = process.env.PORT || 3000;
