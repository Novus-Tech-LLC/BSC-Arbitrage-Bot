export interface Token {
  address: string;
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  chainId: string;
  dexId: string;
  pairAddress: string;
  coinGeckoId?: string; // For real-time price tracking
  logo?: string; // Token logo URL
  website?: string; // Project website
  dexScreenerUrl?: string; // DexScreener link
}

export interface Position {
  id: string;
  token: Token;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  usdValue: number;
  pnl: number;
  pnlPercent: number;
  timestamp: Date;
  entryTime: Date; // When position was opened
  status: 'open' | 'closed';
  exitPrice?: number;
  exitTimestamp?: Date;
  strategy?: 'scalp' | 'swing' | 'hold'; // Trading strategy
  targetHoldTime?: number; // Target hold time in hours
  narrativeStrength?: 'weak' | 'medium' | 'strong' | 'viral'; // Narrative strength
  isInitialPosition?: boolean; // Flag for initial demo positions
}

export interface Trade {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  type: 'buy' | 'sell';
  price: number;
  quantity: number;
  usdValue: number;
  timestamp: Date;
  pnl?: number;
  reason: string;
}

export interface BotStatus {
  running: boolean;
  mode: 'paper' | 'live';
  balance: number;
  totalPnl: number;
  winRate: number;
  tradesCount: number;
  openPositions: number;
  lastUpdate: Date;
}

export interface DexScreenerResponse {
  pairs: Array<{
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    volume: {
      h24: number;
    };
    priceChange: {
      h24: number;
    };
    liquidity?: {
      usd: number;
    };
    fdv?: number;
  }>;
}