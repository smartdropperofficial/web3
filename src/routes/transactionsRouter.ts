import { Router } from "express";
import {
  createMultiPreorders,
  createSinglePreorder,
  createSubscriptionOnBlockchain,
} from "../services/updateStatus/index";
import { monitorTransaction } from "../services/transactionVerifier";
import {
  CreateSubcriptionOnChainParams,
  SubscriptionStatus,
} from "../types/types";
import { OrderStatus } from "../types/enums";
import { validatePaymentFields } from "../middleware/validatePaymentFields";
import { supabase } from "../config/supabase";
import { pollTransactionUntilFinal } from "../services/monitoring/thirdPartServices/ExolixStatus";
import { updateTableStatus } from "../services/monitoring/blockchain/transactions";
import { ensureToken } from "../middleware/tokenValidation";

const router = Router();

router.get("/hello", (req, res) => {
  res.status(200).send("Hello");
});
router.get("/health", (_, res) => res.send("OK"));

const pendingTransactions: { [txHash: string]: boolean } = {};

router.post(
  "/verify-subscription-payment",
  ensureToken,
  validatePaymentFields,
  async (req, res) => {
    try {
      console.log(
        "📥 [REQUEST RECEIVED] for endpoint: /verify-subscription-payment"
      );
      console.log("📥 [REQUEST RECEIVED]", {
        body: req.body,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      const { payment_tx, price, created_at } = req.body;

      if (!payment_tx || !price || !created_at) {
        console.error("❌ [ERROR] Missing required fields:", {
          payment_tx,
          price,
          created_at,
        });
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Evita duplicati se una transazione è già in corso
      if (pendingTransactions[payment_tx]) {
        console.log(
          `⚠️ [SKIP] Transaction ${payment_tx} is already being verified.`
        );
        return res.status(200).json({ message: "Already being monitored" });
      }

      pendingTransactions[payment_tx] = true;

      await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "subscription_wallet",
        created_at,
        "subscription",
        "status",
        SubscriptionStatus.ENABLED,
        "payment_tx"
      );

      delete pendingTransactions[payment_tx];
      await updateTableStatus(
        payment_tx,
        "subscription",
        "status",
        SubscriptionStatus.ENABLED,
        "payment_tx"
      );
      return res.status(200).json({
        success: true,
        message: "Transaction monitored successfully!",
      });
    } catch (error: any) {
      console.error("❌ [ERROR]:", error);
      // Cleanup: libera il tx dalla mappa per futuri retry
      if (req.body?.payment_tx) {
        delete pendingTransactions[req.body.payment_tx];
      }
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post(
  "/create-stablecoin-subscription-onchain",
  ensureToken,
  async (req, res) => {
    try {
      const para = req.body as CreateSubcriptionOnChainParams;
      console.log("🚀 ~ router.post ~ para:", para);
      console.log(
        "📥 [REQUEST RECEIVED] for endpoint: /create-subscription-onchain "
      );
      if (para.status !== SubscriptionStatus.ENABLED) {
        return res.status(400).json({
          success: false,
          message: "Subscription is not in confirming state",
        });
      } else {
        await createSubscriptionOnBlockchain(para);
        return res.status(200).json({
          success: true,
          message: "Transaction monitored successfully!",
        });
      }
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post(
  "/verify-single-pre-order-payment-stablecoin",
  ensureToken,
  validatePaymentFields,
  async (req, res) => {
    try {
      console.log(
        "📥 [REQUEST RECEIVED] for endpoint: /verify-single-pre-order-payment-stablecoin"
      );
      console.log("📥 [REQUEST RECEIVED] Full request body:", req.body);

      const { payment_tx, price, created_at, basket_id } = req.body;

      if (!payment_tx || !price || !created_at || !basket_id) {
        console.error("❌ [ERROR] Missing required fields:", {
          payment_tx,
          price,
          created_at,
          basket_id,
        });
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(
        `[INFO] Starting transaction monitoring for payment_tx: ${payment_tx}, price: ${price}, created_at: ${created_at}, basket_id: ${basket_id}`
      );

      await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "pre_order_wallet",
        created_at,
        "orders",
        "status",
        OrderStatus.AWAITING_TAX,
        "pre_order_payment_tx"
      );

      console.log(
        `[INFO] Transaction monitoring completed for payment_tx: ${payment_tx}. Proceeding to create single preorder for basket_id: ${basket_id}`
      );

      await createSinglePreorder(basket_id);

      console.log(
        `[SUCCESS] Single preorder created successfully for basket_id: ${basket_id}`
      );

      return res.status(200).json({
        success: true,
        message:
          "Transaction monitored and single preorder created successfully!",
      });
    } catch (error: any) {
      console.error(
        "❌ [ERROR] Exception occurred during single preorder verification:",
        error
      );
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post(
  "/verify-multi-pre-order-payment-stablecoin",
  ensureToken,
  // validatePaymentFields,
  async (req, res) => {
    const fn = "[verify-multi-pre-order-payment-stablecoin]";
    try {
      console.log(
        `${fn} 📥 [REQUEST RECEIVED] Endpoint: /verify-multi-pre-order-payment-stablecoin`
      );
      console.log(`${fn} 📥 [REQUEST RECEIVED] Full request body:`, req.body);

      const {
        pre_order_payment_tx: payment_tx,
        pre_order_amount: price,
        modified_at: created_at,
        order_id,
        basket_ids,
      } = req.body;
      console.log(`${fn} [INFO] Extracted fields:`, {
        payment_tx,
        price,
        created_at,
        order_id,
        basket_ids,
      });

      if (!payment_tx || !price || !created_at || !order_id || !basket_ids) {
        console.error(`${fn} ❌ [ERROR] Missing required fields:`, {
          payment_tx,
          price,
          created_at,
          order_id,
          basket_ids,
        });
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(
        `${fn} [INFO] Starting transaction monitoring for payment_tx: ${payment_tx}, price: ${price}, created_at: ${created_at}, order_id: ${order_id}, basket_ids: ${JSON.stringify(
          basket_ids
        )}`
      );

      await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "pre_order_wallet",
        created_at,
        "order",
        "status",
        OrderStatus.PREORDER_PAYMENT_CONFIRMED,
        "pre_order_payment_tx"
      );
      await updateTableStatus(
        payment_tx,
        "order",
        "status",
        OrderStatus.PREORDER_PAYMENT_CONFIRMED,
        "pre_order_payment_tx"
      );
      console.log(
        `${fn} [INFO] Transaction monitoring completed for payment_tx: ${payment_tx}. Proceeding to create multi preorders for order_id: ${order_id}, basket_ids: ${JSON.stringify(
          basket_ids
        )}`
      );

      await createMultiPreorders(order_id, basket_ids);

      console.log(
        `${fn} ✅ [SUCCESS] Multi preorders created successfully for order_id: ${order_id}, basket_ids: ${JSON.stringify(
          basket_ids
        )}`
      );

      return res.status(200).json({
        success: true,
        message:
          "Transaction monitored and multi preorders created successfully!",
      });
    } catch (error: any) {
      console.error(
        `${fn} ❌ [ERROR] Exception occurred during multi preorder verification:`,
        error
      );
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post(
  "/verify-tax-payment-stablecoin",
  ensureToken,
  validatePaymentFields,
  async (req, res) => {
    try {
      console.log(
        "📥 [REQUEST RECEIVED] for endpoint: /verify-tax-order-payment "
      );
      console.log("📥 [REQUEST RECEIVED] Full request body:", req.body);

      const { payment_tx, price, created_at } = req.body;

      if (!payment_tx || !price || !created_at) {
        console.error("❌ [ERROR] Missing required fields:", {
          payment_tx,
          price,
          created_at,
        });
        return res.status(400).json({ error: "Missing required fields" });
      }

      const context = await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "tax_wallet",
        created_at,
        "orders",
        "status",
        OrderStatus.ORDER_CONFIRMED,
        "tax_order_payment_tx"
      );
      await updateTableStatus(
        context.txHash,
        context.table,
        context.statusColumn,
        context.newStatus,
        context.identifierColumn
      );
      return res.status(200).json({
        success: true,
        message: "Transaction monitored successfully!",
      });
    } catch (error: any) {
      console.error("❌ [ERROR]:", error);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post("/create-multi-pre-orders", ensureToken, async (req, res) => {
  try {
    console.log("📥 [REQUEST RECEIVED] for endpoint: /create-pre-orders ");
    console.log("📥 [REQUEST RECEIVED] Full request body:", req.body);

    const { order_id, basket_ids } = req.body;

    if (!order_id || !basket_ids) {
      console.error("❌ [ERROR] Missing required fields:", {
        order_id: order_id,
        basket_ids: basket_ids,
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    await createMultiPreorders(order_id, basket_ids);

    return res.status(200).json({
      success: true,
      message: "Transaction monitored successfully!",
    });
  } catch (error: any) {
    console.error("❌ [ERROR]:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
// router.post("/create-single-pre-order", async (req, res) => {
//   try {
//     console.log(
//       "📥 [REQUEST RECEIVED] for endpoint: /create-single-pre-order "
//     );
//     console.log("📥 [REQUEST RECEIVED] Full request body:", req.body);

//     const { basket_id } = req.body;

//     if (!basket_id) {
//       console.error("❌ [ERROR] Missing required fields:", {
//         basket_id: basket_id,
//       });
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     await createSinglePreorder(basket_id);

//     return res.status(200).json({
//       success: true,
//       message: "Transaction monitored successfully!",
//     });
//   } catch (error: any) {
//     console.error("❌ [ERROR]:", error);

//     return res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });
router.post("/webhook/zinc/tax-request", ensureToken, async (req, res) => {
  try {
    console.log(
      "📥 [REQUEST RECEIVED] for endpoint: /webhook/zinc/tax-request"
    );
    console.log("📥 [REQUEST RECEIVED] Full request body:", req.body);

    const data = req.body;

    if (!data.price_components || !data.merchant_order_ids?.length) {
      console.error("❌ [ERROR] Missing required data:", {
        price_components: data.price_components,
        merchant_order_ids: data.merchant_order_ids,
      });
      return res.status(400).json({ error: "Missing required data." });
    }

    const merchantOrderId = data.merchant_order_ids[0].merchant_order_id;
    const { subtotal, shipping, tax, total } = data.price_components;

    console.log("🔍 [DATA EXTRACTED]", {
      merchantOrderId,
      subtotal,
      shipping,
      tax,
      total,
    });

    console.log(
      "📤 [DATABASE UPDATE] Attempting to update order in Supabase..."
    );
    const { error } = await supabase
      .from("orders")
      .update({
        subtotal_amount: subtotal,
        shipping_amount: shipping,
        tax_amount: tax,
        total_amount: total,
      })
      .eq("order_id", merchantOrderId);

    if (error) {
      console.error("❌ [ERROR] Supabase update failed:", error);
      return res.status(500).json({ error: "Database update failed." });
    }

    console.log("✅ [SUCCESS] Order updated successfully in Supabase.");
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("❌ [ERROR] Unexpected error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/verify-payment-cryptocurrency", ensureToken, async (req, res) => {
  const { tx_id, order_id } = req.body;

  if (!tx_id || !order_id) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: tx_id and order_id",
    });
  }

  pollTransactionUntilFinal(tx_id, order_id).catch((err) =>
    console.error(`❌ Background polling error for ${tx_id}:`, err)
  );

  return res.status(200).json({
    success: true,
    message: `Monitoring started for transaction ${tx_id} (order ${order_id})`,
  });
});

export default router;
