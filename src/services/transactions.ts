import { supabase } from "../config/supabase";

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
