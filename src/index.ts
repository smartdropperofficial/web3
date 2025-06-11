import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { createClient } from "@supabase/supabase-js";

async function loadEnvFromSSM() {
  const ssm = new SSMClient({ region: "us-east-1" });
  const prefix = "/smartdropper/dev/smartdropper-api";

  const command = new GetParametersByPathCommand({
    Path: prefix,
    Recursive: true,
    WithDecryption: true,
  });

  const response = await ssm.send(command);

  for (const param of response.Parameters || []) {
    const key = param.Name?.split("/").pop();
    if (key && param.Value) {
      process.env[key] = param.Value;
      console.log(`🔐 Loaded ${key} from SSM`);
    }
  }
}

async function main() {
  await loadEnvFromSSM();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase environment variables");
    throw new Error("Supabase credentials are missing");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("✅ Supabase client initialized!");

  const app = express();

  app.use(express.json());
  app.use("/api", ensureToken, transactionsRouter);
  console.log("✅ Transactions Router registrato su /api");

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`✅ Server in esecuzione su http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Errore durante l'avvio dell'app:", err);
});
