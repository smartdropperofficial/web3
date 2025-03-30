import { Request, Response, NextFunction } from "express";

export function validatePaymentFields(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errors: string[] = [];

  // 1. payment_tx
  const rawTx = req.body.payment_tx;
  const cleanedTx = typeof rawTx === "string" ? rawTx.trim() : "";
  if (!/^0x([A-Fa-f0-9]{64})$/.test(cleanedTx)) {
    errors.push("Invalid or missing 'payment_tx'");
  } else {
    req.body.payment_tx = cleanedTx;
  }

  // 2. price
  const price = parseFloat(req.body.price);
  if (isNaN(price) || price <= 0) {
    errors.push("Invalid or missing 'price'");
  } else {
    req.body.price = price; // Cast sicuro a number
  }

  // 3. created_at
  const createdAt = new Date(req.body.created_at);
  if (isNaN(createdAt.getTime())) {
    errors.push("Invalid or missing 'created_at'");
  } else {
    req.body.created_at = createdAt.toISOString(); // Normalizza in formato ISO UTC
  }

  // Rispondi con errori se presenti
  if (errors.length > 0) {
    console.error("❌ Validation errors:", errors);
    return res.status(400).json({
      success: false,
      message: "Invalid request body",
      errors,
    });
  }

  next();
}
