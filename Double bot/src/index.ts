import { DateTime } from "luxon";
import {
  findCurrentMarket,
  findFutureMarket,
  marketsFromJson,
} from "./findCurrentMarket";
import { getCurrentEasternTime } from "./timeUtils";
import marketsJson from "../../polymarket_markets.json";
import { buyYesForMarket, buyNoForMarket, getMarketPrice } from "./tradingBot";
import { redeemPositions } from "./redeem";

// Persist preResult and count between runs
let preResult: string = "";
let count: number = 0;

async function main() {
  try {

    const markets = marketsFromJson(marketsJson);
    const nowEt: DateTime = getCurrentEasternTime();
    console.log("nowEt", nowEt);
    const current = findCurrentMarket(markets, nowEt);
    // console.log("current", current);

    // console.log(`Current ET time: ${nowEt.toFormat("yyyy-LL-dd HH:mm:ss ZZZZ")}`);

    if (!current) {
      console.log("No market window currently active.");
      return;
    }

    // console.log("Current market (within 15-min window):");
    // console.log(JSON.stringify(current, null, 2));

    const future = findFutureMarket(markets, current);
    
    if (future) {
      // Get YES token price of current market
      // console.log("Checking YES token price of current market...");
      const currentYesPrice = await getMarketPrice(current.yesTokenId, "BUY");
      // console.log(`Current market YES token price: $${currentYesPrice.toFixed(4)}`);
      
      // Determine currentResult based on price
      const currentResult = currentYesPrice > 0.5 ? "YES" : "NO";
      
      // Update count based on comparison with preResult
      if (preResult === "") {
        // First run, initialize
        count = 0;
      } else if (currentResult === preResult) {
        // Same result, reset count to 0
        count = 0;
      } else {
        // Different result, increment count
        count++;
      }
      
      // Calculate amount: 2^count
      // const amount = 2*Math.pow(2, count);
      const amount = 2;
      
      console.log(`Previous result: ${preResult || "N/A"}, Current result: ${currentResult}, Count: ${count}, Amount: ${amount}`);
      
      // Update preResult for next run
      preResult = currentResult;
      
      // Buy conditionally based on current market YES price
      if (currentYesPrice > 0.5) {
        console.log("YES price > $0.50, buying NO token for future market");
        console.log("amount-up", amount);
        await buyYesForMarket(future, amount);
      } else {
        console.log("YES price <= $0.50, buying YES token for future market");
        console.log("amount-down", amount);
        await buyNoForMarket(future, amount);
      }
    } else {
      console.log("No future market found (no = current.no - 1)");
    }
    // Check and redeem any redeemable tokens first
    console.log("Checking for redeemable positions...");
    await redeemPositions();
    
  } catch (err) {
    console.error("Error while finding current market:", err);
    // Don't exit on error, just log and continue to next run
  }
}

/**
 * Calculate the next 15-minute interval (at 50 seconds):
 * :59:50, :14:50, :29:50, :44:50
 */
function getNextRunTime(now: DateTime): DateTime {
  const minute = now.minute;
  const second = now.second;
  const millisecond = now.millisecond;

  // Find the current 15-minute interval and determine target
  // Intervals: 0-14 -> 14:50, 15-29 -> 29:50, 30-44 -> 44:50, 45-59 -> 59:50
  let targetMinute: number;
  let targetHour = now.hour;

  if (minute < 15) {
    targetMinute = 14;
  } else if (minute < 30) {
    targetMinute = 29;
  } else if (minute < 45) {
    targetMinute = 44;
  } else {
    targetMinute = 59;
  }

  // Check if we've already passed the 50-second mark of the current interval
  const pastTargetTime =
    minute > targetMinute ||
    (minute === targetMinute && (second > 50 || (second === 50 && millisecond > 0)));

  if (pastTargetTime) {
    // Move to next interval
    if (targetMinute === 59) {
      // Next interval is 14:50 of the next hour
      targetMinute = 14;
      targetHour = (targetHour + 1) % 24;
    } else {
      // Next interval is 15 minutes later
      targetMinute = targetMinute + 15;
    }
  }

  return now.set({
    hour: targetHour,
    minute: targetMinute,
    second: 50,
    millisecond: 0,
  });
}

/**
 * Wait until the next scheduled run time, then execute main()
 */
async function scheduleNextRun(): Promise<void> {
  while (true) {
    const now = getCurrentEasternTime();
    const nextRun = getNextRunTime(now);
    const waitMs = nextRun.diff(now).as("milliseconds");

    console.log(
      `Next run scheduled for: ${nextRun.toFormat("yyyy-LL-dd HH:mm:ss ZZZZ")} (in ${Math.round(waitMs / 1000)} seconds)`
    );

    await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitMs)));

    console.log(`\n=== Starting scheduled run at ${getCurrentEasternTime().toFormat("yyyy-LL-dd HH:mm:ss ZZZZ")} ===`);
    await main();
    console.log(`=== Completed run at ${getCurrentEasternTime().toFormat("yyyy-LL-dd HH:mm:ss ZZZZ")} ===\n`);
  }
}

if (require.main === module) {
  console.log("Bot started. Will run every 15 minutes at :59:50, :14:50, :29:50, :44:50");
  
  // Run redemption immediately on startup, then start scheduling
  (async () => {
    try {
      console.log("\n=== Initial startup: Checking for redeemable positions ===");
      await redeemPositions();
      console.log("=== Initial redemption check completed ===\n");
    } catch (err) {
      console.error("Error during initial redemption check:", err);
      // Continue to scheduled runs even if initial redemption fails
    }
    
    // Wait for the exact scheduled time before running main trading logic
    await scheduleNextRun();
  })();
}
