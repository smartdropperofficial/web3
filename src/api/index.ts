import { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../server"; // ✅ Import Express app from `src/`

export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res); // ✅ Use Express as a serverless function
};
