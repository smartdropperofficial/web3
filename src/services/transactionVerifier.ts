import { Contract, formatUnits, isAddress, parseUnits } from "ethers";
import {
  analyzeLogs,
  logTransactionError,
  prepareTransactionContext,
  updateTableStatus,
  validateTimestamp,
  waitForConfirmation,
} from "./transactions";
import { supabase } from "../config/supabase";
import { initializeTaxWallet } from "../utils/web3";
import subscriptionManagementABI from "../abi/subscriptionManagementABI.json";
import { CreateSubcriptionOnChainParams } from "../types/types";

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
  if (pendingTransactions[txHash]) {
    console.log(`⚠️ [SKIP] Already monitoring TX: ${txHash}`);
    return;
  }

  pendingTransactions[txHash] = true;

  try {
    // Step 1: Context
    const context = await prepareTransactionContext(
      txHash,
      expectedAmount,
      destinationField,
      createdAt,
      table,
      statusColumn,
      newStatus,
      identifierColumn
    );

    // Step 2: Wait for TX confirmation
    const receipt = await waitForConfirmation(context.txHash);

    // Step 3: Validate timestamp
    await validateTimestamp(receipt, context.orderCreatedAtMs);

    // Step 4: Analyze logs
    const isValid = await analyzeLogs([...receipt.logs], context);
    if (!isValid) {
      await logTransactionError(context.txHash, context.errorDetails);
      throw new Error(context.errorDetails || "Invalid transaction log.");
    }

    // Step 5: Update DB
    await updateTableStatus(
      context.txHash,
      context.table,
      context.statusColumn,
      context.newStatus,
      context.identifierColumn
    );

    console.log(`✅ [SUCCESS] TX ${context.txHash} verified and updated.`);
  } catch (error: any) {
    console.error(`❌ [ERROR] monitorTransaction:`, error.message);
    await logTransactionError(txHash, error.message);
    throw error;
  } finally {
    delete pendingTransactions[txHash];
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
