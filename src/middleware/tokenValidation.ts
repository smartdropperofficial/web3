import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const ensureToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const bearerHeader = req.headers["authorization"];

  if (!bearerHeader) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing Authorization header" });
  }

  const parts = bearerHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error:
        "Unauthorized: Invalid Authorization format. Expected 'Bearer <token>'",
    });
  }

  const token = parts[1];
  const secretKey = process.env.JWT_SECRETKEY;
  if (!secretKey) {
    return res
      .status(500)
      .json({ error: "Internal Server Error: Missing JWT secret key" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Invalid or expired token" });
    }

    req.user = decoded;

    if (process.env.NODE_ENV !== "production") {
      console.log(`👤 Token decoded: ${JSON.stringify(decoded, null, 2)}`);
    }

    next();
  });
};
