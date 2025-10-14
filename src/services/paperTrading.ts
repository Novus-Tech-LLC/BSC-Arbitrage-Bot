import { Position, Trade, Token } from '../types';
import { config } from '../config';
import chalk from 'chalk';
import { randomUUID } from 'crypto';

export class PaperTradingService {
  private balance: number;
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private totalPnl: number = 0;

  constructor() {
    this.balance = config.paperTrading.initialBalance;
    this.initializeMockPositions();
  }

  private initializeMockPositions() {
    // Add realistic BSC positions with different holding strategies
    const mockPositions = [
      // Add more diverse positions
      {
        // DeFi play
        token: {
          address: '0xabc123456789012345678901234567890123def1',
          symbol: 'DEFI+',
          name: 'DeFi Plus Protocol',
          priceUsd: '0.000345',
          priceChange24h: 23.45,
          volume24h: 1500000,
          liquidity: 890000,
          fdv: 3450000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xdef123456789012345678901234567890123abc1',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xdef123456789012345678901234567890123abc1',
        },
        entryPrice: 0.000289,
        quantity: 519031,
        usdValue: 150,
        strategy: 'swing' as const,
        targetHoldTime: 48,
        narrativeStrength: 'strong' as const,
        entryDaysAgo: 0.25, // 6 hours
      },
      {
        // Fresh scalp entry
        token: {
          address: '0xfed123456789012345678901234567890123cba1',
          symbol: 'ROCKET',
          name: 'Rocket Launch',
          priceUsd: '0.0000089',
          priceChange24h: 189.23,
          volume24h: 8900000,
          liquidity: 340000,
          fdv: 890000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xcba123456789012345678901234567890123fed1',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xcba123456789012345678901234567890123fed1',
        },
        entryPrice: 0.0000078,
        quantity: 12820513,
        usdValue: 100,
        strategy: 'scalp' as const,
        targetHoldTime: 8,
        narrativeStrength: 'medium' as const,
        entryDaysAgo: 0.1, // 2.4 hours
      },
      {
        // Community token
        token: {
          address: '0xcom123456789012345678901234567890123mun1',
          symbol: 'FREN',
          name: 'Fren Community',
          priceUsd: '0.0000567',
          priceChange24h: 45.67,
          volume24h: 2340000,
          liquidity: 1230000,
          fdv: 5670000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xmun123456789012345678901234567890123com1',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xmun123456789012345678901234567890123com1',
        },
        entryPrice: 0.0000456,
        quantity: 2192982,
        usdValue: 100,
        strategy: 'hold' as const,
        targetHoldTime: 96,
        narrativeStrength: 'viral' as const,
        entryDaysAgo: 0.3, // 7.2 hours
      },
      {
        // NFT Gaming play
        token: {
          address: '0xnft123456789012345678901234567890123gam1',
          symbol: 'NFTGAME',
          name: 'NFT Gaming Protocol',
          priceUsd: '0.000234',
          priceChange24h: 67.89,
          volume24h: 3450000,
          liquidity: 1890000,
          fdv: 23400000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xgam123456789012345678901234567890123nft1',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xgam123456789012345678901234567890123nft1',
        },
        entryPrice: 0.000189,
        quantity: 423280,
        usdValue: 80,
        strategy: 'swing' as const,
        targetHoldTime: 36,
        narrativeStrength: 'strong' as const,
        entryDaysAgo: 0.4, // 9.6 hours
      },
      {
        // Long-term hold - AI narrative (similar to real BSC AI tokens)
        token: {
          address: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
          symbol: 'AITECH',
          name: 'AI Technology',
          priceUsd: '0.0000892',
          priceChange24h: 45.67,
          volume24h: 2800000,
          liquidity: 1900000,
          fdv: 8920000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xa5B3D4c5E6f7890AbCdEf123456789012',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xa5B3D4c5E6f7890AbCdEf123456789012',
        },
        entryPrice: 0.0000567,
        quantity: 3527337,
        usdValue: 200,
        strategy: 'hold' as const,
        targetHoldTime: 96, // 4 days
        narrativeStrength: 'viral' as const,
        entryDaysAgo: 1.5, // 36 hours in
      },
      {
        // Swing trade - Meme redemption (like SHIB/DOGE variants)
        token: {
          address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
          symbol: 'PEPE2',
          name: 'Pepe 2.0',
          priceUsd: '0.00000234',
          priceChange24h: 78.23,
          volume24h: 4200000,
          liquidity: 890000,
          fdv: 2340000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xb6C7D8e9F0a1234567890123456789AB',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xb6C7D8e9F0a1234567890123456789AB',
        },
        entryPrice: 0.00000156,
        quantity: 96153846,
        usdValue: 150,
        strategy: 'swing' as const,
        targetHoldTime: 36, // 1.5 days
        narrativeStrength: 'strong' as const,
        entryDaysAgo: 0.75, // 18 hours
      },
      {
        // Scalp - High volume pump play
        token: {
          address: '0xdD870fA1b7C4700F2BD7f44238821C26f7392148',
          symbol: 'MOON',
          name: 'MoonShot',
          priceUsd: '0.000456',
          priceChange24h: 156.78,
          volume24h: 12000000,
          liquidity: 450000,
          fdv: 4560000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xc7E9F1d234567890123456789012345',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xc7E9F1d234567890123456789012345',
        },
        entryPrice: 0.000234,
        quantity: 213675,
        usdValue: 50,
        strategy: 'scalp' as const,
        targetHoldTime: 6, // 6 hours
        narrativeStrength: 'medium' as const,
        entryDaysAgo: 0.2, // 4.8 hours
      },
      {
        // Hold - Binance ecosystem play
        token: {
          address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          symbol: 'BNBKING',
          name: 'BNB King',
          priceUsd: '0.00234',
          priceChange24h: 34.56,
          volume24h: 3400000,
          liquidity: 2100000,
          fdv: 23400000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xd8F2E3456789012345678901234567890',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xd8F2E3456789012345678901234567890',
        },
        entryPrice: 0.00189,
        quantity: 52910,
        usdValue: 100,
        strategy: 'hold' as const,
        targetHoldTime: 72, // 3 days
        narrativeStrength: 'strong' as const,
        entryDaysAgo: 0.5, // 12 hours
      },
      {
        // Swing - GameFi narrative
        token: {
          address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
          symbol: 'GAMEFI',
          name: 'GameFi Pro',
          priceUsd: '0.0000678',
          priceChange24h: 67.89,
          volume24h: 1800000,
          liquidity: 780000,
          fdv: 6780000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xe9A1B23456789012345678901234567890',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xe9A1B23456789012345678901234567890',
        },
        entryPrice: 0.0000456,
        quantity: 2192982,
        usdValue: 100,
        strategy: 'swing' as const,
        targetHoldTime: 48, // 2 days
        narrativeStrength: 'medium' as const,
        entryDaysAgo: 1, // 24 hours
      },
      {
        // New scalp position - Fresh entry
        token: {
          address: '0x9A676e781A523b5d0C0e43731313A708CB607508',
          symbol: 'PUMP',
          name: 'Pump Protocol',
          priceUsd: '0.000123',
          priceChange24h: 289.12,
          volume24h: 18000000,
          liquidity: 340000,
          fdv: 1230000,
          chainId: 'bsc',
          dexId: 'pancakeswap',
          pairAddress: '0xf0B2C3456789012345678901234567890',
          dexScreenerUrl: 'https://dexscreener.com/bsc/0xf0B2C3456789012345678901234567890',
        },
        entryPrice: 0.000123,
        quantity: 406504,
        usdValue: 50,
        strategy: 'scalp' as const,
        targetHoldTime: 4, // 4 hours
        narrativeStrength: 'weak' as const,
        entryDaysAgo: 0.05, // Just entered (1.2 hours)
      },
    ];

    mockPositions.forEach((mock, index) => {
      const currentPrice = parseFloat(mock.token.priceUsd);
      const currentValue = mock.quantity * currentPrice;
      const pnl = currentValue - mock.usdValue;
      const pnlPercent = (pnl / mock.usdValue) * 100;

      const position: Position = {
        id: `mock-position-${index + 1}`,
        token: mock.token as Token,
        entryPrice: mock.entryPrice,
        currentPrice: currentPrice,
        quantity: mock.quantity,
        usdValue: mock.usdValue,
        pnl: pnl,
        pnlPercent: pnlPercent,
        timestamp: new Date(),
        entryTime: new Date(Date.now() - mock.entryDaysAgo * 24 * 60 * 60 * 1000),
        status: 'open',
        strategy: mock.strategy,
        targetHoldTime: mock.targetHoldTime,
        narrativeStrength: mock.narrativeStrength,
        isInitialPosition: true, // Flag to protect from auto-sell
      };

      this.positions.set(position.id, position);
      this.balance -= mock.usdValue; // Deduct from initial balance
    });

    console.log(chalk.cyan(`📊 Initialized with ${mockPositions.length} BSC positions (${mockPositions.filter(p => p.strategy === 'hold').length} holds, ${mockPositions.filter(p => p.strategy === 'swing').length} swings, ${mockPositions.filter(p => p.strategy === 'scalp').length} scalps)`));
  }

