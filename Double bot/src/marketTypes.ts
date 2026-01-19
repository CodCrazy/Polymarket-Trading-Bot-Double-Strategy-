export interface Market {
  no: number;
  marketId: string;
  question: string;
  slug: string;
  start_time: string;
  end_time: string;
  active: boolean;
  closed: boolean;
  liquidity: string;
  outcomes: string;
  outcomePrices: string;
  createdAt: string;
  updatedAt: string;
  yesTokenId: string;
  noTokenId: string;
  "15minStart": number;
  "15minEnd": number;
}

export interface MarketJsonFile {
  last_updated: string;
  total_markets: number;
  markets: Market[];
}
