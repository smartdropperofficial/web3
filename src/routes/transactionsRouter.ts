import { Router } from "express";
import {
  createOrderOnBlockchain,
  monitorTransaction,
} from "../services/transactionVerifier";
import {
  CreateSubcriptionOnChainParams,
  OrderStatus,
  SubscriptionStatus,
} from "../types/types";

const router = Router();

router.get("/hello", (req, res) => {
  res.status(200).send("Hello, world!");
});

router.post("/verify-subscription-payment", async (req, res) => {
  try {
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
      "subscription_wallet",
      created_at,
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
    console.log("🚀 ~ router.post ~ error:", error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.post("/create-subscription-onchain", async (req, res) => {
  try {
    const para = req.body as CreateSubcriptionOnChainParams;
    if (para.status !== SubscriptionStatus.CONFIRMING) {
      return res.status(400).json({
        success: false,
        message: "Subscription is not in confirming state",
      });
    } else {
      await createOrderOnBlockchain(para);
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
router.post("/verify-pre-order-payment", (req, res) => {
  monitorTransaction(
    req.body.payment_tx,
    parseFloat(req.body.amount_paid),
    "pre_order_wallet",
    req.body.created_at,
    "orders",
    "status",
    OrderStatus.AWAITING_TAX,
    "payment_tx"
  );
  res.status(202).json({
    success: true,
    message: "Monitoring started for pre-order payment.",
  });
});
router.post("/verify-order-confirmation-payment", (req, res) => {
  monitorTransaction(
    req.body.payment_tx,
    parseFloat(req.body.amount_paid),
    "tax_wallet",
    req.body.created_at,
    "orders",
    "status",
    OrderStatus.ORDER_CONFIRMED,
    "payment_tx"
  );
  res.status(202).json({
    success: true,
    message: "Monitoring started for order confirmation payment.",
  });
});

export default router;
