import * as fs from 'fs';
import * as path from 'path';
import * as schedule from 'node-schedule';
import { DateTime } from 'luxon';

// Configuration
const BASE_URL = 'https://gamma-api.polymarket.com';
const SEARCH_TERM = 'btc-updown-15m';
const JSON_FILE_PATH = path.join(__dirname, '..', 'polymarket_markets.json');

interface Market {
  id: string;
  question: string;
  slug: string;
  startDate?: string;
  startDateIso?: string;
  endDate?: string;
  endDateIso?: string;
  category?: string;
  active?: boolean;
  closed?: boolean;
  volume?: string;
  liquidity?: string;
  outcomes?: string;
  outcomePrices?: string;
  createdAt?: string;
  updatedAt?: string;
  clobTokenIds?: string;
}

interface GammaEvent {
  id?: string;
  markets?: Market[];
  [key: string]: any;
}

interface FormattedMarket {
  no: number;
  marketId: string;
  question: string;
  slug: string;
  start_time: string;
  end_time: string;
  category?: string;
  active?: boolean;
  closed?: boolean;
  volume?: string;
  liquidity?: string;
  outcomes?: string;
  outcomePrices?: string;
  createdAt?: string;
  updatedAt?: string;
  yesTokenId?: string;
  noTokenId?: string;
  "15minStart": number;
  "15minEnd": number;
}

interface MarketsData {
  last_updated: string;
  total_markets: number;
  markets: FormattedMarket[];
}

function loadExistingMarkets(): { markets: FormattedMarket[]; lastUpdated: string | null } {
  if (fs.existsSync(JSON_FILE_PATH)) {
    try {
      const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
      const data: MarketsData = JSON.parse(fileContent);
      // Ensure all markets have required 15minStart and 15minEnd fields
      const markets = (data.markets || []).map(market => {
        if (!market["15minStart"] || !market["15minEnd"]) {
          const timestamps = extract15MinTimestamps(market.question || '');
          return {
            ...market,
            "15minStart": market["15minStart"] || timestamps.start || 0,
            "15minEnd": market["15minEnd"] || timestamps.end || 0
          };
        }
        return market;
      });
      return {
        markets: markets,
        lastUpdated: data.last_updated || null
      };
    } catch (error) {
      console.log(`Warning: ${JSON_FILE_PATH} is corrupted. Starting fresh.`);
      return { markets: [], lastUpdated: null };
    }
  }
  return { markets: [], lastUpdated: null };
}

