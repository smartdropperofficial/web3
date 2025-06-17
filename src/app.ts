import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import transactionRoutes from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();
app.set("trust proxy", true);

// Sicurezza base
app.use(helmet());
app.use(express.json());

// Rate limit globale
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
});
app.use(limiter);

// Rotte pubbliche (no token)
const publicRouter = express.Router();
publicRouter.get("/health", (_, res) => res.send("OK"));
app.use("/api", publicRouter);

app.use((req, res, next) => {
  if (req.path === "/api/health") return next(); // skip limiter
  return limiter(req, res, next);
});

// Rotte protette
app.use("/api", ensureToken, limiter, transactionRoutes);

export default app;
