import { Router, Request, Response } from "express";
import { provider } from "../config/provider";
import { Contract, formatUnits } from "ethers";
import { SubscriptionStatus } from "../types";
import { supabase } from "../config/supabase";

const router = Router();
const MAX_WAIT_TIME = 120000; // Timeout di 2 minuti
const TOLERANCE = 0.01; // 1% di tolleranza sull'importo
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

// ✅ Aggiorna lo stato della subscription in Supabase
async function updateSubscriptionStatus(txHash: string) {
  console.log(`🔄 Aggiornamento dello stato per ${txHash} in Supabase...`);

  const { data, error } = await supabase
    .from("subscription")
    .select(" status")
    .eq("payment_tx", txHash)
    .single();

  if (error) {
    console.error(
      `❌ Errore nel recupero della subscription per ${txHash}:`,
      error
    );
    return;
  }

  if (data && data.status === "CONFIRMING") {
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
  } else {
    console.log(
      `⚠️ La subscription per ${txHash} è già abilitata o non esiste.`
    );
  }
}

// ✅ Monitoraggio della conferma della transazione e verifica dell'importo
async function monitorTransaction(
  txHash: string,
  expectedAmount: number,
  destinationAddress: string
) {
  console.log(`🔍 Inizio monitoraggio transazione: ${txHash}`);

  const SUPPORTED_TOKENS = await getSupportedTokens();
  const timeout = setTimeout(() => {
    console.log(`⏳ Timeout raggiunto per la transazione ${txHash}.`);
    delete pendingTransactions[txHash]; // Rimuove la transazione dalla cache
  }, MAX_WAIT_TIME);

  provider.once("block", async () => {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt && receipt.blockNumber) {
        clearTimeout(timeout);
        console.log(
          `✅ Transazione ${txHash} confermata nel blocco ${receipt.blockNumber}`
        );

        let isValid = false;
        let actualAmount = "0";
        let tokenAddress = "";

        for (const log of receipt.logs) {
          try {
            console.log(
              "📝 Analizzando log della transazione:",
              JSON.stringify(log, null, 2)
            );

            const parsedLog = new Contract(
              log.address,
              ERC20_ABI,
              provider
            ).interface.parseLog(log);
            if (!parsedLog || parsedLog.name !== "Transfer") {
              console.log("⚠️ Il log non è un evento Transfer, ignorato.");
              continue;
            }

            const { from, to, value } = parsedLog.args;
            tokenAddress = log.address.toLowerCase();
            actualAmount = formatUnits(value, 6);

            console.log("🔗 Token coinvolto:", tokenAddress);
            console.log("📨 Mittente:", from);
            console.log("📥 Destinatario:", to);
            console.log("💰 Importo trasferito:", actualAmount);

            if (
              SUPPORTED_TOKENS[tokenAddress] &&
              to.toLowerCase() === destinationAddress.toLowerCase()
            ) {
              const receivedAmount = parseFloat(actualAmount);
              const difference = Math.abs(expectedAmount - receivedAmount);

              if (difference <= TOLERANCE) {
                console.log(
                  "✅ L'importo della transazione è valido con tolleranza!"
                );
                isValid = true;
                break;
              } else {
                console.log(
                  "⚠️ Importo non valido! Atteso:",
                  expectedAmount,
                  "Ricevuto:",
                  receivedAmount,
                  "Differenza:",
                  difference
                );
              }
            } else {
              console.log(
                "⚠️ Token non supportato o destinatario errato:",
                tokenAddress
              );
            }
          } catch (err) {
            console.log("❌ Errore nell'analisi di un log:", err);
            continue;
          }
        }

        if (isValid) {
          pendingTransactions[txHash] = true;
          await updateSubscriptionStatus(txHash);
        }
      }
    } catch (error) {
      console.log(
        `❌ Errore nel controllo della transazione ${txHash}:`,
        error
      );
    }
  });
}

// ✅ API per avviare la verifica di una transazione
router.post(
  "/verify-subscription-payment",

  async (req: Request, res: Response) => {
    try {
      const { payment_tx, amount_paid } = req.body;
      console.log("🚀 ~ req.body;:", req.body);

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
      if (!payment_tx || !amount_paid || !destinationAddress) {
        return res.status(400).json({ error: "Parametri mancanti" });
      }

      console.log(
        `📥 Ricevuta richiesta per monitorare: ${payment_tx}, Importo atteso: ${amount_paid}`
      );

      if (pendingTransactions[payment_tx] === true) {
        return res.json({
          success: true,
          message: "Transazione già confermata e aggiornata in Supabase!",
        });
      }

      if (!pendingTransactions[payment_tx]) {
        pendingTransactions[payment_tx] = false;
        monitorTransaction(
          payment_tx,
          parseFloat(amount_paid),
          destinationAddress
        );
      }

      return res.status(202).json({
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