  canTrade(amount: number): boolean {
    const totalPositionValue = Array.from(this.positions.values())
      .filter(p => p.status === 'open')
      .reduce((sum, p) => sum + p.usdValue, 0);
    
    return (this.balance + totalPositionValue) >= amount;
  }

  executeBuy(token: Token, usdAmount: number, strategy?: 'scalp' | 'swing' | 'hold', targetHoldTime?: number, narrativeStrength?: 'weak' | 'medium' | 'strong' | 'viral'): Trade | null {
    if (!this.canTrade(usdAmount)) {
      console.log(chalk.yellow(`⚠️  Insufficient balance for ${token.symbol}`));
      return null;
    }

    const price = parseFloat(token.priceUsd);
    const fee = usdAmount * config.paperTrading.tradingFee;
    const netAmount = usdAmount - fee;
    const quantity = netAmount / price;

    const position: Position = {
      id: randomUUID(),
      token,
      entryPrice: price,
      currentPrice: price,
      quantity,
      usdValue: netAmount,
      pnl: 0,
      pnlPercent: 0,
      timestamp: new Date(),
      entryTime: new Date(),
      status: 'open',
      strategy: strategy || 'swing',
      targetHoldTime: targetHoldTime || 24,
      narrativeStrength: narrativeStrength || 'medium',
    };

    const trade: Trade = {
      id: randomUUID(),
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      type: 'buy',
      price,
      quantity,
      usdValue: usdAmount,
      timestamp: new Date(),
      reason: 'Trending token detected',
    };

    this.positions.set(position.id, position);
    this.trades.push(trade);
    this.balance -= usdAmount;

    console.log(chalk.green(`💰 BOUGHT ${token.symbol} @ $${price.toFixed(6)}`));
    return trade;
  }

