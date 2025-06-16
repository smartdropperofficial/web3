import { Router } from "express";
import {
  createSinglePreorder,
  createSubscriptionOnBlockchain,
} from "./services/updateStatus/index";
import { monitorTransaction } from "./services/transactionVerifier";
import {
  CreateSubcriptionOnChainParams,
  SubscriptionStatus,
} from "./types/types";
import { OrderStatus } from "./types/enums";
import { validatePaymentFields } from "./middleware/validatePaymentFields";
import { ensureToken } from "./middleware/tokenValidation";
import { supabase } from "./config/supabase";
import { pollTransactionUntilFinal } from "./services/monitoring/thirdPartServices/ExolixStatus";

const router = Router();

const requireOrderOwnership = async (req, res, next) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: "Missing order_id" });

  const { data, error } = await supabase
    .from("orders")
    .select("wallet_address")
    .eq("order_id", order_id)
    .single();

  if (error || !data) return res.status(404).json({ error: "Order not found" });

  if (data.wallet_address !== req.user?.wallet) {
    return res.status(403).json({ error: "Forbidden: not your order" });
  }

  next();
};

router.post(
  "/verify-subscription-payment",
  ensureToken,
  validatePaymentFields,
  async (req, res) => {
    try {
      const { payment_tx, price, created_at } = req.body;
      if (!payment_tx || !price || !created_at) {
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
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/create-stablecoin-subscription-onchain",
  ensureToken,
  async (req, res) => {
    try {
      const para = req.body as CreateSubcriptionOnChainParams;
      if (para.status !== SubscriptionStatus.ENABLED) {
        return res.status(400).json({
          success: false,
          message: "Subscription is not in confirming state",
        });
      }
      await createSubscriptionOnBlockchain(para);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/verify-single-pre-order-payment-stablecoin",
  ensureToken,
  validatePaymentFields,
  requireOrderOwnership,
  async (req, res) => {
    try {
      const { payment_tx, price, created_at, basket_id } = req.body;
      if (!payment_tx || !price || !created_at || !basket_id) {
        return res.status(400).json({ error: "Missing required fields" });
      }

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

      await createSinglePreorder(basket_id);

      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
);

router.post(
  "/verify-payment-cryptocurrency",
  ensureToken,
  requireOrderOwnership,
  async (req, res) => {
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
  }
);

export default router;
