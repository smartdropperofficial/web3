import express from "express";
import transactionRoutes from "./routes/transactions";

const app = express();
app.use(express.json());

// Register transaction verification routes
app.use(transactionRoutes);

export default app; // ✅ Required for Vercel deployment
