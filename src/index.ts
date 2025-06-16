import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

app.use(express.json());

app.use("/api", ensureToken, transactionsRouter);

// 🔹 Avvia il server SOLO SE siamo in locale
if (process.env.NODE_ENV !== "vercel") {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`✅ Server in esecuzione su http://localhost:${PORT}`);
  });
}

// 🔹 Esportiamo Express per Vercel
