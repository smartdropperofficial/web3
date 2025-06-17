import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

app.use(express.json());

app.use("/api", ensureToken, transactionsRouter);

// 🔹 Avvia il server SOLO SE siamo in locale
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server in esecuzione su http://0.0.0.0:${PORT}`);
});
