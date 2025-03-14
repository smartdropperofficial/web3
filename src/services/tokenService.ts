import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const ensureToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("\n🔒 [AUTH CHECK] -- START --");

  // **Extract Authorization header**
  const bearerHeader = req.headers["authorization"];

  // **Check if the Authorization header exists**
  if (!bearerHeader) {
    console.error("❌ [AUTH ERROR] Missing Authorization header!");
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing Authorization header" });
  }

  // **Check if it follows 'Bearer <token>' format**
  const parts = bearerHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    console.error(
      "🚫 [AUTH ERROR] Invalid Authorization format! Expected 'Bearer <token>'"
    );
    return res.status(401).json({
      error:
        "Unauthorized: Invalid Authorization format. Expected 'Bearer <token>'",
    });
  }

  // **Extract token**
  const token = parts[1];
  console.log(
    `🔑 Extracted Token: ${token.substring(0, 10)}... (truncated for security)`
  );

  // **Check if JWT_SECRETKEY is available**
  const secretKey = process.env.JWT_SECRETKEY;
  if (!secretKey) {
    console.error(
      "🔥 [CRITICAL ERROR] Missing JWT_SECRETKEY in environment variables! ❌"
    );
    return res
      .status(500)
      .json({ error: "Internal Server Error: Missing JWT secret key" });
  }

  console.log("🛠️ [VERIFY] Checking token integrity...");

  // **Verify the JWT**
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      console.error(
        "⏳ [AUTH FAILED] Invalid or expired token! ❌",
        err.message
      );
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or expired token" });
    }

    console.log("✅ [AUTH SUCCESS] Token verified!");
    console.log(`👤 User Data: ${JSON.stringify(decoded, null, 2)}`);
    console.log("🔓 [ACCESS GRANTED] Proceeding to next middleware...\n");
    next();
  });
};