  executeSell(positionId: string, currentPrice: number, reason: string): Trade | null {
    const position = this.positions.get(positionId);
    if (!position || position.status === 'closed') return null;

    const sellValue = position.quantity * currentPrice;
    const fee = sellValue * config.paperTrading.tradingFee;
    const netValue = sellValue - fee;
    const pnl = netValue - position.usdValue;
    const pnlPercent = (pnl / position.usdValue) * 100;

    position.status = 'closed';
    position.exitPrice = currentPrice;
    position.exitTimestamp = new Date();
    position.pnl = pnl;
    position.pnlPercent = pnlPercent;

    const trade: Trade = {
      id: randomUUID(),
      tokenSymbol: position.token.symbol,
      tokenAddress: position.token.address,
      type: 'sell',
      price: currentPrice,
      quantity: position.quantity,
      usdValue: sellValue,
      timestamp: new Date(),
      pnl,
      reason,
    };

    this.trades.push(trade);
    this.balance += netValue;
    this.totalPnl += pnl;

    const color = pnl > 0 ? chalk.green : chalk.red;
    console.log(color(`💸 SOLD ${position.token.symbol} @ $${currentPrice.toFixed(6)} | PNL: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`));
    
    return trade;
  }

  updatePositions(tokenPrices: Map<string, number>): void {
    for (const position of this.positions.values()) {
      if (position.status === 'open') {
        const currentPrice = tokenPrices.get(position.token.address) || position.currentPrice;
        position.currentPrice = currentPrice;
        
        const currentValue = position.quantity * currentPrice;
        const pnl = currentValue - position.usdValue;
        const pnlPercent = (pnl / position.usdValue) * 100;
        
        position.pnl = pnl;
        position.pnlPercent = pnlPercent;

        // Calculate hold time in hours
        const holdTimeHours = (Date.now() - position.entryTime.getTime()) / (1000 * 60 * 60);
        
        // Skip auto-sell for initial positions to keep them visible
        if ((position as any).isInitialPosition) {
          continue;
        }
        
        // Strategy-based exit logic
        if (position.strategy === 'scalp') {
          // Scalps: Tight stop loss, quick take profit
          if (pnlPercent <= -10) {
            this.executeSell(position.id, currentPrice, 'Scalp stop loss');
          } else if (pnlPercent >= 15 || holdTimeHours > (position.targetHoldTime || 8)) {
            this.executeSell(position.id, currentPrice, 'Scalp target reached');
          }
        } else if (position.strategy === 'swing') {
          // Swings: Moderate stop loss, hold for target time
          if (pnlPercent <= -20) {
            this.executeSell(position.id, currentPrice, 'Swing stop loss');
          } else if ((pnlPercent >= 30 && holdTimeHours > 12) || 
                     holdTimeHours > (position.targetHoldTime || 48)) {
            this.executeSell(position.id, currentPrice, 'Swing target reached');
          }
        } else if (position.strategy === 'hold') {
          // Holds: Wide stop loss, respect minimum hold time
          const minHoldTime = 48; // Minimum 2 days for holds
          if (pnlPercent <= -30 && holdTimeHours > minHoldTime) {
            this.executeSell(position.id, currentPrice, 'Hold stop loss');
          } else if ((pnlPercent >= 50 && holdTimeHours > minHoldTime) || 
                     holdTimeHours > (position.targetHoldTime || 120)) {
            this.executeSell(position.id, currentPrice, 'Hold target reached');
          }
        }
      }
    }
  }

