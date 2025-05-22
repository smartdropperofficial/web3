import { supabase } from "../../../config/supabase";
import { OrderStatus } from "../../../types/types";

const EXOLIX_API_URL = "https://exolix.com/api/v2/transactions";
const POLL_INTERVAL = 8000;
const MAX_ATTEMPTS = 30;

type UiStatus = "waiting" | "confirming" | "finished" | "failed" | "invalid";

function mapExolixStatus(status: string): UiStatus {
  switch (status) {
    case "wait":
      return "waiting";
    case "confirmation":
    case "confirmed":
    case "exchanging":
    case "sending":
      return "confirming";
    case "success":
      return "finished";
    case "overdue":
    case "refunded":
      return "failed";
    default:
      return "invalid";
  }
}

function isFinalStatus(status: UiStatus): boolean {
  return ["finished", "failed", "invalid"].includes(status);
}

function logStatusInfo(id: string, original: string, mapped: UiStatus) {
  const emojiMap: Record<UiStatus, string> = {
    waiting: "⏳",
    confirming: "🔁",
    finished: "✅",
    failed: "❌",
    invalid: "⚠️",
  };
  console.log(
    `[Exolix] ${
      emojiMap[mapped]
    } Transaction ${id} → status: ${mapped.toUpperCase()} (raw: "${original}")`
  );
}

export async function pollTransactionUntilFinal(txId: string, orderId: string) {
  // 🔍 Recupera stato attuale dell’ordine
  const { data: orderData, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("order_id", orderId)
    .single();

  if (fetchError || !orderData) {
    console.error(`❌ Cannot fetch order ${orderId}:`, fetchError);
    return;
  }

  const currentStatus = orderData.status;

  // 🔁 Polling
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${EXOLIX_API_URL}/${txId}`);
    if (!res.ok) {
      console.error(`Fetch failed [${txId}]: ${res.statusText}`);
      return;
    }

    const data = await res.json();
    const mapped = mapExolixStatus(data.status);
    logStatusInfo(txId, data.status, mapped);

    if (isFinalStatus(mapped)) {
      console.log(
        `🎯 Transaction ${txId} resolved with status ${mapped} (order: ${orderId})`
      );

      let newStatus: OrderStatus | null = null;

      if (mapped === "finished") {
        // ⚙️ Mappatura logica dinamica
        if (currentStatus === OrderStatus.AWAITING_PAYMENT) {
          newStatus = OrderStatus.ORDER_CONFIRMED;
        } else if (currentStatus === OrderStatus.PREORDER_PAYMENT_CONFIRMING) {
          newStatus = OrderStatus.AWAITING_TAX;
        }

        if (newStatus) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              status: newStatus,
              payin_hash: data.hashIn?.hash || null,
              payout_hash: data.hashOut?.hash || null,
              updated_at: new Date().toISOString(),
            })
            .eq("order_id", orderId);

          if (updateError) {
            console.error(
              `❌ Failed to update order ${orderId} to ${newStatus}:`,
              updateError
            );
          } else {
            console.log(`✅ Order ${orderId} updated to ${newStatus}`);
          }
        } else {
          console.warn(
            `⚠️ Order ${orderId} has unexpected status ${currentStatus}, no update performed.`
          );
        }
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  console.warn(
    `⚠️ Timeout: Transaction ${txId} (order ${orderId}) did not resolve in time`
  );
}
