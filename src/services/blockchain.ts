// import { Contract, formatUnits } from "ethers";
// import { provider } from "../config/provider";
// import { saveTransaction } from "./transactions";
// import { log } from "../utils/logger";
// import { Transaction } from "../types";

// // Indirizzi ufficiali dei contratti ERC20 su Polygon (USDT & USDC)
// const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT su Polygon
// const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC su Polygon

// const ERC20_ABI = [
//   "event Transfer(address indexed from, address indexed to, uint256 value)",
// ];

// const usdtContract = new Contract(USDT_CONTRACT, ERC20_ABI, provider);
// const usdcContract = new Contract(USDC_CONTRACT, ERC20_ABI, provider);

// // 🕒 Poll for Events Every 10 Seconds
// export const pollTransferEvents = async () => {
//   try {
//     const latestBlock = await provider.getBlockNumber();
//     const fromBlock = latestBlock - 50; // Poll the last 50 blocks

//     const logs = await provider.getLogs({
//       fromBlock: `0x${fromBlock.toString(16)}`,
//       toBlock: "latest",
//       address: [USDT_CONTRACT, USDC_CONTRACT],
//       topics: [
//         "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
//       ],
//     });

//     for (const eventLog of logs) {
//       try {
//         const parsedLog = usdtContract.interface.parseLog(eventLog);
//         if (!parsedLog) continue;

//         const { from, to, value } = parsedLog.args;
//         const tokenAddress = eventLog.address.toLowerCase();
//         const txHash = eventLog.transactionHash;

//         log.info(
//           `📡 Detected Transfer: ${from} -> ${to}, Amount: ${formatUnits(
//             value,
//             6
//           )}`
//         );

//         const transaction: Transaction = {
//           tx_hash: txHash,
//           from_address: from.toLowerCase(),
//           to_address: to.toLowerCase(),
//           amount: formatUnits(value, 6),
//           token_address: tokenAddress,
//         };

//         await saveTransaction(transaction);
//       } catch (error) {
//         log.error(`❌ Error parsing log: ${error}`);
//       }
//     }
//   } catch (error) {
//     log.error(`❌ Error polling logs: ${error}`);
//   }
// };

// // Start polling for transfer events every 10 seconds
// setInterval(pollTransferEvents, 10000);
// log.info("⏳ Polling for USDT and USDC transfers every 10 seconds...");