  // Simulate real-time price updates for mock positions
  simulatePriceUpdates(): void {
    for (const position of this.positions.values()) {
      if (position.status === 'open') {
        // Different volatility based on strategy
        let volatility = 0.02; // 2% default
        if (position.strategy === 'scalp') {
          volatility = 0.05; // 5% for scalps (more volatile)
        } else if (position.strategy === 'swing') {
          volatility = 0.03; // 3% for swings
        } else if (position.strategy === 'hold') {
          volatility = 0.015; // 1.5% for holds (more stable)
        }
        
        // Simulate price movements with slight upward bias for strong narratives
        const bias = position.narrativeStrength === 'viral' ? 0.001 : 
                    position.narrativeStrength === 'strong' ? 0.0005 : 0;
        
        const priceChange = (Math.random() - 0.5 + bias) * volatility;
        const newPrice = position.currentPrice * (1 + priceChange);
        
        // Update the token's price
        position.token.priceUsd = newPrice.toString();
        position.currentPrice = newPrice;
        
        // Update 24h price change
        position.token.priceChange24h += priceChange * 100;
        
        // Update PNL
        const currentValue = position.quantity * newPrice;
        position.pnl = currentValue - position.usdValue;
        position.pnlPercent = (position.pnl / position.usdValue) * 100;
        
        // Also simulate volume changes
        position.token.volume24h *= (1 + (Math.random() - 0.5) * 0.1);
      }
    }
  }

  getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'open');
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getTrades(): Trade[] {
    return this.trades.slice(-config.display.maxTradeHistory);
  }

  getStats() {
    const allPositions = this.getAllPositions();
    const closedPositions = allPositions.filter(p => p.status === 'closed');
    const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
    const totalTrades = closedPositions.length;
    
    return {
      balance: this.balance,
      totalPnl: this.totalPnl,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      tradesCount: totalTrades,
      openPositions: this.getOpenPositions().length,
    };
  }

  // Check position balance by strategy type
  getPositionBalance() {
    const openPositions = this.getOpenPositions();
    const balance = {
      scalp: 0,
      swing: 0,
      hold: 0,
      total: openPositions.length
    };
    
    openPositions.forEach(position => {
      if (position.strategy) {
        balance[position.strategy]++;
      }
    });
    
    return balance;
  }

  // Check if we need more positions of a specific type
  needsPositionType(strategy: 'scalp' | 'swing' | 'hold'): boolean {
    const balance = this.getPositionBalance();
    
    // Ideal distribution: 2 scalps, 2 swings, 2 holds
    const idealCounts = {
      scalp: 2,
      swing: 2, 
      hold: 2
    };
    
    return balance[strategy] < idealCounts[strategy];
  }
}