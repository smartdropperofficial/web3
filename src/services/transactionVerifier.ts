import { provider } from "../config/provider";
import { Contract, formatUnits, isAddress, parseUnits } from "ethers";
import { logTransactionError, updateTableStatus } from "./transactions";
import { supabase } from "../config/supabase";
import { initializeTaxWallet } from "../utils/web3";
import subscriptionManagementABI from "../abi/subscriptionManagementABI.json";
import { CreateSubcriptionOnChainParams } from "../types/types";
import { getConfigField, getSupportedTokens } from "../utils/supabaseServices";

const MAX_WAIT_TIME = 120000;
const TOLERANCE = 0.01;
const TIME_DIFF_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const pendingTransactions: Record<string, boolean> = {};

// Esempio di funzione asincrona (Supabase) per i token supportati

export async function monitorTransaction(
  txHash: string,
  expectedAmount: number,
  destinationField: string,
  createdAt: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
): Promise<void> {
  console.log(`🔍 [MONITOR TRANSACTION] Starting for TX: ${txHash}`);
  console.log(`🔹 Expected amount: ${expectedAmount}`);
  console.log(`🔹 Destination config field: ${destinationField}`);

  if (pendingTransactions[txHash]) {
    console.log(`⚠️ [SKIP] Transaction ${txHash} is already being verified.`);
    return;
  }

  pendingTransactions[txHash] = true;

  try {
    const SUPPORTED_TOKENS = await getSupportedTokens();
    const destinationAddress = await getConfigField(destinationField);

    console.log(`🔹 Supported tokens: ${JSON.stringify(SUPPORTED_TOKENS)}`);
    console.log(`🔹 Destination address: ${destinationAddress}`);

    const orderCreatedAtMs = new Date(createdAt).getTime();
    if (isNaN(orderCreatedAtMs)) {
      throw new Error("Invalid order creation timestamp.");
    }

    console.log(`🕒 Order created (ms): ${orderCreatedAtMs}`);

    console.log(`⏳ Waiting for transaction ${txHash} confirmation...`);
    const receipt = await provider.waitForTransaction(txHash, 1, MAX_WAIT_TIME);

    if (!receipt || !receipt.blockNumber) {
      throw new Error(`Transaction ${txHash} not confirmed.`);
    }

    console.log(`✅ [CONFIRMED] Block #${receipt.blockNumber}`);

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || !block.timestamp) {
      throw new Error("Could not retrieve block timestamp.");
    }

    const txTimestampMs = block.timestamp * 1000;
    const diff = Math.abs(txTimestampMs - orderCreatedAtMs);

    console.log(`📅 TX timestamp (ms): ${txTimestampMs}`);
    console.log(
      `⏳ Difference: ${diff / 1000}s (Max allowed: ${
        TIME_DIFF_THRESHOLD / 1000
      }s)`
    );

    if (diff > TIME_DIFF_THRESHOLD) {
      throw new Error(`Transaction is too old compared to order timestamp`);
    }

    let isValid = false;
    let errorDetails = "";

    for (const log of receipt.logs) {
      try {
        const parsedLog = new Contract(
          log.address,
          ERC20_ABI,
          provider
        ).interface.parseLog(log);
        if (!parsedLog || parsedLog.name !== "Transfer") continue;

        const { to, value } = parsedLog.args;
        const tokenAddress = log.address.toLowerCase();
        const actualAmount = parseFloat(formatUnits(value, 6));

        console.log(`🔗 Token: ${tokenAddress}`);
        console.log(
          `📥 To: ${to.toLowerCase()} | Expected: ${destinationAddress.toLowerCase()}`
        );
        console.log(`💸 Amount: ${actualAmount} | Expected: ${expectedAmount}`);

        if (!SUPPORTED_TOKENS[tokenAddress]) {
          errorDetails = `Unsupported token: ${tokenAddress}`;
          continue;
        }

        if (to.toLowerCase() !== destinationAddress.toLowerCase()) {
          errorDetails = `Wrong recipient: expected ${destinationAddress}, got ${to}`;
          continue;
        }

        const diff = expectedAmount - actualAmount;
        if (actualAmount < expectedAmount - TOLERANCE) {
          errorDetails = `Insufficient amount: expected ${expectedAmount}, got ${actualAmount}`;
          await logTransactionError(txHash, errorDetails);
          throw new Error(errorDetails);
        }

        isValid = true;
        break;
      } catch (err) {
        console.error("⚠️ Error parsing log:", err);
        continue;
      }
    }

    if (isValid) {
      console.log(`✅ [SUCCESS] Transaction ${txHash} verified!`);
      await updateTableStatus(
        txHash,
        table,
        statusColumn,
        newStatus,
        identifierColumn
      );
    } else {
      if (!errorDetails) errorDetails = "No valid Transfer logs found.";
      await logTransactionError(txHash, errorDetails);
      throw new Error(errorDetails);
    }
  } catch (error: any) {
    console.error(`❌ [ERROR] monitorTransaction: ${error.message}`);
    await logTransactionError(txHash, error.message);
    throw error;
  } finally {
    delete pendingTransactions[txHash]; // Cleanup in ogni caso
  }
}

