import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import transactionRoutes from "./routes/transactionsRouter";
import { ensureToken } from "./middleware/tokenValidation";

const app = express();

// Attiva `trust proxy` se dietro a proxy come Fly.io o Cloudflare
app.set("trust proxy", true);

// Sicurezza base
app.use(helmet());
app.use(express.json());

// const limiter = rateLimit({
//   windowMs: 1 * 60 * 1000,
//   max: 30,
//   message: "Too many requests, please try again later.",
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     const authHeader = req.headers.authorization || "";
//     return authHeader === `Bearer ${process.env.SUPABASE_INTERNAL_TOKEN}`;
//   },
// });

app.get("/api/health", (_, res) => res.send("OK"));

// app.use((req, res, next) => {
//   if (req.path === "/api/health") return next();
//   return limiter(req, res, next);
// });

// Rotte protette (con validazione token)
app.use("/api", ensureToken, transactionRoutes);

// Export app
export default app;
