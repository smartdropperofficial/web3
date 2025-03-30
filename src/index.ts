import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

// Middleware per il parsing del JSON
app.use(express.json());

// Registriamo il router sotto `/api`
app.use("/api", ensureToken, transactionsRouter);

console.log("✅ Transactions Router registrato su /api");

// 🔹 Avvia il server SOLO SE siamo in locale
if (process.env.NODE_ENV !== "vercel") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`✅ Server in esecuzione su http://localhost:${PORT}`);
  });
}

// 🔹 Esportiamo Express per Vercel