export const createSubscriptionOnBlockchain = async ({
  subscription_id,
  subscription_plan_id,
  wallet,
  payment_tx,
  promoter,
  created_at,
}: CreateSubcriptionOnChainParams): Promise<any> => {
  try {
    const { data: config, error: existingError } = await supabase
      .from("config")
      .select("subscription_management_contract")
      .maybeSingle();

    if (existingError) {
      console.error(
        "createOrderOnBlockchain - Error checking existing subscription on Supabase:",
        existingError
      );
      return "";
    }

    const getCurrentTimestamp = (): number => {
      return Math.floor(new Date(created_at!).getTime() / 1000); // Convert to seconds
    };

    // Step 3: Creazione della sottoscrizione sulla blockchain
    const ownerWallet = initializeTaxWallet();
    const ownerContract = new Contract(
      config?.subscription_management_contract!,
      subscriptionManagementABI,
      ownerWallet
    );

    // // Verifica che tutti gli argomenti siano definiti
    if (!subscription_id) {
      throw new Error("createOrderOnBlockchain- Invalid subscription ID");
    }
    if (subscription_plan_id < 0) {
      throw new Error("createOrderOnBlockchain - Invalid subscription type ID");
    }
    if (!isAddress(wallet)) {
      throw new Error("createOrderOnBlockchain - Invalid subscriber address");
    }
    if (!payment_tx) {
      throw new Error("createOrderOnBlockchain - Invalid payment transaction");
    }

    // Chiamata alla nuova funzione per stimare e creare la transazione
    console.log(
      "🚀 createOrderOnBlockchain -  ~ supabaseSubscription.subscription_id,:",
      subscription_id
    );

    const startDate = getCurrentTimestamp();

    const txHash = await estimateAndCreateSubscriptionTransaction(
      ownerContract,
      subscription_id,
      subscription_plan_id,
      wallet,
      payment_tx,
      promoter,
      startDate
    );
    const { data: sub, error: errorSub } = await supabase
      .from("subscription")
      .update({ subscription_tx: txHash })
      .eq("subscription_id", subscription_id);

    if (errorSub) {
      console.error(
        "createOrderOnBlockchain - Error updating subscription transaction on Supabase:",
        errorSub
      );
      return "";
    }
    return { tx: txHash };
  } catch (error: any) {
    console.error(
      "createOrderOnBlockchain -  Error in createSubscription:",
      error
    );
    throw { message: error.reason };
  }
};
async function estimateAndCreateSubscriptionTransaction(
  ownerContract: Contract,
  subscriptionId: string,
  subscriptionTypeId: number,
  subscriber: string,
  paymentTx: string,
  promoterAddress = "0x0000000000000000000000000000000000000000",
  startDate: number
): Promise<string> {
  console.log("🚀 estimateAndCreateSubscriptionTransaction START");
  console.log("🔹 startDate:", startDate);
  console.log("🔹 paymentTx:", paymentTx);
  console.log("🔹 subscriber:", subscriber);
  console.log("🔹 subscriptionId:", subscriptionId);
  console.log("🔹 promoterAddress:", promoterAddress);

  // ✅ Verifica se promoterAddress è un indirizzo valido
  if (!isAddress(promoterAddress)) {
    console.warn("⚠️ promoterAddress non valido, impostato su default.");
    promoterAddress = "0x0000000000000000000000000000000000000000";
  }

  try {
    // ✅ Ottenere il provider dal contract runner
    const provider = ownerContract.runner?.provider;
    if (!provider) {
      throw new Error("No provider found on the contract signer.");
    }

    // ✅ Ottenere il gas price direttamente dal provider (Ethers v6 usa getFeeData)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? parseUnits("30", "gwei"); // Default 30 Gwei se nullo
    console.log("🚀 ~ gasPrice:", formatUnits(gasPrice, "gwei"), "Gwei");

    // ✅ Stima del gas limit
    let gasLimitEstimate;
    try {
      gasLimitEstimate = await ownerContract.subscribe.estimateGas(
        subscriptionId,
        subscriptionTypeId,
        subscriber,
        paymentTx,
        promoterAddress,
        startDate
      );
      console.log("✅ ~ gasLimit stimato:", gasLimitEstimate.toString());
    } catch (error) {
      console.error("❌ Errore nella stima del gas:", error);
      throw new Error("Gas estimation failed. Check parameters.");
    }

    // ✅ Applichiamo un buffer di sicurezza del 10% e un minimo garantito
    const bufferMultiplier = 11n; // 10% extra gas buffer
    const divisor = 10n;

    const finalGasLimit = (gasLimitEstimate * bufferMultiplier) / divisor;
    console.log("✅ ~ finalGasLimit:", finalGasLimit.toString());

    // ✅ Creazione e invio della transazione sulla blockchain
    let tx;
    try {
      tx = await ownerContract.subscribe(
        subscriptionId,
        subscriptionTypeId,
        subscriber,
        paymentTx,
        promoterAddress,
        startDate,
        {
          gasPrice,
          gasLimit: finalGasLimit,
        }
      );
      console.log("🚀 Subscription created on chain! Hash:", tx.hash);
    } catch (error: any) {
      console.error("❌ Errore nell'invio della transazione:", error);

      // Migliore gestione dell'errore per transazioni fallite
      if (error?.message?.includes("insufficient funds")) {
        throw new Error("Transaction failed: Insufficient funds for gas.");
      } else if (
        error?.message?.includes("replacement transaction underpriced")
      ) {
        throw new Error("Transaction failed: Gas price too low.");
      } else {
        throw new Error(
          "Transaction failed. Possible gas issue or nonce error."
        );
      }
    }

    return tx.hash;
  } catch (error) {
    console.error(
      "❌ Errore generale in estimateAndCreateSubscriptionTransaction:",
      error
    );
    throw error;
  }
}
