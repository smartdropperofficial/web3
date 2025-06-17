import os from "os";
import app from "./app";

// 🔹 Avvia il server SOLO SE siamo in locale
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
setTimeout(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Listening on http://0.0.0.0:${PORT}`);
    console.log(`🧠 Network interfaces:`);
    console.log(os.networkInterfaces());
  });
}, 500); // 500ms delay per evitare race condition nei health check
