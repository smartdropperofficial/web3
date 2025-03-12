import { Router, Request, Response } from "express";
import { provider } from "../config/provider";
import { Contract, formatUnits } from "ethers";
import { SubscriptionStatus } from "../types";
import { supabase } from "../config/supabase";

const router = Router();
const MAX_WAIT_TIME = 120000; // Timeout di 2 minuti
const TOLERANCE = 0.01; // 1% di tolleranza sull'importo
const TIME_DIFF_THRESHOLD = 5 * 60 * 1000; // 5 minuti in millisecondi
const pendingTransactions: Record<string, boolean> = {}; // Stato delle transazioni

// ✅ ABI di base per gli eventi Transfer nei contratti ERC20
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// ✅ Recupera i token supportati da Supabase
async function getSupportedTokens(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("config")
    .select("supported_tokens")
    .single();
  if (error) {
    console.error("❌ Errore nel recupero dei token supportati:", error);
    return {};
  }
  return data?.supported_tokens || {};
}

// ✅ Registra l'errore della transazione in Supabase solo se fallisce
async function logTransactionError(txHash: string, result: string) {
  console.log(
    `📝 Registrazione dell'errore della transazione ${txHash} su Supabase...`
  );

  const { error } = await supabase
    .from("transactions")
    .insert([{ tx_hash: txHash, result }]);

  if (error) {
    console.error(
      `❌ Errore nella registrazione della transazione ${txHash}:`,
      error
    );
  } else {
    console.log(
      `✅ Errore della transazione ${txHash} registrato con successo.`
    );
  }
}

// ✅ Aggiorna lo stato della subscription in Supabase solo se è CONFIRMING
async function updateSubscriptionStatus(txHash: string) {
  console.log(
    `🔄 Tentativo di aggiornare lo stato per ${txHash} in Supabase...`
  );

  const { data, error } = await supabase
    .from("subscription")
    .select("status")
    .eq("payment_tx", txHash)
    .single();

  if (error) {
    console.error(
      `❌ Errore nel recupero della subscription per ${txHash}:`,
      error
    );
    return;
  }

  if (!data) {
    console.log(
      `⚠️ Nessuna subscription trovata per la transazione ${txHash}.`
    );
    return;
  }

  console.log(
    `📄 Stato attuale della subscription per ${txHash}: ${data.status}`
  );

  if (data.status !== SubscriptionStatus.CONFIRMING) {
    console.log(
      `⚠️ La subscription ${txHash} non è in stato CONFIRMING, nessun aggiornamento necessario.`
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("subscription")
    .update({ status: SubscriptionStatus.ENABLED })
    .eq("payment_tx", txHash);

  if (updateError) {
    console.error(
      `❌ Errore nell'aggiornamento dello stato per ${txHash}:`,
      updateError
    );
  } else {
    console.log(
      `✅ Stato della subscription ${txHash} aggiornato a "ENABLED" su Supabase.`
    );
  }
}

// ✅ Monitoraggio della conferma della transazione e verifica dell'importo e della data
async function monitorTransaction(
  txHash: string,
  expectedAmount: number,
  destinationAddress: string,
  createdAt: string
) {
  console.log(`🔍 Inizio monitoraggio transazione: ${txHash}`);

  const SUPPORTED_TOKENS = await getSupportedTokens();
  console.log(`🔹 Token supportati caricati:`, SUPPORTED_TOKENS);

  const timeout = setTimeout(() => {
    console.log(`⏳ Timeout raggiunto per la transazione ${txHash}.`);
    delete pendingTransactions[txHash];
  }, MAX_WAIT_TIME);

  provider.once("block", async (blockNumber) => {
    try {
      console.log(
        `📡 Nuovo blocco minato: ${blockNumber}, controllo transazione ${txHash}`
      );
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt || !receipt.blockNumber) {
        console.log(`❌ Transazione ${txHash} non confermata.`);
        await logTransactionError(txHash, "Transazione non confermata.");
        return;
      }

      clearTimeout(timeout);
      console.log(
        `✅ Transazione ${txHash} confermata nel blocco ${receipt.blockNumber}`
      );

      const block = await provider.getBlock(receipt.blockNumber);
      if (!block || !block.timestamp) {
        console.error(
          `❌ Errore nel recupero del timestamp per il blocco ${receipt.blockNumber}`
        );
        await logTransactionError(txHash, "Errore nel recupero del timestamp.");
        return;
      }

      const transactionTimestamp = block.timestamp * 1000;
      const orderCreatedAt = new Date(createdAt).getTime();
      const timeDifference = Math.abs(transactionTimestamp - orderCreatedAt);

      console.log(
        `⏳ Differenza tra ordine e transazione: ${
          timeDifference / 1000
        } secondi`
      );

      if (timeDifference > TIME_DIFF_THRESHOLD) {
        console.log(
          `❌ La transazione ${txHash} è troppo vecchia rispetto alla data dell'ordine.`
        );
        await logTransactionError(txHash, "Transazione troppo vecchia.");
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
              console.log("✅ Importo valido con tolleranza!");
              isValid = true;
              break;
            }
          }
        } catch (err) {
          console.log("❌ Errore nell'analisi di un log:", err);
          continue;
        }
      }

      if (isValid) {
        pendingTransactions[txHash] = true;
        await updateSubscriptionStatus(txHash);
      } else {
        await logTransactionError(
          txHash,
          "Importo errato o destinatario errato."
        );
      }
    } catch (error) {
      console.log(
        `❌ Errore nel controllo della transazione ${txHash}:`,
        error
      );
      await logTransactionError(
        txHash,
        "Errore nel controllo della transazione."
      );
    }
  });
}

// ✅ API per avviare la verifica di una transazione
router.post(
  "/verify-subscription-payment",
  async (req: Request, res: Response) => {
    try {
      const { payment_tx, amount_paid, created_at } = req.body;
      console.log("🚀 ~ req.body:", req.body);

      const { data: configData, error: configError } = await supabase
        .from("config")
        .select("tax_wallet")
        .single();

      if (configError) {
        console.error(
          "❌ Errore nel recupero della configurazione:",
          configError
        );
        return res
          .status(500)
          .json({ error: "Errore nel recupero della configurazione" });
      }

      const destinationAddress = configData?.tax_wallet;
      if (!payment_tx || !amount_paid || !destinationAddress || !created_at) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }

      console.log(
        `📥 Monitoraggio transazione: ${payment_tx}, Importo: ${amount_paid}, Data ordine: ${created_at}`
      );

      if (pendingTransactions[payment_tx]) {
        return res.json({
          success: true,
          message: "Transazione già confermata e aggiornata in Supabase!",
        });
      }

      pendingTransactions[payment_tx] = false;
      monitorTransaction(
        payment_tx,
        parseFloat(amount_paid),
        destinationAddress,
        created_at
      );

      return res
        .status(202)
        .json({
          success: true,
          message:
            "Monitoraggio avviato. Supabase sarà aggiornato alla conferma.",
        });
    } catch (error) {
      console.error("🔥 Errore durante la verifica della transazione:", error);
      return res
        .status(500)
        .json({ success: false, message: "Errore interno del server" });
    }
  }
);

export default router;