function saveMarkets(markets: FormattedMarket[], lastUpdated: string): void {
  const data: MarketsData = {
    last_updated: lastUpdated,
    total_markets: markets.length,
    markets: markets
  };
  
  fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${markets.length} markets to ${JSON_FILE_PATH}`);
}

async function fetchMarketsFromGammaAPI(): Promise<Market[]> {
  try {
    console.log('Fetching markets from Gamma API...');
    const baseUrl = BASE_URL;

    // Fetch events with active markets
    const response = await fetch(
      `${baseUrl}/events?order=id&ascending=false&closed=false&limit=200`
    );

    if (!response.ok) {
      throw new Error(`Gamma API request failed: ${response.status} ${response.statusText}`);
    }

    const events = await response.json() as GammaEvent[];

    // Extract markets from events
    const allMarkets: Market[] = [];
    for (const event of events) {
      if (event.markets && Array.isArray(event.markets)) {
        allMarkets.push(...event.markets);
      }
    }

    console.log(`Fetched ${allMarkets.length} markets from ${events.length} events`);
    return allMarkets;
  } catch (error) {
    console.error('Failed to fetch markets from Gamma API:', error);
    throw error;
  }
}

function filterMarkets(markets: Market[], searchTerm: string): Market[] {
  if (!markets || markets.length === 0) {
    return [];
  }
  
  return markets.filter(market => {
    const slug = market.slug || '';
    return slug.toLowerCase().includes(searchTerm.toLowerCase());
  });
}

function extract15MinTimestamps(question: string): { start?: number; end?: number } {
  const result: { start?: number; end?: number } = {};
  
  if (!question) {
    return result;
  }
  
  try {
    // Pattern to match: "December 17, 11:30AM-11:45AM ET"
    // This matches month name, day, start time, end time, and ET
    const match = question.match(
      /([A-Za-z]+)\s+(\d+),\s+(\d+:\d+AM|\d+:\d+PM)-(\d+:\d+AM|\d+:\d+PM)\s+ET/i
    );
    
    if (!match) {
      return result;
    }
    
    const [, month, day, startTime, endTime] = match;
    
    // IMPORTANT: define the year explicitly
    const year = new Date().getFullYear();
    
    // Parse start time using Luxon
    const startDateTime = DateTime.fromFormat(
      `${month} ${day} ${year} ${startTime}`,
      "MMMM d yyyy h:mma",
      { zone: "America/New_York" }
    );
    
    // Parse end time using Luxon
    const endDateTime = DateTime.fromFormat(
      `${month} ${day} ${year} ${endTime}`,
      "MMMM d yyyy h:mma",
      { zone: "America/New_York" }
    );
    
    // Check if dates are valid
    if (startDateTime.isValid) {
      // Convert to Unix timestamp (seconds)
      result.start = startDateTime.toUnixInteger();
    }
    
    if (endDateTime.isValid) {
      // Convert to Unix timestamp (seconds)
      result.end = endDateTime.toUnixInteger();
    }
  } catch (error) {
    console.log(`Warning: Failed to extract timestamps from question: ${error}`);
  }
  
  return result;
}

function formatMarketData(market: Market, no: number): FormattedMarket {
  // Extract yesTokenId and noTokenId from clobTokenIds
  let yesTokenId: string | undefined;
  let noTokenId: string | undefined;

  if (market.clobTokenIds) {
    try {
      const clobTokenIdsString: string = market.clobTokenIds;
      // Parse the JSON string to get the actual array
      const clobTokenIds: string[] = JSON.parse(clobTokenIdsString);
      
      // yesTokenId is clobTokenIds[0] and noTokenId is clobTokenIds[1]
      if (clobTokenIds.length > 0) {
        yesTokenId = clobTokenIds[0];
      }
      if (clobTokenIds.length > 1) {
        noTokenId = clobTokenIds[1];
      }
    } catch (error) {
      console.log(`Warning: Failed to parse clobTokenIds for market ${market.id}: ${error}`);
    }
  }

  // Extract 15minStart and 15minEnd timestamps from question
  const timestamps = extract15MinTimestamps(market.question || '');

  return {
    no: no,
    marketId: market.id || '',
    question: market.question || '',
    slug: market.slug || '',
    start_time: market.startDate || market.startDateIso || '',
    end_time: market.endDate || market.endDateIso || '',
    category: market.category,
    active: market.active,
    closed: market.closed,
    volume: market.volume,
    liquidity: market.liquidity,
    outcomes: market.outcomes,
    outcomePrices: market.outcomePrices,
    createdAt: market.createdAt,
    updatedAt: market.updatedAt,
    yesTokenId: yesTokenId,
    noTokenId: noTokenId,
    "15minStart": timestamps.start || 0,
    "15minEnd": timestamps.end || 0
  };
}

async function searchAndUpdate(): Promise<void> {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`\n[${timestamp}] Starting market search...`);
  
  // Load existing markets
  const { markets: existingMarkets } = loadExistingMarkets();
  const existingMarketIds = new Set(existingMarkets.map(m => m.marketId));
  
  // Fetch markets from API
  let allMarkets: Market[];
  try {
    allMarkets = await fetchMarketsFromGammaAPI();
  } catch (error) {
    console.log('Failed to fetch markets. Skipping this run.');
    return;
  }
  
  // Filter markets by search term
  const filteredMarkets = filterMarkets(allMarkets, SEARCH_TERM);
  console.log(`Found ${filteredMarkets.length} markets matching '${SEARCH_TERM}'`);
  
  // Find new markets
  const newMarkets: Market[] = [];
  for (const market of filteredMarkets) {
    const marketId = market.id || '';
    if (marketId && !existingMarketIds.has(marketId)) {
      newMarkets.push(market);
      existingMarketIds.add(marketId);
    }
  }
  
  // Build the final markets array: new markets first, then existing ones
  const allFormattedMarkets: FormattedMarket[] = [];
  let currentNo = 1;
  
  // Add new markets at the beginning
  if (newMarkets.length > 0) {
    console.log(`Found ${newMarkets.length} new market(s)`);
    for (const market of newMarkets) {
      // Format new market with no starting from 1
      const formatted = formatMarketData(market, currentNo);
      allFormattedMarkets.push(formatted);
      currentNo++;
    }
  } else {
    console.log('No new markets found.');
  }
  
  // Add existing markets after new ones, and recalculate their no
  for (const market of existingMarkets) {
    // Preserve all existing market data, only update no
    let updatedMarket = { ...market, no: currentNo };
    
    // Ensure 15minStart and 15minEnd are always present
    if (!updatedMarket["15minStart"] || !updatedMarket["15minEnd"]) {
      const timestamps = extract15MinTimestamps(market.question || '');
      updatedMarket["15minStart"] = timestamps.start || 0;
      updatedMarket["15minEnd"] = timestamps.end || 0;
    }
    
    allFormattedMarkets.push(updatedMarket);
    currentNo++;
  }
  
  // Sort markets by 15minStart (descending order - big to small)
  allFormattedMarkets.sort((a, b) => {
    const startA = a["15minStart"] || 0;
    const startB = b["15minStart"] || 0;
    return startB - startA;
  });
  
  // Recalculate no values after sorting to maintain sequential numbering
  allFormattedMarkets.forEach((market, index) => {
    market.no = index + 1;
  });
  
  // Limit markets to 120 - delete markets from 121 onwards
  if (allFormattedMarkets.length > 120) {
    const deletedCount = allFormattedMarkets.length - 120;
    allFormattedMarkets.splice(120);
    console.log(`Deleted ${deletedCount} market(s) (keeping only first 120 markets)`);
  }
  
  // Save updated markets with recalculated no values
  saveMarkets(allFormattedMarkets, new Date().toISOString());
  console.log(`Search completed. Total markets in database: ${allFormattedMarkets.length}`);
}

function runScheduler(): void {
  console.log('Polymarket Search Bot started!');
  console.log(`Searching for markets with slug containing: '${SEARCH_TERM}'`);
  console.log(`JSON file location: ${JSON_FILE_PATH}`);
  console.log('Running every hour...');
  console.log('Press Ctrl+C to stop.\n');
  
  // Run immediately on start
  searchAndUpdate().catch(error => {
    console.error('Error in initial search:', error);
  });
  
  // Schedule to run every hour (at minute 0)
  schedule.scheduleJob('0 * * * *', () => {
    searchAndUpdate().catch(error => {
      console.error('Error in scheduled search:', error);
    });
  });
  
  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n\nBot stopped by user.');
    process.exit(0);
  });
}

// Ensure JSON file directory exists
const jsonDir = path.dirname(JSON_FILE_PATH);
if (!fs.existsSync(jsonDir)) {
  fs.mkdirSync(jsonDir, { recursive: true });
}

// Run the bot
runScheduler();

