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
  destinationField: string, // e.g., "tax_wallet"
  createdAt: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
): Promise<void> {
  console.log(`🔍 Starting transaction monitoring: ${txHash}`);

  // Fetch supported tokens from Supabase
  const SUPPORTED_TOKENS = await getSupportedTokens(); // if you already have this function in your project
  console.log(`🔹 Loaded supported tokens:`, SUPPORTED_TOKENS);

  // Retrieve destination address from config
  let destinationAddress: string;
  try {
    destinationAddress = await getConfigField(destinationField);
    console.log(
      `🔹 Retrieved destination address from config (${destinationField}): ${destinationAddress}`
    );
  } catch (err) {
    console.error("❌ Error retrieving destination address:", err);
    await logTransactionError(
      txHash,
      "Error retrieving destination address from config."
    );
    throw err;
  }

  const timeout = setTimeout(() => {
    console.log(`⏳ Timeout reached for transaction ${txHash}.`);
    delete pendingTransactions[txHash];
  }, MAX_WAIT_TIME);

  provider.once("block", async (blockNumber) => {
    try {
      console.log(
        `📡 New block mined: ${blockNumber}, checking transaction ${txHash}`
      );
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt || !receipt.blockNumber) {
        console.log(`❌ Transaction ${txHash} not confirmed.`);
        await logTransactionError(txHash, "Transaction not confirmed.");
        clearTimeout(timeout);
        return;
      }

      clearTimeout(timeout);
      console.log(
        `✅ Transaction ${txHash} confirmed in block ${receipt.blockNumber}`
      );

      const block = await provider.getBlock(receipt.blockNumber);
      if (!block || !block.timestamp) {
        console.error(
          `❌ Error retrieving timestamp for block ${receipt.blockNumber}`
        );
        await logTransactionError(txHash, "Error retrieving block timestamp.");
        return;
      }

      const transactionTimestamp = block.timestamp * 1000;
      const orderCreatedAt = new Date(createdAt).getTime();
      const timeDifference = Math.abs(transactionTimestamp - orderCreatedAt);

      console.log(
        `⏳ Time difference between order and transaction: ${
          timeDifference / 1000
        } seconds`
      );

      if (timeDifference > TIME_DIFF_THRESHOLD) {
        console.log(
          `❌ Transaction ${txHash} is too old compared to the order timestamp.`
        );
        await logTransactionError(txHash, "Transaction too old.");
        return;
      }

      let isValid = false;

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

          console.log(
            `🔗 Token: ${tokenAddress}, Actual Amount: ${actualAmount}`
          );
          console.log(
            `📥 Transaction destination: ${to.toLowerCase()}, Expected destination: ${destinationAddress.toLowerCase()}`
          );

          if (
            SUPPORTED_TOKENS[tokenAddress] &&
            to.toLowerCase() === destinationAddress.toLowerCase()
          ) {
            const diff = Math.abs(expectedAmount - actualAmount);
            if (diff <= TOLERANCE) {
              console.log("✅ Amount is valid within tolerance!");
              isValid = true;
              break;
            } else {
              console.log(
                "⚠️ Amount mismatch! Expected:",
                expectedAmount,
                "Actual:",
                actualAmount,
                "Difference:",
                diff
              );
            }
          }
        } catch (err) {
          console.log("❌ Error analyzing a transaction log:", err);
          continue;
        }
      }

      if (isValid) {
        pendingTransactions[txHash] = true;
        await updateTableStatus(
          txHash,
          table,
          statusColumn,
          newStatus,
          identifierColumn
        );
      } else {
        await logTransactionError(txHash, "Incorrect amount or recipient.");
      }
    } catch (error) {
      console.log(`❌ Error checking transaction ${txHash}:`, error);
      await logTransactionError(txHash, "Error checking transaction.");
    }
  });
}

export const createOrderOnBlockchain = async ({
  subscription_id,
  subscription_plan_id,
  destinationAddress,
  payment_tx,
  promoter_address,
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
    if (!isAddress(destinationAddress)) {
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
      destinationAddress,
      payment_tx,
      promoter_address,
      startDate
    );

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
      console.log("🚀 Transazione inviata! Hash:", tx.hash);
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
