import {
  analyzeLogs,
  logTransactionError,
  prepareTransactionContext,
  updateTableStatus,
  validateTimestamp,
  waitForConfirmation,
} from "./monitoring/blockchain/transactions";

const pendingTransactions: Record<string, boolean> = {};

export async function monitorTransaction(
  txHash: string,
  expectedAmount: number,
  destinationField: string,
  createdAt: string,
  table: string,
  statusColumn: string,
  newStatus: string,
  identifierColumn: string
): Promise<any> {
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
    // await updateTableStatus(
    //   context.txHash,
    //   context.table,
    //   context.statusColumn,
    //   context.newStatus,
    //   context.identifierColumn
    // );

    // Return useful values in the response
    console.log(`✅ [SUCCESS] TX ${context.txHash} verified and updated.`);

    return {
      txHash: context.txHash,
      table: context.table,
      statusColumn: context.statusColumn,
      newStatus: context.newStatus,
      identifierColumn: context.identifierColumn,
      receipt,
    };
  } catch (error: any) {
    console.error(`❌ [ERROR] monitorTransaction:`, error.message);
    await logTransactionError(txHash, error.message);
    throw error;
  } finally {
    delete pendingTransactions[txHash];
  }
}
