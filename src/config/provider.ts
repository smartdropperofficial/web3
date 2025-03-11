import { JsonRpcProvider } from "ethers";
import { POLYGON_RPC_URL } from "./dotenv";

export const provider = new JsonRpcProvider(POLYGON_RPC_URL);
