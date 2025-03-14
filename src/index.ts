import express from "express";
import transactionsRouter from "./routes/transactionsRouter";
import { ensureToken } from "./services/tokenService";
import { supabase } from "./config/supabase";

const app = express();

// Middleware per il parsing del JSON
app.use(express.json());

// Endpoint per il debug delle variabili d'ambiente
app.get("/debug-env", (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL || "MISSING",
    SUPABASE_KEY: process.env.SUPABASE_KEY ? "EXISTS" : "MISSING",
  });
});

// Endpoint per testare la connessione a Supabase
app.get("/debug-supabase", async (req, res) => {
  const { data, error } = await supabase.from("config").select("*").limit(1);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ data });
});

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
