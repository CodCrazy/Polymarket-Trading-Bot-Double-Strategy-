import https from "https";
import { Market } from "./marketTypes";
import { getClobClient } from "./clobClient";
import { OrderType, Side } from "@polymarket/clob-client";
import { Wallet, Contract, providers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

export interface OrderIntent {
  marketId: string;
  outcomeIndex: number; // 0: YES, 1: NO (adjust if needed)
  size: number; // outcome token size
  side: "buy";
}

// Adjust this to control how much you buy per side.
const DEFAULT_QUOTE_SIZE = 1; // 1 USDC equivalent per side

/**
 * Basic HTTPS GET helper returning parsed JSON.
 */
function httpGetJson<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf8");
            const json = JSON.parse(raw);
            resolve(json as T);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Get market price for a specific token.
 * Uses the Polymarket pricing API: https://docs.polymarket.com/api-reference/pricing/get-market-price
 */
export async function getMarketPrice(
  tokenId: string,
  side: "BUY" | "SELL" = "BUY"
): Promise<number> {
  const url = `https://clob.polymarket.com/price?token_id=${tokenId}&side=${side}`;
  try {
    const response = await httpGetJson<{ price: string }>(url);
    const price = parseFloat(response.price);
    if (!Number.isFinite(price)) {
      throw new Error(`Invalid price returned: ${response.price}`);
    }
    return price;
  } catch (err) {
    console.error(`Error fetching market price for token ${tokenId}:`, err);
    throw err;
  }
}

function buildOrdersForYesNo(
  market: Market,
  quoteSizePerSide: number
): OrderIntent[] {
  // const yesSize = quoteSizePerSide / yesPrice;
  // const noSize = quoteSizePerSide / noPrice;

  return [
    {
      marketId: market.marketId,
      outcomeIndex: 0, // YES
      size: 5,
      side: "buy",
    },
    {
      marketId: market.marketId,
      outcomeIndex: 1, // NO
      size: 5,
      side: "buy",
    },
  ];
}

/**
 * Submit a real FOK (Fill-Or-Kill) buy order to the Polymarket CLOB.
 *
 * This uses the official TypeScript client (`@polymarket/clob-client`),
 * which signs the order and posts it to the REST API under the hood.
 * Underneath, this hits the same `/orders` endpoint documented at:
 * https://docs.polymarket.com/developers/CLOB/orders/create-order-batch
 */
async function submitOrder(order: OrderIntent): Promise<void> {
  const client = await getClobClient();
  console.log("passed client to submitOrder");

  // Map outcomeIndex -> tokenId from the market snapshot
  const tokenId =
    order.outcomeIndex === 0
      ? order.marketId /* placeholder, overridden by caller */
      : order.marketId;

  // NOTE: We let the caller pass the correct tokenId via market,
  // so this function will actually be called with an enriched intent.
  // See `runYesNoBotForMarket` below where we set the tokenId.

  console.log("Submitting FOK market order:", order);

  const response = await client.createAndPostMarketOrder(
    {
      tokenID: (order as any).tokenId ?? tokenId,
      // `amount` is the outcome token amount for a market order
      amount: order.size,
      side: Side.BUY,
    },
    {},
    OrderType.FOK
  );

  console.log("Order response:", response);
}

/**
 * Buy only YES token for a market (tries 3 times)
 */
export async function buyYesForMarket(market: Market, amount: number): Promise<void> {
  const order: OrderIntent & { tokenId: string } = {
    marketId: market.marketId,
    outcomeIndex: 0, // YES
    size: amount,
    side: "buy",
    tokenId: market.yesTokenId,
  };
  
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Buy attempt ${attempt}/${maxAttempts} for YES token`);
      await submitOrder(order);
      console.log(`Buy attempt ${attempt}/${maxAttempts} completed for YES token`);
    } catch (error) {
      console.error(`Buy attempt ${attempt}/${maxAttempts} failed for YES token:`, error);
      // Continue to next attempt even if this one failed
    }
    // Small delay between attempts
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Buy only NO token for a market (tries 3 times)
 */
export async function buyNoForMarket(market: Market, amount: number): Promise<void> {
  const order: OrderIntent & { tokenId: string } = {
    marketId: market.marketId,
    outcomeIndex: 1, // NO
    size: amount,
    side: "buy",
    tokenId: market.noTokenId,
  };
  
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Buy attempt ${attempt}/${maxAttempts} for NO token`);
      await submitOrder(order);
      console.log(`Buy attempt ${attempt}/${maxAttempts} completed for NO token`);
    } catch (error) {
      console.error(`Buy attempt ${attempt}/${maxAttempts} failed for NO token:`, error);
      // Continue to next attempt even if this one failed
    }
    // Small delay between attempts
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Buy both YES and NO tokens for a market (original function, kept for compatibility)
 */
export async function buyYesNoForMarket(market: Market): Promise<void> {
  const orders = buildOrdersForYesNo(market, DEFAULT_QUOTE_SIZE).map(
    (o) => ({
      ...o,
      // Attach actual token IDs so submitOrder can send to CLOB
      tokenId: o.outcomeIndex === 0 ? market.yesTokenId : market.noTokenId,
    })
  ) as (OrderIntent & { tokenId: string })[];

  for (const order of orders) {
    await submitOrder(order);
  }
}
