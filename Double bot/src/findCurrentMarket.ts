import { DateTime } from "luxon";
import { Market, MarketJsonFile } from "./marketTypes";
import { getCurrentEasternTime } from "./timeUtils";

/**
 * Given all markets and a specific `now` in ET, find the market whose
 * 15-minute window contains `now`.
 */
export function findCurrentMarket(
  markets: Market[],
  nowEt: DateTime = getCurrentEasternTime()
): Market | null {
  for (const market of markets) {
    if (isNowWithinMarketWindow(nowEt, market)) {
      return market;
    }
  }
  return null;
}

function isNowWithinMarketWindow(nowEt: DateTime, market: Market): boolean {
  const nowEpoch = Math.floor(nowEt.toSeconds());
  const start = market["15minStart"];
  const end = market["15minEnd"];
  return nowEpoch >= start && nowEpoch < end;
}

/**
 * Find the future market that is in front of (after) the current market.
 * The future market's "no" field equals (current market's "no" - 1).
 */
export function findFutureMarket(
  markets: Market[],
  currentMarket: Market
): Market | null {
  const targetNo = currentMarket.no - 1;
  return markets.find((m) => m.no === targetNo) || null;
}

/**
 * Helper to adapt the raw JSON structure into our typed `Market[]`.
 * Adjust this function if your JSON has a different shape.
 */
export function marketsFromJson(raw: any): Market[] {
  const data = raw as MarketJsonFile;
  if (!data.markets || !Array.isArray(data.markets)) {
    throw new Error("Invalid markets JSON: expected 'markets' array");
  }
  return data.markets;
}
