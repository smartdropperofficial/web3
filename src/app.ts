// src/app.ts
import express from "express";
import transactionRoutes from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express(); // Niente express.json() qui

app.use("/api", ensureToken, transactionRoutes);

export default app;
