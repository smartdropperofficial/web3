// src/app.ts
import express from "express";
import transactionRoutes from "./routes/transactionsRouter";

const app = express(); // Niente express.json() qui

app.use("/api", transactionRoutes);

export default app;
