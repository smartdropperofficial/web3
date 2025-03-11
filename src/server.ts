import express from "express";
import { PORT } from "./config/dotenv";
import transactionRoutes from "./routes/transactions";

const app = express();
app.use(express.json());

// Registra solo le route per la verifica delle transazioni
app.use(transactionRoutes);

app.listen(PORT, () => console.log(`🚀 Server in ascolto sulla porta ${PORT}`));
