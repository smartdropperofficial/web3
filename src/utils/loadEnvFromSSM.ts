// src/utils/loadEnvFromSSM.ts
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import dotenv from "dotenv";
import path from "path";

// Load .env solo se non siamo su AWS o AWS Vault
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ssm = new SSMClient({ region: "us-east-1" });

const getSSMParam = async (name: string, withDecryption = true) => {
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: withDecryption,
  });

  const result = await ssm.send(command);
  return result.Parameter?.Value || "";
};

export const loadEnvFromSSM = async () => {
  console.log("📡 Caricamento variabili da AWS SSM...");

  try {
    process.env.SUPABASE_URL ||= await getSSMParam(
      "/smartdropper/dev/smartdropper-api/SUPABASE_URL",
      false
    );

    process.env.SUPABASE_KEY ||= await getSSMParam(
      "/smartdropper/dev/smartdropper-api/SUPABASE_KEY"
    );

    process.env.PRIVATE_KEY ||= await getSSMParam(
      "/smartdropper/dev/smartdropper-api/PRIVATE_KEY"
    );

    process.env.POLYGON_RPC_URL ||= await getSSMParam(
      "/smartdropper/dev/smartdropper-api/POLYGON_RPC_URL"
    );

    console.log("✅ Variabili da SSM caricate correttamente!");
  } catch (err) {
    console.warn("⚠️ Impossibile caricare variabili da SSM, uso fallback .env");
    console.warn(err);
  }
};
