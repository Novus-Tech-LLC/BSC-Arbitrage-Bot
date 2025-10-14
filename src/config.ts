export const config = {
  // Bot Configuration
  bot: {
    tradingEnabled: false, // Set to true for real trading (paper trading by default)
    tradingMode: 'paper' as 'paper' | 'live', // 'paper' or 'live'
    scanInterval: 10000, // 10 seconds
    maxPositions: 5,
    positionSize: 1000, // USD equivalent per trade
    positionSizeBNB: 0.1, // BNB amount per trade (for live trading)
    stopLoss: 0.95, // 5% stop loss
    takeProfit: 1.15, // 15% take profit
    minVolume24h: 100000, // Minimum 24h volume in USD
    minLiquidity: 50000, // Minimum liquidity in USD
    slippageTolerance: 0.5, // 0.5% slippage
    gasLimit: 500000, // Gas limit for transactions
    priorityFee: 5, // Gwei for priority fee
  },

  // DexScreener API
  dexscreener: {
    baseUrl: 'https://api.dexscreener.com/latest',
    chains: ['bsc'], // Focus on BSC for now
    limit: 10, // Top 10 tokens
  },

  // Paper Trading
  paperTrading: {
    initialBalance: 1000, // Starting with $1,000
    tradingFee: 0.003, // 0.3% per trade
  },

  // WebSocket Server
  server: {
    port: 3000,
    wsPort: 3001,
  },

  // Display Settings
  display: {
    updateInterval: 1000, // Update dashboard every second
    maxTradeHistory: 50,
    colors: {
      profit: '#00ff00',
      loss: '#ff0000',
      neutral: '#00ffff',
    },
  },
};