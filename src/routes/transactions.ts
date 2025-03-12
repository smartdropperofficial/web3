import { Router } from "express";
import { monitorTransaction } from "../services/transactionVerifier";

const router = Router();

router.post("/verify-subscription-payment", (req, res) => {
  monitorTransaction(
    req.body.payment_tx,
    parseFloat(req.body.amount_paid),
    "tax_wallet",
    req.body.created_at,
    "subscription",
    "status",
    "ENABLED",
    "payment_tx"
  );
  res
    .status(202)
    .json({
      success: true,
      message: "Monitoring started for subscription payment.",
    });
});

router.post("/verify-pre-order-payment", (req, res) => {
  monitorTransaction(
    req.body.payment_tx,
    parseFloat(req.body.amount_paid),
    "tax_wallet",
    req.body.created_at,
    "orders",
    "status",
    "AWATING_PAYMENT",
    "payment_tx"
  );
  res
    .status(202)
    .json({
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
    "ORDER_CONFIRMED",
    "payment_tx"
  );
  res
    .status(202)
    .json({
      success: true,
      message: "Monitoring started for order confirmation payment.",
    });
});

export default router;
