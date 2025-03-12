import { provider } from "../config/provider";
import { Contract, formatUnits } from "ethers";
import { logTransactionError, updateTableStatus } from "./transactions";
import { supabase } from "../config/supabase";

const MAX_WAIT_TIME = 120000; // 2-minute timeout
const TOLERANCE = 0.01; // 1% tolerance on amount
const TIME_DIFF_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const pendingTransactions: Record<string, boolean> = {};

// ✅ Fetch supported tokens from Supabase
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

// ✅ Monitor transaction confirmation and update the appropriate table
export async function monitorTransaction(
  txHash: string,
  expectedAmount: number,
  destinationAddress: string,
  createdAt: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
) {
  console.log(`🔍 Starting transaction monitoring: ${txHash}`);

  const SUPPORTED_TOKENS = await getSupportedTokens();
  console.log(`🔹 Loaded supported tokens:`, SUPPORTED_TOKENS);

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

          if (
            SUPPORTED_TOKENS[tokenAddress] &&
            to.toLowerCase() === destinationAddress.toLowerCase()
          ) {
            const difference = Math.abs(expectedAmount - actualAmount);
            if (difference <= TOLERANCE) {
              console.log("✅ Amount is valid within tolerance!");
              isValid = true;
              break;
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
