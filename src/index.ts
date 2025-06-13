import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

app.use(express.json());

app.use("/api", ensureToken, transactionsRouter);

console.log("✅ Transactions Router registrato su /api");

// 🔹 Avvia il server SOLO SE siamo in locale
const port = parseInt(process.env.PORT || "8080", 10);

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server in esecuzione su http://0.0.0.0:${port}`);
});
// 🔹 Esportiamo Express per Vercel
