import { JsonRpcProvider, Wallet } from "ethers";
import { POLYGON_RPC_URL } from "../config/dotenv";

export function initializeTaxWallet(): Wallet {
  const isDevelopment = process.env.NODE_ENV === "development";
  const providerUrl = isDevelopment
    ? "http://127.0.0.1:8545/"
    : POLYGON_RPC_URL;

  if (!providerUrl) {
    throw new Error("❌ POLYGON_RPC_URL non definito!");
  }

  const ownerProvider = new JsonRpcProvider(providerUrl);
  console.log("🚀 ~ initializeTaxWallet ~ NODE_ENV:", process.env.NODE_ENV);

  // Selezione della chiave privata in base all'ambiente
  const privateKey = isDevelopment
    ? process.env.PRIVATE_KEY_DEV
    : process.env.PRIVATE_KEY_TAX;

  if (!privateKey) {
    throw new Error("❌ PRIVATE_KEY non definito!");
  }

  try {
    const ownerWallet = new Wallet(privateKey, ownerProvider);
    console.log("✅ Wallet inizializzato correttamente:", ownerWallet.address);
    return ownerWallet;
  } catch (error) {
    console.error("❌ Errore durante l'inizializzazione del wallet:", error);
    throw error;
  }
}

export function initializePreOrderWallet() {
  const ownerProvider =
    process.env.NODE_ENV === "development"
      ? new JsonRpcProvider("http://127.0.0.1:8545/") // Use JsonRpcProvider for local development
      : new JsonRpcProvider(POLYGON_RPC_URL); // Use InfuraProvider for production

  console.log(
    "🚀 ~ initializeOwnerWallet ~ NODE_ENV:",
    process.env.NODE_ENV === "development"
      ? process.env.PRIVATE_KEY_DEV!
      : process.env.PRIVATE_KEY_PRE_ORDER!
  );

  // const ownerProvider = new ethers.providers.JsonRpcProvider(providerUrl);
  const ownerWallet =
    process.env.NODE_ENV === "development"
      ? new Wallet(process.env.PRIVATE_KEY_DEV!, ownerProvider)
      : new Wallet(process.env.PRIVATE_KEY_PRE_ORDER!, ownerProvider);
  return ownerWallet;
}
export function initializeSubcriptionWallet() {
  const ownerProvider =
    process.env.NODE_ENV === "development"
      ? new JsonRpcProvider("http://127.0.0.1:8545/") // Use JsonRpcProvider for local development
      : new JsonRpcProvider(process.env.POLYGON_RPC_URL); // Use InfuraProvider for production

  const ownerWallet =
    process.env.NODE_ENV === "development"
      ? new Wallet(process.env.PRIVATE_KEY_DEV!, ownerProvider)
      : new Wallet(process.env.PRIVATE_KEY_SUBSCRIPTION!, ownerProvider);
  // console.log("🚀 ~ initializeOwnerWallet ~ ownerWallet:", ownerWallet)
  return ownerWallet;
}
