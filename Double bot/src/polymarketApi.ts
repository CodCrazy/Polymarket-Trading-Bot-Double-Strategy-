import https from "https";

const CLOB_BASE_URL = "https://clob.polymarket.com";

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
 * Fetch order book for a given Polymarket marketId.
 *
 * NOTE: The exact REST path/response format is documented in
 * Polymarket's CLOB docs. Adjust the URL and parsing logic here
 * to match the current API: https://docs.polymarket.com/developers/CLOB/introduction
 */
export async function fetchOrderBook(marketId: string): Promise<any | null> {
  const url = `${CLOB_BASE_URL}/markets/${marketId}/book`;
  try {
    return await httpGetJson<any>(url);
  } catch (err) {
    console.error("Failed to fetch order book:", err);
    return null;
  }
}

/**
 * Extract best ask (lowest ask price) per outcome from the order book.
 *
 * This is intentionally written against a loose `any` because
 * the exact schema can change. Implement this according to the
 * actual response you see from the CLOB `book` endpoint.
 */
export function extractBestAsksFromOrderBook(book: any): number[] | null {
  if (!book) return null;

  // Example strategy assuming an array of orders with fields:
  // { outcome: number, side: 'buy' | 'sell', price: string }
  // You MUST adapt this to the real response.

  const asksByOutcome = new Map<number, number>();

  const orders: any[] = book.orders ?? book.asks ?? [];
  for (const o of orders) {
    const side = o.side ?? o.type ?? "";
    if (typeof side === "string" && side.toLowerCase() !== "sell") continue;

    const outcomeIdx: number = typeof o.outcome === "number" ? o.outcome : NaN;
    if (Number.isNaN(outcomeIdx)) continue;

    const priceNum = typeof o.price === "string" ? Number(o.price) : Number(o.price);
    if (!Number.isFinite(priceNum)) continue;

    const existing = asksByOutcome.get(outcomeIdx);
    if (existing === undefined || priceNum < existing) {
      asksByOutcome.set(outcomeIdx, priceNum);
    }
  }

  if (asksByOutcome.size === 0) return null;

  const maxIdx = Math.max(...Array.from(asksByOutcome.keys()));
  const bestAsks: number[] = [];
  for (let i = 0; i <= maxIdx; i++) {
    const v = asksByOutcome.get(i);
    if (v === undefined) {
      return null;
    }
    bestAsks.push(v);
  }

  return bestAsks;
}
