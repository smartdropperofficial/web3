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
  console.log(`🔍 Avvio monitoraggio transazione: ${txHash}`);

  return new Promise<void>(async (resolve, reject) => {
    try {
      const SUPPORTED_TOKENS = await getSupportedTokens();
      const destinationAddress = await getConfigField(destinationField);

      console.log(
        `🔹 Indirizzo di destinazione da config: ${destinationAddress}`
      );

      const timeout = setTimeout(() => {
        console.log(`⏳ Timeout raggiunto per la transazione ${txHash}.`);
        delete pendingTransactions[txHash];
        reject(new Error(`Timeout per la transazione ${txHash}`));
      }, MAX_WAIT_TIME);

      provider.once("block", async () => {
        try {
          const receipt = await provider.getTransactionReceipt(txHash);

          if (!receipt || !receipt.blockNumber) {
            await logTransactionError(txHash, "Transazione non confermata.");
            clearTimeout(timeout);
            return reject(new Error(`Transazione ${txHash} non confermata.`));
          }

          clearTimeout(timeout);
          console.log(`✅ Transazione ${txHash} confermata`);

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

              if (
                SUPPORTED_TOKENS[tokenAddress] &&
                to.toLowerCase() === destinationAddress.toLowerCase()
              ) {
                const difference = Math.abs(expectedAmount - actualAmount);
                if (difference <= TOLERANCE) {
                  isValid = true;
                  break;
                }
              }
            } catch (err) {
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
            resolve();
          } else {
            await logTransactionError(txHash, "Importo o destinatario errato.");
            reject(new Error("Importo o destinatario errato."));
          }
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
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
