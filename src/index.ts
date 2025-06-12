import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

app.use(express.json());

app.use("/api", ensureToken, transactionsRouter);

console.log("✅ Transactions Router registrato su /api");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server in esecuzione su http://localhost:${PORT}`);
});
