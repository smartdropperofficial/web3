import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import transactionRoutes from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

// Sicurezza base
app.use(helmet());
app.use(express.json());

// Rate limit globale
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 30,
});
app.use(limiter);

// Estensione tipo per req.user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Applica il middleware a tutte le route protette
app.use("/api", ensureToken, transactionRoutes);

export default app;
