import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

import { safeAbi } from "./abis/index";
import { CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS, NEG_RISK_ADAPTER_ADDRESS, USDCE_DIGITS, USDC_ADDRESS } from "./constants";
import { encodeRedeem, encodeRedeemNegRisk } from "./encode";
import { signAndExecuteSafeTransaction } from "./safe-helpers";
import { SafeTransaction, OperationType, PolymarketPosition } from "./types";
import { PolymarketApiClient } from './polymarketApisForRedeemablePostions';


dotenvConfig({ path: resolve(__dirname, "../../.env") });

export async function redeemPositions() {
    console.log(`Checking Redeeming Positions...`);
    const timestamp = new Date().toISOString();
    console.log(`Time: ${timestamp}`);

    const polymarketApiClient = new PolymarketApiClient();

    // Validate PROXY_ADDRESS
    const proxyAddress = process.env.PROXY_ADDRESS;
    if (!proxyAddress || proxyAddress.trim() === '') {
        throw new Error("PROXY_ADDRESS env var is required");
    }

    // Fetch redeemable positions
    const positions = await polymarketApiClient.getRedeemablePositions(proxyAddress.trim());

    if (positions.length === 0) {
        console.log("No redeemable positions found");
        return;
    }

    console.log(`Found ${positions.length} redeemable positions`);

    const provider = new ethers.providers.JsonRpcProvider(`${process.env.RPC_URL}`);
    const pk = new ethers.Wallet(`${process.env.PRIVATE_KEY}`);
    const wallet = pk.connect(provider);

    console.log(`Address: ${wallet.address}`);

    // Safe
    const safeAddress = process.env.SAFE_ADDRESS as string;
    if (!safeAddress) {
        throw new Error("SAFE_ADDRESS env var is required");
    }
    const safe = new ethers.Contract(safeAddress, safeAbi, wallet);

    // Group positions by conditionId to process each unique conditionId
    const positionsByConditionId = new Map<string, PolymarketPosition[]>();
    for (const position of positions) {
        if (!position.conditionId) {
            console.warn(`Position missing conditionId, skipping: ${JSON.stringify(position)}`);
            continue;
        }

        if (!positionsByConditionId.has(position.conditionId)) {
            positionsByConditionId.set(position.conditionId, []);
        }
        positionsByConditionId.get(position.conditionId)!.push(position);
    }

    console.log(`Processing ${positionsByConditionId.size} unique conditionIds`);

    // Process each conditionId
    for (const [conditionId, conditionPositions] of positionsByConditionId) {
        try {
            console.log(`\nProcessing conditionId: ${conditionId} (${conditionPositions.length} position(s))`);

            let data: string;
            let to: string;

            // Standard redemption using USDC as collateral
            data = encodeRedeem(USDC_ADDRESS, conditionId);
            to = CONDITIONAL_TOKENS_FRAMEWORK_ADDRESS;

            const safeTxn: SafeTransaction = {
                to: to,
                data: data,
                operation: OperationType.Call,
                value: "0",
            };

            console.log(`Executing safe transaction for conditionId: ${conditionId}`);
            const txn = await signAndExecuteSafeTransaction(wallet, safe, safeTxn, { gasPrice: 200000000000 });

            console.log(`Transaction submitted - Hash: ${txn.hash}`);
            const receipt = await txn.wait();
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        } catch (error) {
            console.error(`Error processing conditionId ${conditionId}:`, error);
            // Continue with next conditionId even if one fails
        }
    }

    console.log(`\nRedemption process completed!`);
}