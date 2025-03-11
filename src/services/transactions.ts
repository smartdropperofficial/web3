import { supabase } from "../config/supabase";
import { Transaction } from "../types";
import { log } from "../utils/logger";

// Salva una transazione in Supabase
export const saveTransaction = async (tx: Transaction) => {
  // Check if the transaction already exists
  const { data: existingTransaction, error: fetchError } = await supabase
    .from("transactions")
    .select("tx_hash")
    .eq("tx_hash", tx.tx_hash)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // Ignore "No rows found" error
    log.error(
      `Errore nel controllo esistenza transazione: ${fetchError.message}`
    );
    return;
  }

  // If the transaction already exists, skip inserting it
  if (existingTransaction) {
    log.info(`⚠️ Transazione già presente in Supabase: ${tx.tx_hash}`);
    return;
  }

  // Insert only if it's not a duplicate
  const { error } = await supabase.from("transactions").insert([tx]);

  if (error) {
    log.error(`❌ Errore nel salvataggio su Supabase: ${error.message}`);
  } else {
    log.success(`✅ Transazione salvata su Supabase: ${tx.tx_hash}`);
  }
};

// Recupera una transazione da Supabase
export const getTransaction = async (txHash: string) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("tx_hash", txHash)
    .single();
  return { data, error };
};

// Pulisce le transazioni più vecchie di 10 minuti
export const cleanOldTransactions = async () => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .lt("timestamp", tenMinutesAgo);

  if (!error) {
    log.info("Transazioni vecchie eliminate da Supabase!");
  }
};
