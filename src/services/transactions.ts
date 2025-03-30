import { supabase } from "../config/supabase";
import { provider } from "../config/provider";
import { getConfigField, getSupportedTokens } from "../utils/supabaseServices";
import { Contract, formatUnits } from "ethers";
const MAX_WAIT_TIME = 120000;
const TOLERANCE = 0.01;
const TIME_DIFF_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
// ✅ Log transaction errors in Supabase
export async function logTransactionError(txHash: string, result: string) {
  console.log(`📝 Logging transaction ${txHash} error in Supabase...`);

  const { error } = await supabase
    .from("transactions")
    .insert([{ tx_hash: txHash, result }]);

  if (error) {
    console.error(`❌ Error logging transaction ${txHash}:`, error);
  } else {
    console.log(`✅ Transaction ${txHash} error logged successfully.`);
  }
}

// ✅ Update table status (Generic function for different tables)
export async function updateTableStatus(
  txHash: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
) {
  console.log(
    `🔄 Attempting to update ${table}.${statusColumn} for ${txHash}...`
  );

  const { error } = await supabase
    .from(table)
    .update({ [statusColumn]: newStatus })
    .eq(identifierColumn, txHash);

  if (error) {
    console.error(
      `❌ Error updating ${table}.${statusColumn} for ${txHash}:`,
      error
    );
  } else {
    console.log(
      `✅ ${table}.${statusColumn} updated to "${newStatus}" in ${table}.`
    );
  }
}
export async function prepareTransactionContext(
  txHash: string,
  expectedAmount: number,
  destinationField: string,
  createdAt: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
) {
  const SUPPORTED_TOKENS = await getSupportedTokens();
  const destinationAddress = await getConfigField(destinationField);
  const orderCreatedAtMs = new Date(createdAt).getTime();

  if (isNaN(orderCreatedAtMs)) {
    throw new Error("Invalid order creation timestamp.");
  }

  return {
    txHash,
    expectedAmount,
    destinationAddress,
    SUPPORTED_TOKENS,
    orderCreatedAtMs,
    table,
    statusColumn,
    newStatus,
    identifierColumn,
    errorDetails: "",
  };
}
export async function waitForConfirmation(txHash: string) {
  console.log(`⏳ Waiting for TX ${txHash} confirmation...`);
  const receipt = await provider.waitForTransaction(txHash, 1, MAX_WAIT_TIME);

  if (!receipt || !receipt.blockNumber) {
    throw new Error(`Transaction ${txHash} not confirmed`);
  }

  return receipt;
}
export async function validateTimestamp(
  receipt: any,
  orderCreatedAtMs: number
) {
  const block = await provider.getBlock(receipt.blockNumber);
  if (!block || !block.timestamp) {
    throw new Error("Unable to get block timestamp.");
  }

  const txTimestampMs = block.timestamp * 1000;
  const diff = Math.abs(txTimestampMs - orderCreatedAtMs);

  if (diff > TIME_DIFF_THRESHOLD) {
    throw new Error(
      "Transaction on blockchain is too old compared to order timestamp on DB."
    );
  }
}
export async function analyzeLogs(logs: any[], context: any): Promise<boolean> {
  for (const log of logs) {
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

      if (!context.SUPPORTED_TOKENS[tokenAddress]) {
        context.errorDetails = `Unsupported token: ${tokenAddress}`;
        continue;
      }

      if (to.toLowerCase() !== context.destinationAddress.toLowerCase()) {
        context.errorDetails = `Wrong recipient: expected ${context.destinationAddress}, got ${to}`;
        continue;
      }

      const diff = context.expectedAmount - actualAmount;
      if (actualAmount < context.expectedAmount - TOLERANCE) {
        context.errorDetails = `Insufficient amount: expected ${context.expectedAmount}, got ${actualAmount}`;
        return false;
      }

      return true;
    } catch (err) {
      console.error("⚠️ Error parsing log:", err);
      continue;
    }
  }

  return false;
}
