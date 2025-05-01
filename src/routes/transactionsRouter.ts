import { Router } from "express";
import {
  createSubscriptionOnBlockchain,
  monitorTransaction,
} from "../services/transactionVerifier";
import {
  CreateSubcriptionOnChainParams,
  SubscriptionStatus,
} from "../types/types";
import { OrderStatus } from "../types/enums";
import { validatePaymentFields } from "../middleware/validatePaymentFields";
import { supabase } from "../config/supabase";

const router = Router();

// router.get("/hello", (req, res) => {
//   res.status(200).send("Hello, world!");
// });
const pendingTransactions: { [txHash: string]: boolean } = {};

router.post(
  "/verify-subscription-payment",
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
router.post("/create-subscription-onchain", async (req, res) => {
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
});
router.post(
  "/verify-pre-order-payment",
  validatePaymentFields,
  async (req, res) => {
    try {
      console.log(
        "📥 [REQUEST RECEIVED] for endpoint: /verify-pre-order-payment "
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

      await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "pre_order_wallet",
        created_at,
        "orders",
        "status",
        OrderStatus.PREORDER_PLACED,
        "pre_order_payment_tx"
      );

      return res.status(200).json({
        success: true,
        message: "Transaction monitored successfully!",
      });
    } catch (error: any) {
      console.log("❌ [ERROR]:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);
router.post(
  "/verify-tax-order-payment",
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

      await monitorTransaction(
        payment_tx,
        parseFloat(price),
        "tax_wallet",
        created_at,
        "orders",
        "status",
        OrderStatus.ORDER_CONFIRMED,
        "tax_order_payment_tx"
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
router.post("/webhook/zinc/tax-request", async (req, res) => {
  const data = req.body;

  if (!data.price_components || !data.merchant_order_ids?.length) {
    return res.status(400).json({ error: "Missing required data." });
  }

  const merchantOrderId = data.merchant_order_ids[0].merchant_order_id;
  const { subtotal, shipping, tax, total } = data.price_components;

  const { error } = await supabase
    .from("orders")
    .update({ subtotal, shipping, tax, total })
    .eq("merchant_order_id", merchantOrderId);

  if (error) {
    console.error("Errore Supabase:", error);
    return res.status(500).json({ error: "Database update failed." });
  }

  res.status(200).json({ success: true });
});

export default router;
