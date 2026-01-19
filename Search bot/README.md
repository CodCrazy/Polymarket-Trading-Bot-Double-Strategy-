# Polymarket Search Bot (TypeScript)

A TypeScript bot that searches Polymarket markets for BTC up/down 15-minute markets and logs them to a JSON file.

## Features

- Searches Polymarket API for markets with slug containing "btc-updown-15m"
- Logs market data to JSON file with fields: NO, MarketId, question, slug, start time, end time, etc.
- Runs automatically every hour
- Only adds new markets (skips duplicates)
- JSON file is saved outside the search bot folder

## Setup

1. Install Node.js (v16 or higher)

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Usage

### Run continuously (every hour):
```bash
npm start
```

Or run directly with ts-node (for development):
```bash
npm run dev
```

The bot will:
- Run immediately when started
- Then run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
- Continue running until stopped (Ctrl+C)

## Output

The bot creates a JSON file at `../polymarket_markets.json` (one level up from the search_bot folder) with the following structure:

```json
{
  "last_updated": "2024-01-01T12:00:00.000Z",
  "total_markets": 10,
  "markets": [
    {
      "NO": 1,
      "MarketId": "market-id-here",
      "question": "Market question",
      "slug": "btc-updown-15m-...",
      "start_time": "2024-01-01T00:00:00Z",
      "end_time": "2024-01-01T00:15:00Z",
      "category": "...",
      "active": true,
      "closed": false,
      "volume": "...",
      "liquidity": "...",
      "outcomes": "...",
      "outcomePrices": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

## Configuration

You can modify the search term by changing the `SEARCH_TERM` constant in `polymarket_search_bot.ts`:

```typescript
const SEARCH_TERM = 'btc-updown-15m';
```

## Project Structure

```
search_bot/
  ├── polymarket_search_bot.ts  # Main bot script
  ├── package.json               # Dependencies
  ├── tsconfig.json              # TypeScript configuration
  ├── README.md                  # This file
  └── dist/                      # Compiled JavaScript (after build)
      └── polymarket_search_bot.js

../polymarket_markets.json       # Output file (created automatically)
```

## Notes

- The bot checks for new markets every hour
- Markets are identified by their MarketId to avoid duplicates
- The JSON file is created automatically if it doesn't exist
- The bot will continue running until stopped (Ctrl+C)
- All TypeScript types are properly defined for type safety

